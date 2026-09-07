import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(currentFile), '..', '..');
const aiServiceSource = fs.readFileSync(
    path.join(projectRoot, 'server', 'services', 'aiService.js'),
    'utf8'
);
const categoryProcessorSource = fs.readFileSync(
    path.join(projectRoot, 'server', 'services', 'categoryProcessor.js'),
    'utf8'
);
const serverSource = fs.readFileSync(path.join(projectRoot, 'server', 'index.js'), 'utf8');
const remixPanelSource = fs.readFileSync(path.join(projectRoot, 'src', 'components', 'RemixPanel.jsx'), 'utf8');
const packageManifest = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));

test('server has no callable LLM provider', () => {
    assert.equal(packageManifest.dependencies['@google/genai'], undefined);
    assert.match(aiServiceSource, /AI_PROVIDER_RETIRED_CODE = 'HERMES_AGENT_REQUIRED'/);
    assert.doesNotMatch(aiServiceSource, /api\.minimax|MINIMAX_API_KEY|fetch\(/i);
    assert.doesNotMatch(categoryProcessorSource, /minimaxApiKey|analyzeWithMinimax/i);
});

test('AI entry points fail explicitly for Hermes handling', () => {
    assert.match(aiServiceSource, /async analyzeThreadsPost\(\) \{\s*throw new AiProviderRetiredError\(\);/);
    assert.match(aiServiceSource, /async generateStructuredJSON\(\) \{\s*throw new AiProviderRetiredError\(\);/);
    assert.match(serverSource, /status\(503\).*HERMES_AGENT_REQUIRED/s);
    assert.doesNotMatch(remixPanelSource, /MiniMax|minimax-m2\.7/);
    assert.match(remixPanelSource, /Hermes Codex agent/);
});

test('retired AI service never attempts provider work', async () => {
    const { aiService, AI_PROVIDER_RETIRED_CODE } = await import('../../server/services/aiService.js');
    await assert.rejects(
        () => aiService.analyzeGenericPost({ content: 'test' }),
        (error) => error.code === AI_PROVIDER_RETIRED_CODE
    );
});
