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
