import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const base = path.join(root, 'hermes/skills/owner-guided-media-workflow');
const read = name => fs.readFileSync(path.join(base, name), 'utf8');
test('canonical entry resolves every reference and preserves the skill identity', () => {
 const main = read('SKILL.md');
 assert.match(main, /^---\nname: owner-guided-media-workflow\ndescription: .+\n---/);
 const links = [...main.matchAll(/\]\((references\/[^)]+)\)/g)].map(m => m[1]);
 assert.equal(new Set(links).size, 5);
 for (const link of links) assert.ok(read(link).trim().length > 100, link);
 assert.match(read('agents/openai.yaml'), /\$owner-guided-media-workflow/);
 assert.doesNotMatch(read('agents/openai.yaml'), /one source at a time/);
});
test('workflow retains agency, source provenance and capability gates', () => {
 const main = read('SKILL.md');
 const prep = read('references/preprocessing.md');
 const discussion = read('references/discussion-and-synthesis.md');
 const integration = read('references/integration-and-handoff.md');
 assert.match(main, /No automatic process may accept/);
 assert.match(main, /content creation as an optional branch/);
 assert.match(main, /multiple sources/);
 assert.match(prep, /A teaser does not establish its linked article was read/);
 assert.match(prep, /Never bypass the gate through direct database writes/);
 assert.match(discussion, /new AI additions/);
 assert.match(integration, /Do not invent endpoints/);
 assert.match(integration, /Never regenerate history or overwrite free notes/);
});
test('legacy entry remains a redirect rather than an independent workflow', () => {
 const legacy = fs.readFileSync(path.join(root, 'hermes/skills/my-mediacrawl-skill/SKILL.md'), 'utf8');
 assert.match(legacy, /no workflow rules of its own/);
 assert.match(legacy, /\$owner-guided-media-workflow/);
 assert.match(legacy, /canonical skill wins/);
});
