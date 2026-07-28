# Stage C Content Studio deployment

## Purpose

This deployment creates the storage required to finish `quick_rewrite` and `translate_localize` routes:

- `content_assets`: one draft asset per user, source, and output format.
- `content_revisions`: immutable AI or user revisions, protected by an idempotency key.
- `content_evidence_links`: source and optional validated POC evidence.
- `store_content_draft(...)`: a service-role-only, `SECURITY INVOKER` RPC that writes the asset, revision, and evidence in one database transaction.

All tables have RLS, tenant ownership policies, and `created_at` / `updated_at`. No browser code receives the service-role key.

## Deploy once

1. In Supabase Dashboard, select the intended project and open **SQL Editor**.
2. Open [`database/deployments/stage_c_content_studio.sql`](../database/deployments/stage_c_content_studio.sql), copy its complete contents, paste it into SQL Editor, and run it once.
3. Do not re-run a partially edited version. If the editor reports an error, stop and copy the full error output back to the agent.

The repository does not currently have Supabase CLI installed, so this follows the existing `database/deployments/` manual-deployment convention.

## Hotfix for deployments completed before 2026-07-29

The first Stage C SQL revision left the `revision_number` result column unqualified inside the PL/pgSQL function. PostgreSQL therefore rejects the first draft write with `column reference "revision_number" is ambiguous`.

If you already ran the original Stage C file, run the complete contents of [`database/deployments/stage_c_content_studio_hotfix_001.sql`](../database/deployments/stage_c_content_studio_hotfix_001.sql) once in Supabase SQL Editor. It only replaces the function; it does not delete tables or data.

## Verify after deployment

Run these read-only checks in SQL Editor:

```sql
select to_regclass('public.content_assets') as content_assets_table;
select to_regclass('public.content_revisions') as content_revisions_table;
select to_regclass('public.content_evidence_links') as content_evidence_links_table;

select routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name = 'store_content_draft';

select grantee, privilege_type
from information_schema.role_routine_grants
where routine_schema = 'public'
  and routine_name = 'store_content_draft'
order by grantee, privilege_type;
```

Expected: all three tables and the function exist; only `service_role` has `EXECUTE` on the function.

## Run the content routes

After the SQL checks pass, process a routed source.

Windows PowerShell:

```powershell
npm run agent:content -- ca45f652-9f38-4f80-9cae-579a1ad45040
```

macOS Terminal:

```bash
npm run agent:content -- ca45f652-9f38-4f80-9cae-579a1ad45040
```

The command generates drafts with the existing MiniMax provider, then persists each pending content route. It reuses the source/route idempotency key, so an interrupted retry does not create a duplicate revision. When all planned routes are terminal, the outbox changes to `sent`; otherwise it stays `pending`.
