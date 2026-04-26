/**
 * batchProcessor.js
 * 批量分類器：掃描缺少 primary_category 的舊資料，批量送 LLM 補充分類。
 * 參考 fieldtheory-cli 的 Batch Classifier 設計（每批次處理固定數量，節省 Token）。
 */

import { supabase } from '../supabaseClient.js';
import { classifyByRules } from './categoryRules.js';
import { aiService } from './aiService.js';

const BATCH_SIZE = 10; // 每批次處理筆數（對齊 fieldtheory-cli 的 50，此處較保守）

/**
 * batchClassify
 * 主函式：掃描無分類記錄並批量處理
 * @param {object} options
 * @param {boolean} options.ruleOnly - 若為 true，僅使用 Rule-based 分類（跳過 LLM），速度快且免費
 * @param {number} options.limit - 本次最多處理筆數（預設 100）
 */
export async function batchClassify({ ruleOnly = false, limit = 100 } = {}) {
    console.log('[BatchProcessor] 開始批量分類任務...');

    // 1. 查詢缺少 primary_category 的 post_analysis 記錄（含 post 的 content）
    const { data: records, error } = await supabase
        .from('post_analysis')
        .select('id, post_id, summary, posts(content, full_json)')
        .is('primary_category', null)
        .limit(limit);

    if (error) {
        console.error('[BatchProcessor] 查詢失敗:', error.message);
        throw error;
    }

    if (!records || records.length === 0) {
        console.log('[BatchProcessor] ✅ 無待分類記錄，任務結束。');
        return { processed: 0, total: 0 };
    }

    console.log(`[BatchProcessor] 共找到 ${records.length} 筆待分類記錄。`);

    let processed = 0;
    let failed = 0;

    // 2. 分批處理
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
        const batch = records.slice(i, i + BATCH_SIZE);
        console.log(`[BatchProcessor] 處理批次 ${Math.floor(i / BATCH_SIZE) + 1}（${batch.length} 筆）...`);

        for (const record of batch) {
            try {
                const { categoryProcessor } = await import('./categoryProcessor.js');
                const content = extractContent(record);

                // 使用動態分類處理器（支援 Rule + AI Fallback + DB Configs）
                console.log(`[BatchProcessor] 分析中 record:${record.id}...`);
                const category = await categoryProcessor.classify(content, !ruleOnly);

                console.log(`[BatchProcessor] 分類結果 record:${record.id} -> ${category}`);

                // 3. 更新 primary_category
                const { error: updateError } = await supabase
                    .from('post_analysis')
                    .update({ primary_category: category })
                    .eq('id', record.id);

                if (updateError) {
                    console.warn(`[BatchProcessor] 更新失敗 ${record.id}:`, updateError.message);
                    failed++;
                } else {
                    processed++;
                }
            } catch (err) {
                console.error(`[BatchProcessor] 處理記錄 ${record.id} 時發生錯誤:`, err.message);
                failed++;
            }
        }

        // 批次間短暫等待，避免過度佔用 DB 連線
        if (i + BATCH_SIZE < records.length) {
            await sleep(200);
        }
    }

    console.log(`[BatchProcessor] ✅ 任務完成：成功 ${processed} 筆，失敗 ${failed} 筆。`);
    return { processed, failed, total: records.length };
}

// --- 輔助函式 ---

/**
 * 從 record 中提取可用於分類的文字內容
 */
function extractContent(record) {
    // 優先使用 post content
    if (record.posts?.content) return record.posts.content;
    // 備援：從 full_json 中取 main_text
    if (record.posts?.full_json) {
        try {
            const json = typeof record.posts.full_json === 'string'
                ? JSON.parse(record.posts.full_json)
                : record.posts.full_json;
            const mainPost = Array.isArray(json) ? json[0] : json;
            return mainPost?.main_text || '';
        } catch {
            return '';
        }
    }
    return '';
}

/**
 * 嘗試從現有 summary（JSON object）中提取 primary_category
 */
function extractCategoryFromSummary(summary) {
    if (!summary) return null;
    try {
        const data = typeof summary === 'string' ? JSON.parse(summary) : summary;
        return data?.primary_category || null;
    } catch {
        return null;
    }
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
