import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../server/.env') });

import { supabase } from '../../server/supabaseClient.js';
import { classifyPostRoutes } from '../../server/services/routeAgent.js';
import { matchSourceToProjectNeeds } from '../../server/services/opportunityMatcher.js';
import { auditProjectDirectory } from '../../server/services/projectAuditor.js';
import { enrichContext } from '../../server/services/enrichmentService.js';

async function analyzeItem(outboxId) {
    if (!outboxId) {
        console.error('❌ Please provide an Outbox ID. Usage: node analyze-item.js <outbox_id>');
        process.exit(1);
    }

    console.log(`[Agent SDK] Analyzing outbox item: ${outboxId}...`);

    // 1. 取得資料
    const { data: event, error } = await supabase
        .from('collection_capture_outbox')
        .select(`
            *,
            collection_posts (*)
        `)
        .eq('id', outboxId)
        .single();

    if (error || !event) {
        console.error('❌ Failed to fetch outbox item:', error?.message || 'Item not found');
        process.exit(1);
    }

    const postData = Array.isArray(event.collection_posts) ? event.collection_posts[0] : event.collection_posts;
    if (!postData) {
        console.error('❌ Related post data not found for this outbox event.');
        process.exit(1);
    }

    console.log('\n[Phase 1] 🧠 Running Route Agent Classification...');
    let classificationResult;
    try {
        classificationResult = await classifyPostRoutes(postData);
        console.log('✅ Classification successful:');
        console.log(JSON.stringify(classificationResult.routes, null, 2));
    } catch (err) {
        console.error('❌ Classification failed:', err.message);
        process.exit(1);
    }

    const wantsPoc = classificationResult.routes.some(r => r.type === 'apply_poc' || r.type === 'research_content');
    
    // 2. 如果包含 apply_poc 或 research_content，跑 Matcher 之前先跑 Enrichment
    if (wantsPoc) {
        console.log('\n[Phase 1.5] 🌐 Running Enrichment (Tavily Search)...');
        try {
            const enrichedData = await enrichContext(postData);
            console.log('✅ Enrichment complete:');
            console.log(enrichedData);
            // Append enriched data to postData so Matcher can potentially use it (optional)
            postData.enriched_context = enrichedData;
        } catch (err) {
            console.error('❌ Enrichment failed:', err.message);
        }

        console.log('\n[Phase 2] 🔍 Running Opportunity Matcher (Auditing local projects)...');
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
                
                console.log('\n💡 [Agent Prompt]: Review the cases above. Ask the user if they want to execute any of these POCs.');
            } else {
                console.log('✅ No matching project needs found for this POC. You may still propose a generic test to the user.');
            }
        } catch (err) {
            console.error('❌ Opportunity Matcher failed:', err.message);
        }
    } else {
        console.log('\n[Phase 2] 📝 Content Fast-Track');
        console.log('💡 [Agent Prompt]: This item does not require a code POC. Ask the user if they want you to draft a social media post or summarize it.');
    }
}

const outboxIdArgs = process.argv.slice(2)[0];
analyzeItem(outboxIdArgs);
