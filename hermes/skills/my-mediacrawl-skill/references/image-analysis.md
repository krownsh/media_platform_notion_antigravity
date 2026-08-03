# Image analysis contract

Use one JSON object for all materialized files in the selected outbox item.

## Fields

| Field | Required | Limit | Guidance |
| --- | --- | --- | --- |
| `summary` | Yes | 12,000 characters | State the useful factual takeaway. |
| `description` | No | 40,000 characters | Describe visible subjects, layout, and context. |
| `ocr_text` | No | 40,000 characters | Transcribe only legible text; preserve meaningful line breaks. |
| `tags` | No | 25 items, 80 characters each | Use concise retrieval labels without `#`. |
| `topics` | No | 25 items, 120 characters each | Use broader subject areas. |
| `primary_category` | No | 50 characters | Use one stable category; use `other` when uncertain. |
| `sentiment` | No | 50 characters | Use a short value such as `positive`, `neutral`, or `negative`. |

Example:

```json
{
  "summary": "A dashboard screenshot showing a completed image-upload test.",
  "description": "A dark interface with one image card and a completed result.",
  "ocr_text": "Upload complete",
  "tags": ["dashboard", "image-upload"],
  "topics": ["media collection"],
  "primary_category": "other",
  "sentiment": "neutral"
}
```

## Quality rules

- Inspect every `local_path` returned by `agent:media`.
- Distinguish visible facts from interpretation. Keep uncertain claims out of
  `ocr_text` and qualify them in `description` when useful.
- Do not identify an unknown person or infer private attributes.
- Do not include local paths, Storage credentials, tokens, or unrelated file
  contents in the JSON.
- Keep arrays deduplicated and omit empty labels.

## Successful completion

Run:

```bash
npm run agent:image-analysis -- <outbox-id> --agent <identity> --file <analysis.json>
```

Accept success only when the final JSON contains all of:

```json
{
  "ok": true,
  "analysis_id": "<uuid>",
  "outbox_id": "<uuid>",
  "status": "sent"
}
```

Do not run `agent:complete` for an image. The image-analysis command owns the
successful terminal transition.
