# Topic Agent MVP

## Goal

A Topic is a user-owned working context, not an AI tag. It accumulates sources,
questions, research hypotheses, POC candidates, and content angles around a
goal the user actually cares about.

## Ownership model

- A user-created Topic is immediately `active`.
- An Agent may create only an `agent_proposal` with `status = proposed`.
- A source match starts as `suggested`; it never becomes accepted without the
  user.

## First vertical slice

[`stage_c_topic_workspaces.sql`](../database/deployments/stage_c_topic_workspaces.sql)
adds `collection_topics`, `collection_topic_source_matches`, and
`collection_topic_ideas`.

`server/services/topicAgent.js` performs deterministic, explainable dry-run
matching. It does not call an LLM, write to Supabase, or create topics.

## 現行 runtime 與 MVP 的差異

後續 Stage K／M 的 Hermes／Codex preprocess 另加入了 `agent_auto` 路徑：高信心
結果會直接建立 active topic，並可能自動接受來源匹配。這與本 MVP 原本的人工確認
模型衝突，且已造成過度零碎的 topic。後續治理改造必須讓 runtime 回到：Agent 僅建立
`proposed` 候選與 `suggested` 匹配；只有使用者動作能建立 active topic 或把匹配設為
`accepted`。

## Authenticated API

All endpoints require a Supabase user JWT; n8n's capture API key cannot call
them.

- `GET /api/topics` lists the current user's topics.
- `POST /api/topics` creates an immediately active user-owned topic.
- `POST /api/topics/matches/dry-run` accepts `{ "sourceId": "…" }` and
  returns non-persistent, explainable `suggested` matches for that user's
  active topics.

The protected `/topics` workspace provides Topic creation and listing. It is
intentionally separate from post-level match acceptance.

## Next implementation steps

1. Add a user-approved action to save a suggested source match.
2. Add Topic editing and archiving actions.
3. Have the Route Agent consume accepted Topic context when it creates research,
   POC, and content work.
4. Add Agent topic-proposal jobs only after the approval UI exists.
