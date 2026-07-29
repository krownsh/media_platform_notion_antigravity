import dotenv from 'dotenv';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../server/.env') });

import { supabase } from '../../server/supabaseClient.js';
import { classifyPostRoutes, classifyRoutesByRules } from '../../server/services/routeAgent.js';
import { matchSourceToProjectNeeds } from '../../server/services/opportunityMatcher.js';
import { auditProjectDirectory } from '../../server/services/projectAuditor.js';
import { enrichContext } from '../../server/services/enrichmentService.js';
import { runPocWorkflow } from '../../server/services/pocService.js';
import { getTopicScopesForPost, normalizeGitHubTarget, selectPocTopicScope } from '../../server/services/topicScopeService.js';
import {
    ensureOutboxRoutePlan,
    persistOutboxRouteTransition
} from '../../server/services/outboxRouteStateService.js';

export function getSuccessfulPoc(postData) {
    const analysis = Array.isArray(postData.collection_post_analysis)
        ? postData.collection_post_analysis[0]
        : postData.collection_post_analysis;
    const insights = Array.isArray(analysis?.insights) ? analysis.insights : [];
    return insights.find(insight => insight?.type === 'poc_run' && insight?.status === 'success') || null;
}

export function resolveWorkspaceTarget(projectDir) {
    try {
        const remoteUrl = execFileSync('git', ['config', '--get', 'remote.origin.url'], {
            cwd: projectDir,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore']
        });
        const githubTarget = normalizeGitHubTarget(remoteUrl);
        if (githubTarget) return githubTarget;
    } catch {
        // A local-only project has no stable remote identity. It is intentionally not POC-eligible.
    }
    return null;
}

async function findMatches(postData, classificationResult, workspaceTarget) {
    const { snapshot, needs } = await auditProjectDirectory(path.resolve(__dirname, '../../'));
    console.log(`[Agent SDK] Project Auditor scanned ${snapshot.projectName}: found ${needs.length} active needs.`);
    return matchSourceToProjectNeeds(classificationResult, postData, needs, { id: workspaceTarget });
}

