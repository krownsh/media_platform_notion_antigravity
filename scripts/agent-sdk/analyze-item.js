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
import {
    claimHermesOutboxItem,
    completeHermesStoredOnlyReview,
    failHermesOutboxItem,
    releaseHermesOutboxItem
} from '../../server/services/hermesOutboxService.js';

export function getSuccessfulPoc(postData) {
    const analysis = Array.isArray(postData.collection_post_analysis)
        ? postData.collection_post_analysis[0]
        : postData.collection_post_analysis;
    const insights = Array.isArray(analysis?.insights) ? analysis.insights : [];
    return insights.find(insight => insight?.type === 'poc_run' && insight?.status === 'success') || null;
}

export function applyTopicScopeToClassification(classificationResult, options = {}) {
    const routes = Array.isArray(classificationResult?.routes)
        ? classificationResult.routes.map(route => ({ ...route }))
        : [];
    const reasons = Array.isArray(classificationResult?.reasons)
        ? [...classificationResult.reasons]
        : [];

    if (options.hasResearchScope && !routes.some(route => route.type === 'research_content')) {
        routes.push({
            type: 'research_content',
            priority: 80,
            reason: 'The active topic scope requests a research proposal before any external action.'
        });
        reasons.push('Active research topic scope');
    }

    routes.sort((left, right) => Number(right.priority || 0) - Number(left.priority || 0));
    return {
        ...classificationResult,
        primary_intent: routes[0]?.type || classificationResult?.primary_intent || 'analysis_only',
        routes,
        reasons: [...new Set(reasons)]
    };
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
        throw new Error('Please provide an Outbox ID. Usage: node analyze-item.js <outbox_id> --legacy-poc [--execute-poc]');
    }
    if (options.legacyPocMode !== true) {
        throw new Error('agent:analyze is retired because folder scopes must not decide a post workflow. Use agent:next, agent:triage, and agent:decide instead. Pass --legacy-poc only to resume an already-created legacy POC route.');
    }

    const executePoc = options.executePoc === true;
    const agentIdentity = options.agentIdentity || null;
    const supabaseClient = options.supabaseClient || supabase;
    const startedAt = Date.now();
    let activeEvent = null;
    let currentStage = 'claim';
    console.log(`[Agent SDK] Analyzing outbox item: ${outboxId} (execute_poc=${executePoc}, agent=${agentIdentity || 'interactive'})...`);

    const finish = async result => {
        if (agentIdentity && activeEvent?.locked_by === agentIdentity) {
            activeEvent = await releaseHermesOutboxItem(activeEvent, agentIdentity, supabaseClient, { keepStatus: true });
            return { ...result, event: activeEvent };
        }
        return result;
    };

    try {
        if (agentIdentity) {
            activeEvent = await claimHermesOutboxItem(outboxId, agentIdentity, supabaseClient, {
                leaseMinutes: options.leaseMinutes || 15
            });
        }

    currentStage = 'load_source';
    const { data: event, error } = await supabaseClient
        .from('collection_capture_outbox')
        .select(`
            *,
            collection_posts (
                *,
                collection_post_media (*),
                collection_post_analysis (*)
            )
        `)
        .eq('id', outboxId)
        .single();
    if (error || !event) {
        throw new Error(`Failed to fetch outbox item: ${error?.message || 'Item not found'}`);
    }
    activeEvent = event;

    const postData = Array.isArray(event.collection_posts) ? event.collection_posts[0] : event.collection_posts;
    if (!postData) throw new Error('Related post data not found for this outbox event');

    currentStage = 'resolve_topic_scope';
    const topicScopes = await getTopicScopesForPost(postData, supabaseClient);
    const hasResearchScope = topicScopes.some(scope => scope.mode === 'research' && scope.is_active !== false);
    const hasPocProposalScope = topicScopes.some(scope => scope.mode === 'poc_proposal' && scope.is_active !== false);

    if (!hasPocProposalScope && !hasResearchScope) {
        activeEvent = await completeHermesStoredOnlyReview(
            activeEvent,
            agentIdentity,
            supabaseClient,
            { reason: 'The active topic scope is collect-only, so Hermes stored the source without creating action routes.' }
        );
        console.log('[Agent SDK] Stored only: no active research or POC scope applies.');
        return finish({ event: activeEvent, postData, classificationResult: null, skipped: 'topic_scope' });
    }

    const workspaceDir = path.resolve(__dirname, '../../');
    const workspaceTarget = hasPocProposalScope ? resolveWorkspaceTarget(workspaceDir) : null;
    const pocScope = workspaceTarget ? selectPocTopicScope(topicScopes, workspaceTarget) : null;

    // Proposal mode uses the local rule classifier. The LLM classifier is only called
    // after the human explicitly asks to execute a POC.
    currentStage = 'classify_routes';
    const baseClassificationResult = executePoc
        ? await classifyPostRoutes(postData)
        : classifyRoutesByRules(postData);
    const classificationResult = applyTopicScopeToClassification(baseClassificationResult, { hasResearchScope });
    console.log('[Agent SDK] Route classification:', JSON.stringify(classificationResult.routes, null, 2));

    currentStage = 'persist_route_plan';
    activeEvent = await ensureOutboxRoutePlan(activeEvent, classificationResult.routes, supabaseClient);
    const applyPocRoute = activeEvent.payload.agent_routes.routes.find(route => route.type === 'apply_poc');
    if (!applyPocRoute) {
        console.log('[Agent SDK] No POC candidate was found; no external POC action was taken.');
        return finish({ event: activeEvent, postData, classificationResult });
    }

    const existingSuccess = getSuccessfulPoc(postData);
    if (existingSuccess) {
        if (applyPocRoute.status !== 'completed') {
            activeEvent = await persistOutboxRouteTransition(
                activeEvent,
                'apply_poc',
                'completed',
                { completed_at: new Date().toISOString(), reused_run_id: existingSuccess.run_id, status: existingSuccess.status },
                supabaseClient
            );
        }
        console.log(`[Agent SDK] Reused successful POC result: ${existingSuccess.run_id}`);
        return finish({ event: activeEvent, postData, classificationResult, reused_run_id: existingSuccess.run_id });
    }

    if (!pocScope) {
        activeEvent = await persistOutboxRouteTransition(
            activeEvent,
            'apply_poc',
            'skipped',
            {
                skipped_at: new Date().toISOString(),
                reason: workspaceTarget
                    ? `No active POC topic scope permits this source for ${workspaceTarget}.`
                    : 'No canonical GitHub project target is available for POC matching.'
            },
            supabaseClient
        );
        console.log(`[Agent SDK] POC skipped: the source is not allowed for ${workspaceTarget || 'this checkout'}.`);
        return finish({ event: activeEvent, postData, classificationResult, skipped: 'poc_scope' });
    }

    currentStage = 'match_project_need';
    const matches = await findMatches(postData, classificationResult, workspaceTarget);
    if (matches.length === 0) {
        activeEvent = await persistOutboxRouteTransition(
            activeEvent,
            'apply_poc',
            'skipped',
            { skipped_at: new Date().toISOString(), reason: 'No matching project need found.' },
            supabaseClient
        );
        console.log('[Agent SDK] No matching project need found.');
        return finish({ event: activeEvent, postData, classificationResult });
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
            supabaseClient
        );
        console.log('[Agent SDK] POC proposal recorded. No MiniMax, Tavily, or Docker action was run.');
        return finish({ event: activeEvent, postData, classificationResult, matches });
    }

    let enrichedData = '';
    currentStage = 'enrich_poc_context';
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
        supabaseClient
    );

    try {
        currentStage = 'execute_poc';
        const pocResult = await runPocWorkflow({
            postData,
            enrichedContext: enrichedData,
            applicationCase: selectedMatch
        }, { supabaseClient });

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
            supabaseClient
        );
        if (pocResult.status !== 'success') {
            throw new Error(`POC execution finished with status: ${pocResult.status}`);
        }
        return finish({ event: activeEvent, postData, classificationResult, matches, pocResult });
    } catch (pocError) {
        activeEvent = await persistOutboxRouteTransition(
            activeEvent,
            'apply_poc',
            'failed',
            { failed_at: new Date().toISOString(), error: pocError.message },
            supabaseClient
        );
        throw pocError;
    } finally {
            console.log(`[Agent SDK] Completed in ${Date.now() - startedAt}ms.`);
    }
    } catch (error) {
        if (agentIdentity && activeEvent?.locked_by === agentIdentity) {
            try {
                activeEvent = await failHermesOutboxItem(
                    activeEvent,
                    agentIdentity,
                    currentStage,
                    error,
                    supabaseClient
                );
            } catch (failureWriteError) {
                console.error(`[Agent SDK] Failed to persist Hermes error state: ${failureWriteError.message}`);
            }
        }
        throw error;
    }
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMainModule) {
    const args = process.argv.slice(2);
    const outboxId = args[0];
    const agentIndex = args.indexOf('--agent');
    const leaseIndex = args.indexOf('--lease-minutes');
    analyzeItem(outboxId, {
        legacyPocMode: args.includes('--legacy-poc'),
        executePoc: args.includes('--execute-poc'),
        agentIdentity: agentIndex >= 0 ? args[agentIndex + 1] : null,
        leaseMinutes: leaseIndex >= 0 ? args[leaseIndex + 1] : 15
    })
        .catch(error => {
            console.error('[Agent SDK] Analysis failed:', error.message);
            process.exitCode = 1;
        });
}
