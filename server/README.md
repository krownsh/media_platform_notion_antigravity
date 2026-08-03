# Server layout

Only runtime code and active configuration remain at this level:

- `index.js` — Express API entry point
- `supabaseClient.js` — server-only Supabase client
- `.env` / `.env.example` — local configuration; never commit real secrets
- `services/` and `prompts/` — application code

Supporting material is separated by purpose:

- `scripts/diagnostics/` — manually invoked, read-only or external-service
  diagnostics. Some scripts crawl live public URLs; do not run them in CI.
- `scripts/maintenance/` — database-changing tasks. Each requires `--confirm`.
- `fixtures/` — saved crawler/debug samples, not runtime inputs.
- `archive/` — historical scripts, temporary crawler prototypes, and retired
  configuration. These are not supported commands and must not be run against a
  live environment.

Useful checks:

```bash
node server/scripts/diagnostics/verify_supabase_connection.js
node --test test/server/index.security.test.js
```

Run the capture API and worker as separate processes after the Stage E database
deployment has been reviewed and applied:

```bash
npm start
npm run worker:capture
```

`POST /api/captures` persists an accepted request and returns HTTP 202. The
worker extracts and finalizes the source; Hermes consumes the resulting outbox
event asynchronously, so AI latency never blocks intake.

Image intake uses `POST /api/captures/images` with the raw image as the request
body, an `image/*` content type, and an encoded filename in `x-file-name`.
JPEG, PNG, WebP, and GIF are accepted up to 15 MB. The server validates the
file signature, stores the object in the private `CAPTURE_IMAGE_BUCKET`, then
enqueues a durable capture request. Apply Stage F after Stage E before enabling
this endpoint.

Stored bucket/path values are stable; browser-facing URLs are signed only while
reading `/api/posts`. Hermes can materialize an outbox item's private media into
a permission-restricted OS temporary directory. Claim the item first and keep
one identity for the whole operation:

```bash
npm run agent:claim -- <outbox-id> --agent hermes:cron:media-inbox
npm run agent:media -- <outbox-id>
```

After visually inspecting every returned file, Hermes writes a bounded JSON
result back through a service-role-only, image-outbox-scoped RPC:

```bash
npm run agent:image-analysis -- <outbox-id> --agent hermes:cron:media-inbox --file <analysis.json>
```

The JSON requires `summary` and may include `description`, `ocr_text`, `tags`,
`topics`, `primary_category`, and `sentiment`. The RPC updates only the image
post and its existing analysis row, and records an idempotent audit insight.
The CLI then marks the owned outbox item `sent` and clears its lease. Accept
success only when the command returns `ok: true` and `status: "sent"`.

If materialization, visual inspection, or write-back fails after the claim,
record the error and clear the lease with `agent:fail`. Use `agent:release` only
when a transient problem should be retried later.
