import { supabase } from '../supabaseClient.js';
import fs from 'fs';
import path from 'path';

export async function syncTopicsToSupabase() {
    const topicsDir = '/Volumes/DevSSD/10_Projects/Personal/media_collection/Media Knowledge/Topics';
    if (!fs.existsSync(topicsDir)) {
        console.warn('Topics directory not found:', topicsDir);
        return;
    }

    const files = fs.readdirSync(topicsDir).filter((f) => f.endsWith('.md'));
    const userId = '50984520-69ad-4e64-b9c1-503f5c1b0e63';

    // 1. Map 8-char prefixes and full UUIDs to full post IDs
    const { data: revs, error: revErr } = await supabase
        .from('collection_source_revisions')
        .select('id, post_id, created_at')
        .order('created_at', { ascending: false });

    if (revErr) {
        console.error('Failed to query collection_source_revisions:', revErr);
        return;
    }

    const postToRev = new Map();
    for (const r of revs) {
        if (!postToRev.has(r.post_id)) {
            postToRev.set(r.post_id, r.id);
            postToRev.set(r.post_id.slice(0, 8), r.id);
        }
    }

    for (const file of files) {
        const topicLabel = file.replace('.md', '');
        const content = fs.readFileSync(path.join(topicsDir, file), 'utf8');

        // Upsert topic
        let { data: topic } = await supabase
            .from('owner_topics')
            .select('id, label')
            .eq('label', topicLabel)
            .maybeSingle();

        if (!topic) {
            const { data: newTopic, error: createError } = await supabase
                .from('owner_topics')
                .insert({
                    user_id: userId,
                    label: topicLabel,
                    normalized_label: topicLabel.toLowerCase(),
                    status: 'active'
                })
                .select()
                .single();

            if (createError) {
                console.error(`Failed to create topic [${topicLabel}]:`, createError);
                continue;
            }
            topic = newTopic;
            console.log(`✅ [Created Topic] ${topicLabel} (${topic.id})`);
        }

        // Extract 8-char post IDs in markdown table
        const matches = [...content.matchAll(/｜([a-f0-9]{8})\]\]/g)].map((m) => m[1]);
        for (const prefix of matches) {
            const revisionId = postToRev.get(prefix);
            if (!revisionId) continue;

            // Check if already in owner_topic_source_links
            const { data: existing } = await supabase
                .from('owner_topic_source_links')
                .select('id')
                .eq('topic_id', topic.id)
                .eq('source_revision_id', revisionId)
                .maybeSingle();

            if (existing) continue;

            // Resolve or create proposal to satisfy foreign key
            let proposalId = null;
            const { data: packet } = await supabase
                .from('owner_review_packets')
                .select('id')
                .eq('source_revision_id', revisionId)
                .maybeSingle();

            if (packet) {
                const { data: prop } = await supabase
                    .from('owner_review_proposals')
                    .select('id')
                    .eq('packet_id', packet.id)
                    .eq('proposal_type', 'topic_assignment')
                    .maybeSingle();

                if (prop) {
                    proposalId = prop.id;
                } else {
                    const idempotencyKey = `topic-assign:${topic.id}:${revisionId}`;
                    const { data: newProp } = await supabase
                        .from('owner_review_proposals')
                        .insert({
                            user_id: userId,
                            packet_id: packet.id,
                            proposal_type: 'topic_assignment',
                            status: 'accepted',
                            idempotency_key: idempotencyKey,
                            payload: { primary_topic: topicLabel }
                        })
                        .select('id')
                        .single();
                    if (newProp) proposalId = newProp.id;
                }
            }

            if (!proposalId) {
                const { data: revRow } = await supabase
                    .from('collection_source_revisions')
                    .select('post_id')
                    .eq('id', revisionId)
                    .single();

                if (revRow) {
                    const { data: newPacket } = await supabase
                        .from('owner_review_packets')
                        .insert({
                            user_id: userId,
                            post_id: revRow.post_id,
                            source_revision_id: revisionId,
                            status: 'completed'
                        })
                        .select('id')
                        .single();

                    if (newPacket) {
                        const idempotencyKey = `topic-assign:${topic.id}:${revisionId}`;
                        const { data: newProp } = await supabase
                            .from('owner_review_proposals')
                            .insert({
                                user_id: userId,
                                packet_id: newPacket.id,
                                proposal_type: 'topic_assignment',
                                status: 'accepted',
                                idempotency_key: idempotencyKey,
                                payload: { primary_topic: topicLabel }
                            })
                            .select('id')
                            .single();
                        if (newProp) proposalId = newProp.id;
                    }
                }
            }

            if (proposalId) {
                const { error: insErr } = await supabase
                    .from('owner_topic_source_links')
                    .insert({
                        user_id: userId,
                        topic_id: topic.id,
                        source_revision_id: revisionId,
                        origin_proposal_id: proposalId
                    });

                if (!insErr) {
                    console.log(`  -> Linked ${prefix} to [${topicLabel}]`);
                }
            }
        }
    }
}

if (process.argv[1] && process.argv[1].endsWith('sync_topics_to_supabase.js')) {
    syncTopicsToSupabase()
        .then(() => {
            console.log('Topic sync completed.');
            process.exit(0);
        })
        .catch((err) => {
            console.error('Topic sync error:', err);
            process.exit(1);
        });
}
