# PM2 常駐程序

這個設定只啟動兩個常駐程序：

- `media-collection-server`：既有 `server/index.js` API server
- `media-collection-capture-worker`：既有 `worker:capture` capture worker

API port 不在這裡設定，會繼續使用 `server/.env` 的 `PORT`。

## 啟動

在專案根目錄執行：

```bash
pm2 start pm2/ecosystem.config.cjs
pm2 status
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
