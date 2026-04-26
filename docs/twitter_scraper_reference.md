# Twitter (X) Scraper 技術參考手冊

本文件旨在說明本專案中 Twitter (X) 貼文抓取功能的實作技術細節，方便開發團隊成員快速理解與維護。

## 1. 核心設計思路 (Core Concept)

專案不使用昂貴的官方 Twitter API，而是模擬瀏覽器行為，透過 Twitter 的 **Guest Token 代理機制** 直接與其內部的 **GraphQL API** 進行互動。

*   **優點**：不需使用者登入（免 Cookie）、不需官方 API Key、穩定性高、延遲低。
*   **特性**：目前僅實作單一「主貼文」抓取，不包含留言。

## 2. 獲取 Guest Token (Authentication)

Twitter 的 API 呼叫需要兩個關鍵 Header：
1.  **Bearer Token**：這是一個固定的全域公共 Token（對所有 Twitter 網頁訪客一致）。
2.  **x-guest-token**：動態生成的臨時訪客 Token。

### 獲取流程：
*   **Endpoint**: `POST https://api.twitter.com/1.1/guest/activate.json`
*   **Headers**: 需要帶上固定的 `Authorization: Bearer AAAAA...`
*   **回傳**: `{ "guest_token": "123456789..." }`

---

## 3. GraphQL 貼文抓取 API

取得 Guest Token 後，我們調用以下 GraphQL 端點來獲取貼文原始資料：

*   **Endpoint**: `GET https://api.x.com/graphql/kLXoXTloWpv9d2FSXRg-Tg/TweetResultByRestId`
*   **主要參數 (Variables)**:
    *   `tweetId`: 從 URL 解析出的貼文唯一 ID。
    *   `includePromotedContent`: 是否包含推廣內容。
    *   `withBirdwatchNotes`: 是否包含社群筆記。

### 必要 Headers:
```http
Authorization: Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAA... (固定值)
x-guest-token: [動態獲取的 Token]
User-Agent: Mozilla/5.0...
```

---

## 4. 資料欄位映射 (Data Mapping)

後端會解析回傳的複雜 JSON，將其正規化為以下結構：

| 欄位 | 來源路徑 (GraphQL) | 說明 |
| :--- | :--- | :--- |
| **Content** | `result.legacy.full_text` | 貼文內文（已過濾 t.co 短網址） |
| **Author** | `result.core.user_results.result.legacy.name` | 顯示名稱 |
| **Handle** | `...screen_name` | 帳號名稱 (@handle) |
| **Avatar** | `...profile_image_url_https` | 使用者頭像 |
| **PostedAt** | `result.legacy.created_at` | 原始發文時間 |
| **Images** | `result.legacy.entities.media` | 媒體圖片 URL 陣列 |

---

## 5. 如何在專案中呼叫

在服務層中，您可以直接透過 `orchestrator` 或 `twitterCrawler` 模組來使用此功能。

### 後端範例：
```javascript
import { scrapeTwitterPost } from './services/crawlerService/twitterCrawler.js';

const url = "https://x.com/username/status/18815123456789";
const postData = await scrapeTwitterPost(url);

console.log(postData.content); // 顯示貼文內文
console.log(postData.images);  // 顯示圖片陣列
```

---

## 6. 已知限制 (Limitations)

1.  **無留言抓取**：目前版本不包含回覆串。
2.  **僅限公開內容**：無法抓取設為「私人 (Protected)」的帳號貼文。
3.  **速率限制 (Rate Limit)**：Guest Token 有調用頻率限制，若遇到 `429 Too Many Requests`，需等待過期或更換執行 IP。

---

## 7. 維護與除錯
*   **檔案路徑**：`server/services/crawlerService/twitterCrawler.js`
*   **QueryId 變更**：Twitter 偶爾會更新其 GraphQL 的 `queryId`（目前的 URL 中的 `kLXoXTloWpv9d2FSXRg-Tg`），若 API 突然失效，通常只需從瀏覽器開發者工具 (Network 面板) 找到最新的 ID 並更新代碼即可。
