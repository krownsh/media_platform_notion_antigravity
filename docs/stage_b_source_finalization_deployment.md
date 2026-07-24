# Stage B：Source Finalization + Outbox 部署說明

日期：2026-07-24  
前置條件：[`database/deployments/add_unique_constraint.sql`](../database/deployments/add_unique_constraint.sql) 已在目標環境成功套用並驗證。

## 這次會改變什麼

[`database/deployments/stage_b_source_finalization.sql`](../database/deployments/stage_b_source_finalization.sql) 會建立：

- `collection_capture_outbox`：`source.ingested.v1` 的 transactional outbox；同一 user、correlation id 與事件類型只會有一筆。
- `finalize_collection_capture(...)`：在**同一個 transaction** upsert `collection_posts`、替換 analysis/media/comments，最後寫入 outbox。
- `collection_posts.source_domains`：目前 server 已送出但舊 schema 未宣告的來源網域陣列。

此函式是 `SECURITY INVOKER`，並且只 grant 給 `service_role`；browser 的 anon/authenticated 角色沒有 execute 權限，也沒有 outbox table 存取權。

## 執行前：確認 `source_domains` 型別

早期的 `schema_aggregator.sql` 使用 JSONB；目前 Stage B 使用 `text[]`。在第一次透過 n8n 寫入前，於 SQL Editor 執行：

```sql
select data_type, udt_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'collection_posts'
  and column_name = 'source_domains';
```

預期為 `data_type = ARRAY`、`udt_name = _text`。若看到 `jsonb`，先不要發送 capture；該舊 schema 需要先做相容性轉換，否則 Stage B RPC 首次寫入可能失敗。

## 套用方式（staging 先行）

1. 先備份 staging，並確認 backend 將使用新的 service-role key。
2. 在 Supabase Dashboard 的 SQL Editor，以具管理權限帳號執行 `database/deployments/stage_b_source_finalization.sql` 全檔。
3. 確認 migration 沒有錯誤後部署這次 backend 程式。
4. 以 n8n 或已登入前端送一筆公開 URL，保留 response 的 `x-correlation-id`。

## SQL 驗收

在 SQL Editor 執行下列唯讀檢查：

```sql
select to_regclass('public.collection_capture_outbox') as outbox_table;

select routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name = 'finalize_collection_capture';

select grantee, privilege_type
from information_schema.role_routine_grants
where routine_schema = 'public'
  and routine_name = 'finalize_collection_capture'
order by grantee, privilege_type;
```

預期：table 與 function 都存在，且 execute 只授予 `service_role`（以及管理角色）。若專案的 Data API 已採用「new tables are not automatically exposed」設定，這是正確行為：browser 不需要、也不該直接存取 outbox。

接著以剛才的 correlation id 確認：

```sql
select id, user_id, aggregate_id, event_type, correlation_id, status, attempt_count, payload
from public.collection_capture_outbox
where correlation_id = '<response 的 correlation id>';
```

預期一筆 `pending`、`event_type = source.ingested.v1` 的記錄，`aggregate_id` 指向該 user 的 `collection_posts.id`。以相同 correlation id 重試時，貼文資料可更新，但 outbox 不可多出第二筆。

## 回滾

若部署前 smoke test 失敗，先停止 backend 版本升級。因 RPC 每次呼叫都在單一 transaction，失敗的 finalization 不會留下半套 post/child/outbox 寫入。已成功建立的 schema object 可在確認沒有 pending event 後，再依變更管理流程另行 drop；不要在生產環境直接清空 outbox。

## 尚未在本機執行的原因

此工作區沒有 Supabase CLI、`psql` 或已授權的 Supabase MCP 連線。本文件與 SQL 是部署來源；它不是 migration history。正式套用後應以 `supabase db pull` 或既有 migration workflow 回填正式 migration 檔，避免 schema drift。
