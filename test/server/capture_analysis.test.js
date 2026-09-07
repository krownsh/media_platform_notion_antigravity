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

test('capture URL analysis keeps an AI title separate from a supplied source title', async () => {
  const missingTitle = await analyzeCapturedUrl({ platform: 'generic', content: 'source content' }, {
    categoryProcessor: { classify: async () => 'tool' },
    aiService: { analyzeGenericPost: async () => ({ summary: '摘要', generated_title: 'AI 產生的顯示標題', structured: {} }) }
  });
  assert.equal(missingTitle.data.analysis.generated_title, 'AI 產生的顯示標題');

  const sourceTitle = await analyzeCapturedUrl({ platform: 'generic', title: '來源標題', content: 'source content' }, {
    categoryProcessor: { classify: async () => 'tool' },
    aiService: { analyzeGenericPost: async () => ({ summary: '摘要', generated_title: '不應使用', structured: {} }) }
  });
  assert.equal(sourceTitle.data.analysis.generated_title, undefined);
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

test('capture URL analysis does not mark an empty AI summary as complete', async () => {
  const result = await analyzeCapturedUrl({ platform: 'generic', content: 'source content' }, {
    categoryProcessor: { classify: async () => 'tool' },
    aiService: { analyzeGenericPost: async () => ({ summary: '   ', structured: {} }) },
    logger: { warn() {} }
  });

  assert.equal(result.baseAnalysis.status, 'pending');
  assert.equal(result.data.analysis.summary, undefined);
  assert.match(result.baseAnalysis.errors[0].message, /no usable summary/);
});
