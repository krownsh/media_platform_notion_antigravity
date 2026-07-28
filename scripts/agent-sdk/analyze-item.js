import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../server/.env') });

import { supabase } from '../../server/supabaseClient.js';
import { classifyPostRoutes } from '../../server/services/routeAgent.js';
import { matchSourceToProjectNeeds } from '../../server/services/opportunityMatcher.js';
import { auditProjectDirectory } from '../../server/services/projectAuditor.js';
import { enrichContext } from '../../server/services/enrichmentService.js';
import { runPocWorkflow } from '../../server/services/pocService.js';
import {
    ensureOutboxRoutePlan,
    persistOutboxRouteTransition
} from '../../server/services/outboxRouteStateService.js';

function getSuccessfulPoc(postData) {
    const analysis = Array.isArray(postData.collection_post_analysis)
        ? postData.collection_post_analysis[0]
        : postData.collection_post_analysis;
    const insights = Array.isArray(analysis?.insights) ? analysis.insights : [];
    return insights.find(insight => insight?.type === 'poc_run' && insight?.status === 'success') || null;
}

export async function analyzeItem(outboxId, options = {}) {
    if (!outboxId) {
        throw new Error('Please provide an Outbox ID. Usage: node analyze-item.js <outbox_id> [--propose-only]');
    }

    const executePoc = options.executePoc !== false;
    const startedAt = Date.now();
    console.log(`[Agent SDK] Analyzing outbox item: ${outboxId} (auto_poc=${executePoc})...`);

    // 1. 取得資料
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
    if (!postData) {
        throw new Error('Related post data not found for this outbox event');
    }

    console.log('\n[Phase 1] 🧠 Running Route Agent Classification...');
    let classificationResult;
    try {
        classificationResult = await classifyPostRoutes(postData);
        console.log('✅ Classification successful:');
        console.log(JSON.stringify(classificationResult.routes, null, 2));
    } catch (err) {
        throw new Error(`Classification failed: ${err.message}`, { cause: err });
    }

    let activeEvent = await ensureOutboxRoutePlan(event, classificationResult.routes, supabase);
    const plannedRoutes = activeEvent.payload.agent_routes.routes;
    const hasApplyPoc = plannedRoutes.some(route => route.type === 'apply_poc');
    const requiresEnrichment = plannedRoutes.some(route => route.type === 'apply_poc' || route.type === 'research_content');
    
    // 2. 如果包含 apply_poc 或 research_content，跑 Matcher 之前先跑 Enrichment
    if (requiresEnrichment) {
        console.log('\n[Phase 1.5] 🌐 Running Enrichment (Tavily Search)...');
        let enrichedData = '';
        try {
            enrichedData = await enrichContext(postData);
            console.log('✅ Enrichment complete:');
            console.log(enrichedData);
            postData.enriched_context = enrichedData;
        } catch (err) {
            console.error('❌ Enrichment failed:', err.message);
        }

        console.log('\n[Phase 2] 🔍 Running Opportunity Matcher (Auditing local projects)...');
        if (!hasApplyPoc) {
            console.log('[Agent SDK] Research route is pending; no POC will be generated for this source.');
            console.log(`[Agent SDK] Completed in ${Date.now() - startedAt}ms.`);
            return { event: activeEvent, postData, classificationResult };
        }

        try {
            // Run Project Auditor on the local workspace
            const { snapshot, needs } = await auditProjectDirectory(path.resolve(__dirname, '../../'));
            console.log(`✅ Project Auditor scanned ${snapshot.projectName}: found ${needs.length} active needs.`);

            const matches = matchSourceToProjectNeeds(classificationResult, postData, needs, { id: snapshot.projectName });
            
            if (matches.length > 0) {
                console.log(`✅ Found ${matches.length} application case(s):`);
                matches.forEach((match, idx) => {
                    console.log(`\n--- Case #${idx + 1} ---`);
                    console.log(`Project: ${match.project_id}`);
                    console.log(`Title: ${match.title}`);
                    console.log(`Expected Value: ${match.expected_value}`);
                    console.log(`Suggested POC Path: ${match.candidate_module}`);
                    console.log(`Score: ${match.score}`);
                });
                if (executePoc) {
                    const selectedMatch = matches[0];
                    const existingSuccess = getSuccessfulPoc(postData);
                    if (existingSuccess) {
                        activeEvent = await persistOutboxRouteTransition(
                            activeEvent,
                            'apply_poc',
                            'completed',
                            {
                                completed_at: new Date().toISOString(),
                                reused_run_id: existingSuccess.run_id,
                                status: existingSuccess.status
                            },
                            supabase
                        );
                        console.log(`[Agent SDK] Reused successful POC result: ${existingSuccess.run_id}`);
                        return { event: activeEvent, postData, classificationResult };
                    }

                    activeEvent = await persistOutboxRouteTransition(
                        activeEvent,
                        'apply_poc',
                        'in_progress',
                        { started_at: new Date().toISOString(), application_case: selectedMatch.title },
                        supabase
                    );
                    console.log('\n[Phase 3] 🧪 Generating and executing the highest-scoring POC...');
                    let pocResult;
                    try {
                        pocResult = await runPocWorkflow({
                            postData,
                            enrichedContext: enrichedData,
                            applicationCase: selectedMatch
                        }, {
                            supabaseClient: supabase
                        });
                    } catch (pocError) {
                        activeEvent = await persistOutboxRouteTransition(
                            activeEvent,
                            'apply_poc',
                            'failed',
                            { failed_at: new Date().toISOString(), error: pocError.message },
                            supabase
                        );
                        throw pocError;
                    }

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

                    console.log(`✅ POC result stored (run_id=${pocResult.run_id}, status=${pocResult.status}).`);
                    if (pocResult.execution) {
                        console.log(pocResult.execution.stdout || '(no stdout)');
                        if (pocResult.execution.stderr) console.error(pocResult.execution.stderr);
                    }
                    if (pocResult.status !== 'success') {
                        throw new Error(`POC execution finished with status: ${pocResult.status}`);
                    }
                } else {
                    console.log('\n💡 POC proposal only. Re-run without --propose-only to generate and execute it.');
                }
            } else {
                console.log('✅ No matching project need found; no POC was generated automatically.');
            }
        } catch (err) {
            throw new Error(`Opportunity Matcher / POC workflow failed: ${err.message}`, { cause: err });
        }
    } else {
        console.log('\n[Phase 2] 📝 Content Fast-Track');
        console.log('💡 [Agent Prompt]: This item does not require a code POC. Ask the user if they want you to draft a social media post or summarize it.');
    }

    console.log(`[Agent SDK] Completed in ${Date.now() - startedAt}ms.`);
    return { event: activeEvent, postData, classificationResult };
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMainModule) {
    const args = process.argv.slice(2);
    const outboxId = args.find(arg => !arg.startsWith('--'));
    analyzeItem(outboxId, { executePoc: !args.includes('--propose-only') })
        .catch(error => {
            console.error('❌ [Agent SDK] Analysis failed:', error.message);
            process.exitCode = 1;
        });
}
