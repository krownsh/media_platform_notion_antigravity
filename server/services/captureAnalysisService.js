import { aiService } from './aiService.js';
import { categoryProcessor } from './categoryProcessor.js';

function isSocialPlatform(platform) {
    return platform === 'threads' || platform === 'twitter';
}

function isTextPlatform(platform) {
    return ['generic', 'unknown', 'github', 'notion', 'youtube', 'instagram', 'facebook'].includes(platform);
}

function boundedError(error) {
    return String(error?.message || error || 'Unknown analysis error').slice(0, 1000);
}

/**
 * Restores the pre-queue URL analysis contract inside the background worker.
 * Analysis failures intentionally do not fail the capture: Hermes can resume
 * the base-analysis stage later with the persisted source.
 */
export async function analyzeCapturedUrl(data, dependencies = {}) {
    const category = dependencies.categoryProcessor || categoryProcessor;
    const ai = dependencies.aiService || aiService;
    const logger = dependencies.logger || console;
    const platform = data?.platform || 'generic';
    const analysis = { ...(data?.analysis || {}), primary_category: data?.analysis?.primary_category || 'other' };
    const errors = [];

    try {
        analysis.primary_category = await category.classify(data?.content || '');
    } catch (error) {
        errors.push({ stage: 'category', message: boundedError(error) });
        logger.warn?.('[CaptureAnalysis] Category classification failed:', boundedError(error));
    }

    try {
        let aiResult = null;
        if (isSocialPlatform(platform) && data?.full_json) {
            aiResult = await ai.analyzeThreadsPost(data.full_json);
        } else if (isTextPlatform(platform) && data?.content) {
            aiResult = await ai.analyzeGenericPost(data);
        }

        if (aiResult) {
            analysis.summary = aiResult.summary;
            analysis.raw = aiResult.raw;
            analysis.tags = aiResult.structured?.tags || [];
            analysis.topics = aiResult.structured?.topics || [];
        } else if (data?.content) {
            throw new Error('AI analysis returned no results');
        }
    } catch (error) {
        errors.push({ stage: 'summary', message: boundedError(error) });
        logger.warn?.('[CaptureAnalysis] URL analysis failed:', boundedError(error));
    }

    data.analysis = analysis;
    return {
        data,
        baseAnalysis: {
            status: errors.length === 0 ? 'completed' : 'pending',
            source: 'capture_ai',
            errors
        }
    };
}

