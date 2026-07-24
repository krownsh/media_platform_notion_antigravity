# n8n → `/api/process` 安全 Capture 設定

日期：2026-07-24  
適用範圍：手機分享 URL 的 n8n Capture Gateway

## 目標

n8n 不再傳送或決定 `userId`。它只用專用 API key 證明自己是受信任的 Capture Gateway；後端再以 server-side mapping 決定這筆收藏屬於哪個 Supabase user。

```text
手機 → n8n Webhook（Webhook 自身驗證）
     → POST /api/process + x-api-key（n8n 身分）
     → Backend 以 MEDIA_API_KEY_USER_ID 決定 user_id
     → Supabase
```

這不是 Supabase service-role key，也不要把 service-role、Supabase JWT 或 `userId` 放進 n8n request body。

## 1. 後端部署環境設定

在 **後端服務所在機器** 的 `server/.env` 設定：

```dotenv
# 為 n8n 產生的高熵隨機密鑰；不要提交到 Git。
MEDIA_API_KEY=replace-with-a-long-random-secret

# Authentication → Users 中，接收手機收藏的那個帳號 UUID。
MEDIA_API_KEY_USER_ID=00000000-0000-0000-0000-000000000000
```

取得 UUID：到 Supabase Dashboard 的 **Authentication → Users**，複製你的使用者 `id`。這個 mapping 表示「此 n8n Capture Gateway 送進來的收藏，一律屬於此帳號」。

密鑰可在 Mac Terminal 產生，例如：

```bash
openssl rand -base64 48
```

設定後重啟 backend。若 API key 正確但沒有 `MEDIA_API_KEY_USER_ID`，`/api/process` 會回 `503 Capture API key is not mapped to a user`，不會寫入未知帳號。

## 2. n8n Credential

在 n8n 新增一個 **Header Auth** credential：

| 欄位 | 值 |
|---|---|
| Name | `Media Capture Backend` |
| Header Name | `x-api-key` |
| Header Value | 與後端 `MEDIA_API_KEY` 完全相同的密鑰 |

Credential 要由 n8n 的加密 credential store 保存；不要把 key 寫進 Code node、workflow JSON、通知訊息或 Git。

## 3. HTTP Request 節點修改

將既有呼叫 `/api/process` 的 HTTP Request node 改成：

| 設定 | 值 |
|---|---|
| Method | `POST` |
| URL | `https://<你的-backend>/api/process` |
| Authentication | 選取 `Media Capture Backend` Header Auth credential |
| Send Headers | 開啟，加入 `x-correlation-id`：`={{ $json.correlation_id }}` |
| Send Body | 開啟，Content Type：JSON |
| JSON Body | `={{ { url: $json.normalized_url } }}` |
| Timeout | 大於 crawler 平均執行時間；建議至少 60 秒 |
| Retry on Fail | 關閉，或最多一次且使用**同一個** `correlation_id` |

如果前段尚未產生正規化欄位，JSON Body 可改為：

```javascript
={{ { url: $json.url } }}
```

必須移除的舊 body：

```json
{
  "url": "...",
  "userId": "..."
}
```

新的 request body 永遠只有來源資料；目前最小契約是：

```json
{
  "url": "https://example.com/post"
}
```

## 4. 建議 workflow 順序

```text
Webhook
→ Code：驗證／正規化 URL、產生 correlation_id
→ Respond to Webhook：accepted + correlation_id
→ HTTP Request：POST /api/process（Header Auth credential）
→ IF：依 HTTP status 分流
→ 通知／記錄
```

Webhook 本身仍需有獨立的 secret、Basic Auth 或 tunnel source restriction；`x-api-key` 只負責 n8n → Backend 這一跳。

## 5. 驗收

部署後先以 n8n 的 Execute Step 測一筆公開網址，確認：

1. Request body 沒有 `userId`。
2. Request header 有 `x-api-key`，但 Execution log／通知內容不顯示其值。
3. Response header 有相同的 `x-correlation-id`。
4. 成功時回既有 `{ source, data }`；一般網站降級時可回 `202`；核心平台 crawler 失敗可回 `500`。
5. Supabase 的 `collection_posts.user_id` 等於 `MEDIA_API_KEY_USER_ID`，而不是 n8n body 內容。

| HTTP 狀態 | 意義 | 處理 |
|---:|---|---|
| 200 | 正常擷取並入庫 | 取 `data.dbId`，記錄完成 |
| 202 | 一般網址降級為連結保存 | 通知／標為 degraded，不盲目重爬 |
| 401 | Key 缺失或錯誤 | 檢查 n8n credential 與 backend `MEDIA_API_KEY` |
| 503 | API key 沒有 user mapping | 設定 `MEDIA_API_KEY_USER_ID`、重啟 backend |
| 500 | 核心 crawler 或完整儲存失敗 | 保存 correlation id，依失敗類型通知或有限重試 |

## 6. 多帳號的後續做法

目前是一把 capture key 對應一個 owner，適合個人 Vault。未來多帳號時，應建立 server-side `api_callers`／`capture_clients` table，讓每把已雜湊的 API key 對應一個 `user_id` 與權限範圍；仍不能讓 n8n body 自行指定 user。
