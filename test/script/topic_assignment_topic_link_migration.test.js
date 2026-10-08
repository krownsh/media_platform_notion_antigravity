import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migration = new URL('../../database/deployments/stage_x_owner_guided_topic_assignment_topic_link.sql', import.meta.url);

test('accepted Topic assignment preserves compatibility and also creates an independent Topic source link', async () => {
    const sql = await readFile(migration, 'utf8');
    assert.match(sql, /insert into public\.owner_source_topic_decisions/);
    assert.match(sql, /insert into public\.owner_topics \(user_id, label, normalized_label\)/);
    assert.match(sql, /insert into public\.owner_topic_source_links \(user_id, topic_id, source_revision_id, origin_proposal_id\)/);
    assert.match(sql, /on conflict \(topic_id, source_revision_id\) do nothing/);
    assert.match(sql, /revoke all on function public\.promote_owner_review_proposal[\s\S]*from public, anon, authenticated/);
    assert.match(sql, /grant execute on function public\.promote_owner_review_proposal[\s\S]*to service_role/);
});