export async function analyzeItem(outboxId, options = {}) {
    if (!outboxId) {
        throw new Error('Please provide an Outbox ID. Usage: node analyze-item.js <outbox_id> [--execute-poc]');
    }

    const executePoc = options.executePoc === true;
    const startedAt = Date.now();
    console.log(`[Agent SDK] Analyzing outbox item: ${outboxId} (execute_poc=${executePoc})...`);

    const { data: event, error } = await supabase
        .from('collection_capture_outbox')
        .select(`
            *,
            collection_posts (
                *,
                collection_post_analysis (*)
            )
        `)
        .eq('id', outboxId)
        .single();
    if (error || !event) {
        throw new Error(`Failed to fetch outbox item: ${error?.message || 'Item not found'}`);
    }

    const postData = Array.isArray(event.collection_posts) ? event.collection_posts[0] : event.collection_posts;
    if (!postData) throw new Error('Related post data not found for this outbox event');

    const workspaceDir = path.resolve(__dirname, '../../');
    const workspaceTarget = resolveWorkspaceTarget(workspaceDir);
    if (!workspaceTarget) {
        throw new Error('This checkout has no GitHub origin remote, so it cannot be selected as a POC target.');
    }
    const topicScopes = await getTopicScopesForPost(postData, supabase);
    const pocScope = selectPocTopicScope(topicScopes, workspaceTarget);
    const hasResearchScope = topicScopes.some(scope => scope.mode === 'research' && scope.is_active !== false);

    if (!pocScope && !hasResearchScope) {
        console.log(`[Agent SDK] Stored only: no active research or POC scope applies to ${workspaceTarget}.`);
        return { event, postData, classificationResult: null, skipped: 'topic_scope' };
    }

    // Proposal mode uses the local rule classifier. The LLM classifier is only called
    // after the human explicitly asks to execute a POC.
    const classificationResult = executePoc
        ? await classifyPostRoutes(postData)
        : classifyRoutesByRules(postData);
    console.log('[Agent SDK] Route classification:', JSON.stringify(classificationResult.routes, null, 2));

    let activeEvent = await ensureOutboxRoutePlan(event, classificationResult.routes, supabase);
    const applyPocRoute = activeEvent.payload.agent_routes.routes.find(route => route.type === 'apply_poc');
    if (!applyPocRoute) {
        console.log('[Agent SDK] No POC candidate was found; no external POC action was taken.');
        return { event: activeEvent, postData, classificationResult };
    }

    const existingSuccess = getSuccessfulPoc(postData);
    if (existingSuccess) {
        if (applyPocRoute.status !== 'completed') {
            activeEvent = await persistOutboxRouteTransition(
                activeEvent,
                'apply_poc',
                'completed',
                { completed_at: new Date().toISOString(), reused_run_id: existingSuccess.run_id, status: existingSuccess.status },
                supabase
            );
        }
        console.log(`[Agent SDK] Reused successful POC result: ${existingSuccess.run_id}`);
        return { event: activeEvent, postData, classificationResult, reused_run_id: existingSuccess.run_id };
    }

    if (!pocScope) {
        activeEvent = await persistOutboxRouteTransition(
            activeEvent,
            'apply_poc',
            'skipped',
            {
                skipped_at: new Date().toISOString(),
                reason: `No active POC topic scope permits this source for ${workspaceTarget}.`
            },
            supabase
        );
        console.log(`[Agent SDK] POC skipped: the source is not allowed for ${workspaceTarget}.`);
        return { event: activeEvent, postData, classificationResult, skipped: 'poc_scope' };
    }

    const matches = await findMatches(postData, classificationResult, workspaceTarget);
    if (matches.length === 0) {
        activeEvent = await persistOutboxRouteTransition(
            activeEvent,
            'apply_poc',
            'skipped',
            { skipped_at: new Date().toISOString(), reason: 'No matching project need found.' },
            supabase
        );
        console.log('[Agent SDK] No matching project need found.');
        return { event: activeEvent, postData, classificationResult };
    }

    const selectedMatch = matches[0];
    console.log(`[Agent SDK] Top POC proposal: ${selectedMatch.title} (score=${selectedMatch.score}).`);
    if (!executePoc) {
        activeEvent = await persistOutboxRouteTransition(
            activeEvent,
            'apply_poc',
            'pending',
            {
                proposed_at: new Date().toISOString(),
                topic_scope_id: pocScope.id,
                application_case: selectedMatch.title,
                score: selectedMatch.score,
                reason: 'Awaiting explicit --execute-poc confirmation.'
            },
            supabase
        );
        console.log('[Agent SDK] POC proposal recorded. No MiniMax, Tavily, or Docker action was run.');
        return { event: activeEvent, postData, classificationResult, matches };
    }

    let enrichedData = '';
    try {
        console.log('[Agent SDK] Running Tavily enrichment after explicit POC execution request...');
        enrichedData = await enrichContext(postData);
        postData.enriched_context = enrichedData;
    } catch (enrichmentError) {
        console.warn(`[Agent SDK] Tavily enrichment failed; continuing without it: ${enrichmentError.message}`);
    }

    activeEvent = await persistOutboxRouteTransition(
        activeEvent,
        'apply_poc',
        'in_progress',
        { started_at: new Date().toISOString(), application_case: selectedMatch.title, topic_scope_id: pocScope.id },
        supabase
    );

    try {
        const pocResult = await runPocWorkflow({
            postData,
            enrichedContext: enrichedData,
            applicationCase: selectedMatch
        }, { supabaseClient: supabase });

        activeEvent = await persistOutboxRouteTransition(
            activeEvent,
            'apply_poc',
            pocResult.status === 'success' ? 'completed' : 'failed',
            {
                completed_at: new Date().toISOString(),
                run_id: pocResult.run_id,
                status: pocResult.status,
                generation_method: pocResult.generation_method || null
            },
            supabase
        );
        if (pocResult.status !== 'success') {
            throw new Error(`POC execution finished with status: ${pocResult.status}`);
        }
        return { event: activeEvent, postData, classificationResult, matches, pocResult };
    } catch (pocError) {
        activeEvent = await persistOutboxRouteTransition(
            activeEvent,
            'apply_poc',
            'failed',
            { failed_at: new Date().toISOString(), error: pocError.message },
            supabase
        );
        throw pocError;
    } finally {
        console.log(`[Agent SDK] Completed in ${Date.now() - startedAt}ms.`);
    }
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMainModule) {
    const args = process.argv.slice(2);
    const outboxId = args.find(arg => !arg.startsWith('--'));
    analyzeItem(outboxId, { executePoc: args.includes('--execute-poc') })
        .catch(error => {
            console.error('[Agent SDK] Analysis failed:', error.message);
            process.exitCode = 1;
        });
}
