# PM2 常駐程序

這個設定啟動兩個常駐程序：

- `media-collection-server`：既有 `server/index.js` API server
- `media-collection-capture-worker`：既有 `worker:capture` capture worker
Hermes 不再以 PM2 常駐 polling，也不由 Capture Worker 觸發。Hermes 使用自己
的 Cron Pull；Cron gate 以 Supabase singleton lease 限制同時只跑一篇。

API port 不在這裡設定，會繼續使用 `server/.env` 的 `PORT`。

## 啟動

在 Mac 的實際部署 checkout 執行。`MEDIA_PLATFORM_PROJECT_ROOT` 必填；它必須
指向有 `server/.env` 的已部署專案，設定檔會驗證 API 與 Capture Worker 腳本都存在。

```bash
export MEDIA_PLATFORM_PROJECT_ROOT="/實際/部署/checkout/media_platform_notion_antigravity"
cd "$MEDIA_PLATFORM_PROJECT_ROOT"
git pull --ff-only origin main
npm ci
npm run build
pm2 startOrRestart pm2/ecosystem.config.cjs --update-env
pm2 status
```

若只需在已確認同一路徑更新既有程序，可執行：

```bash
export MEDIA_PLATFORM_PROJECT_ROOT="/實際/部署/checkout/media_platform_notion_antigravity"
pm2 restart media-collection-server --update-env
pm2 restart media-collection-capture-worker --update-env
```

查看輸出：

```bash
pm2 logs media-collection-server
pm2 logs media-collection-capture-worker
```

確認運作正常後，才需要選擇性保存 PM2 程序清單：

```bash
pm2 save
```
