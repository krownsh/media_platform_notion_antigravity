# 系統代理人 (System Agents) 與職責定義

本文件定義了系統中各個邏輯模組的「代理人 (Agent)」角色。開發時請依照這些角色的職責邊界進行程式碼模組化設計。

## 1. Schema Agent (資料庫架構師)
* **職責**：負責 Supabase 資料庫的所有設計與變更。
* **輸入**：前端儲存需求、業務邏輯描述。
* **輸出**：標準 SQL (PostgreSQL)，包含 Tables, Relations (Foreign Keys), Functions, RLS policies。
* **規則**：
    * 所有表格必須包含 `created_at`, `updated_at`。
    * 所有使用者資料表需透過 `user_id` (uuid) 綁定 `auth.users`。
    * JSONB 欄位需在註解中詳細說明預期結構。

## 2. Platform Router / Orchestrator Agent (調度中心)
* **職責**：資料獲取流程的總指揮。決定何時使用 API，何時使用爬蟲，並處理錯誤回退 (Fallback)。
* **邏輯流程**：
    1.  解析 URL 識別平台 (IG/FB/Threads/X)。
    2.  優先呼叫 **API Agent**。
    3.  若 API 回傳成功且資料完整 -> 結束。
    4.  若 API 失敗 (403/Rate Limit) 或資料不全 (缺留言/媒體) -> 呼叫 **Crawler Agent**。
    5.  整合資料 -> 呼叫 AI Analysis Agent -> 通知 Schema Agent 存檔。

## 3. Platform API Agents (官方渠道專員)
* **成員**：`InstagramApiAgent`, `FacebookApiAgent`, `ThreadsApiAgent`, `TwitterApiAgent`
* **職責**：處理官方 API 的認證 (Token)、請求與限流 (Rate Limiting)。
* **輸出**：`UnifiedPostObject` (統一貼文物件) 或 `PartialData` (部分資料)。
* **特點**：若遇到私人貼文或權限不足，需明確回報錯誤代碼給 Orchestrator 以觸發爬蟲。

## 4. Crawler Agent (爬蟲特工)
* **職責**：操作 Headless Browser (Puppeteer/Playwright) 模擬真人行為。
* **輸入**：URL, Platform Type, Options (是否登入/Cookie)。
* **能力**：
    * **Stealth Mode**：設定 User-Agent (優先使用 Mobile UA 以獲得輕量版頁面)，規避簡單的反爬蟲偵測。
    * **Screenshot**：擷取全頁長截圖 (`fullPage: true`)。
    * **Interaction**：自動點擊「顯示更多留言」、「展開內容」。
* **輸出**：
    * Raw HTML / DOM Elements
    * Screenshot Image (Buffer or Uploaded URL)

## 5. Parser Agent (多版本解析員)
* **職責**：從 HTML/JSON 中清洗出標準資料。
* **策略**：
    * **Mobile Parser (優先)**：針對 `m.facebook.com` 或 Mobile View 結構解析，通常較穩定。
    * **Desktop Parser (備援)**：針對標準網頁結構解析。
* **容錯**：若主 Parser 失敗，自動切換備援 Parser。

## 6. AI Analysis Agent (智慧分析師)
* **職責**：處理所有 LLM 相關任務。
* **任務**：
    * `summarize`: 產生 100 字內短摘要。
    * `tagging`: 根據內文產生 3-5 個 Hashtags。
    * `insight`: 根據留言情緒與內文，提出 2 個延伸思考點。
* **設計**：需設計成 Interface，方便未來從 Mock 替換成 Google Gemini / OpenAI。

## 7. UI/UX Agent (前端互動設計師)
* **職責**：React 前端實作與使用者體驗。
* **重點**：
    * **Drag & Drop**：確保拖拉卡片時的動畫流暢度 (Framer Motion)。
    * **Visual Feedback**：在爬蟲執行期間 (可能需 5-10 秒)，需提供明確的進度條或狀態提示 (例如：「正在啟動瀏覽器...」、「正在截圖...」)。
    * **Responsive**：確保在桌面與行動裝置上皆可瀏覽。

## 8. Content Rewriter Agent (再創作寫手)
* **職責**：將收藏的貼文重組為新內容。
* **輸入**：原始貼文內容 + 使用者選擇的風格 (e.g., "Viral Tweet", "Professional LinkedIn").
* **輸出**：新的貼文草稿 (Draft)。
* **API 介面**：預留 `shareToPlatform(platform, content)` 介面。