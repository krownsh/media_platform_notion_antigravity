import test from 'node:test';
import assert from 'node:assert/strict';

import { analyzeCapturedUrl } from '../../server/services/captureAnalysisService.js';

test('capture URL analysis stores category, summary, tags, and topics before finalization', async () => {
  const result = await analyzeCapturedUrl({
    platform: 'generic',
    content: 'An article about a useful SDK.'
  }, {
    categoryProcessor: { classify: async () => 'tool' },
    aiService: {
      analyzeGenericPost: async () => ({
        summary: 'SDK overview',
        raw: 'unused',
        structured: { tags: ['sdk'], topics: ['developer-tools'] }
      })
    }
  });

  assert.equal(result.baseAnalysis.status, 'completed');
  assert.equal(result.data.analysis.primary_category, 'tool');
  assert.equal(result.data.analysis.summary, 'SDK overview');
  assert.deepEqual(result.data.analysis.tags, ['sdk']);
});

test('capture URL analysis retains the source and defers failed AI work to Hermes', async () => {
  const result = await analyzeCapturedUrl({ platform: 'generic', content: 'source content' }, {
    categoryProcessor: { classify: async () => { throw new Error('category unavailable'); } },
    aiService: { analyzeGenericPost: async () => { throw new Error('AI unavailable'); } },
    logger: { warn() {} }
  });

  assert.equal(result.baseAnalysis.status, 'pending');
  assert.equal(result.data.analysis.primary_category, 'other');
  assert.equal(result.baseAnalysis.errors.length, 2);
});

