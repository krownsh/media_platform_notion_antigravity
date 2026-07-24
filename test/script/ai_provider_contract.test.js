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
const packageManifest = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));

test('Gemini SDK and fallback paths are removed', () => {
    assert.equal(packageManifest.dependencies['@google/genai'], undefined);
    assert.doesNotMatch(aiServiceSource, /GoogleGenAI|analyzeWithGoogle|googleApiKey|gemini/i);
    assert.doesNotMatch(categoryProcessorSource, /googleApiKey|genAI|gemini/i);
});

test('AI analysis only accepts a complete JSON object', () => {
    assert.match(aiServiceSource, /JSON\.parse\(aiText\.trim\(\)\)/);
    assert.doesNotMatch(aiServiceSource, /lastIndexOf\('}'\)|match\(\/\{\[\\s\\S\]\*\}\//);
    assert.match(aiServiceSource, /throw new Error\(`MiniMax returned invalid JSON:/);
});
