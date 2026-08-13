# Hermes Webhook Gateway（停用保留）

這份文件只保留作為未來重新整合 Hermes Gateway 的歷史參考。

目前 media workflow 已改為純 Hermes Cron Pull：

- 專案不再發送 Hermes Webhook。
- Supabase 的 `collection_post_workflows` 是唯一工作來源。
- 舊的 `collection_hermes_dispatches`、`collection_hermes_agent_slots` 與
  Stage H/I dispatcher RPC 已由 Stage J migration 移除。
- 不再啟動 `media-collection-hermes-dispatcher` PM2 程序。

現有 Hermes Gateway route、port、HMAC secret 與
`hermes/config/webhook-route.example.yaml` **刻意不修改**，保持 dormant，
日後可接其他系統。這個 route 不再是本專案的必要依賴，也不應為了本專案
重啟或調整 Gateway。

目前排程入口：

```bash
python3 scripts/hermes/media-inbox-gate.py
```

Gate 會以 Supabase RPC 原子 claim 一篇 workflow；沒有可處理內容或已有
Hermes run 時輸出 `wakeAgent=false`。Cron 執行期間使用：

```bash
npm run agent:cron:heartbeat -- <workflow-id> --agent hermes:cron:media-inbox
npm run agent:cron:release -- <workflow-id> --agent hermes:cron:media-inbox
```

Capture Worker、私有圖片 Storage、`collection_capture_outbox` 與
`collection_post_workflows` 均屬現行流程，不得因停用 Webhook 而移除。
