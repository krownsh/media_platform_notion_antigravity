import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const skillPath = path.join(root, 'hermes', 'skills', 'owner-guided-media-workflow', 'SKILL.md');
const mediaCrawlSkillPath = path.join(root, 'hermes', 'skills', 'my-mediacrawl-skill', 'SKILL.md');
const agentPath = path.join(root, 'hermes', 'skills', 'owner-guided-media-workflow', 'agents', 'openai.yaml');
const legacyAgentPath = path.join(root, 'hermes', 'skills', 'my-mediacrawl-skill', 'agents', 'openai.yaml');

test('the canonical skill makes the current phase and one safe next action explicit', () => {
    const skill = fs.readFileSync(skillPath, 'utf8');
    const agent = fs.readFileSync(agentPath, 'utf8');
    const legacyAgent = fs.readFileSync(legacyAgentPath, 'utf8');

    for (const requirement of [
        '目前階段', '為什麼現在在這裡', '唯一下一步',
        '原始來源', '候選', '正式知識', '明確接受',
        '部分擷取', '以目前來源建立候選', 'multiple Topics',
        '貼文學習筆記', 'Library', 'POC', '部署',
        'media-collection-server', 'post_id', 'JSON walls',
        'Knowledge\\n+Space'
    ]) {
        assert.match(skill, new RegExp(requirement));
    }
    assert.match(skill, /No automatic process may accept/);
    assert.doesNotMatch(skill, /agent:vault-note|npm run agent:/);
    assert.doesNotMatch(skill, /Claude-Obsidian/);

    const legacyEntry = fs.readFileSync(mediaCrawlSkillPath, 'utf8');
    assert.match(legacyEntry, /no workflow rules of its own/);
    assert.match(legacyEntry, /\$owner-guided-media-workflow/);
    assert.match(legacyEntry, /canonical skill wins/);
    assert.doesNotMatch(legacyEntry, /目前階段|agent:vault-note|npm run agent:/);
    assert.match(agent, /owner-guided-media-workflow/);
    assert.match(legacyAgent, /\$owner-guided-media-workflow/);
});
