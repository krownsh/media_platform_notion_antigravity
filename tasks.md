```markdown
# 開發任務清單 (Development Checklist)

## Phase 1: 專案初始化與基礎架構
- [ ] **初始化 Vite + React 專案**
    - [ ] 建立專案，確認使用 JavaScript (非 TS)。
    - [ ] 設定 TailwindCSS 或基礎樣式庫。
    - [ ] 設定 `src` 目錄結構。
- [ ] **Redux & Saga 設定**
    - [ ] 安裝 `@reduxjs/toolkit`, `redux-saga`, `react-redux`。
    - [ ] 建立 `store/index.js`, `rootReducer`, `rootSaga`。
    - [ ] 建立基礎的 `postsSlice` 與 `collectionsSlice`。
- [ ] **Supabase 整合**
    - [ ] 建立 Supabase 專案。
    - [ ] 在 `src/api/supabaseClient.js` 中初始化客戶端。
    - [ ] 設定 `.env` 環境變數。

## Phase 2: 資料庫設計 (Schema Agent)
- [ ] **SQL Schema 撰寫與執行**
    - [ ] 撰寫 `posts`, `post_media`, `post_comments`, `post_analysis`, `post_snapshot` 表格的 SQL (含 `DROP IF EXISTS`)。
    - [ ] 撰寫 `collections`, `collection_post_map`, `user_annotations` 表格的 SQL。
    - [ ] 建立與 `auth.users` 的 UUID 關聯。
    - [ ] 為每個 Table 與 Column 添加 SQL 註解說明用途。
    - [ ] 在 Supabase SQL Editor 執行並確認無誤。

## Phase 3: 核心資料獲取系統 (Orchestrator & Agents)
- [ ] **Social API Service (第一層策略)**
    - [ ] 建立 `services/socialApiService.js`。
    - [ ] 實作 `fetchInstagramPost(url)`, `fetchFacebookPost(url)` 等 (需處理 Token/Auth 邏輯)。
    - [ ] 定義統一回傳格式介面 (Unified Post Object)。
- [ ] **Crawler Service (第二層備援)**
    - [ ] 安裝 Puppeteer 或 Playwright。
    - [ ] 建立 `services/crawlerService/browser.js`：設定 Headless 模式與 User-Agent (Mobile/Desktop)。
    - [ ] 實作 `crawlPost(url, platform)`：
        - [ ] 處理 Cookies/Session (選用)。
        - [ ] 截圖功能 (全頁/長截圖)。
        - [ ] 抓取原始 HTML。
- [ ] **Platform Parsers (解析器)**
    - [ ] 建立 `services/crawlerService/parsers/`。
    - [ ] 針對每個平台 (IG, FB, X, Threads) 實作 `primaryParser` (Desktop) 與 `mobileParser` (Mobile Web)。
    - [ ] 實作 DOM 解析邏輯：提取內文、圖片 URL、留言。
- [ ] **Platform Router / Orchestrator**
    - [ ] 建立 `services/orchestrator.js`。
    - [ ] 實作邏輯：`收到 URL` -> `判斷平台` -> `嘗試 API` -> `失敗/缺資料` -> `啟動 Crawler` -> `正規化資料` -> `回傳`。

## Phase 4: AI 服務與資料處理
- [ ] **AI Service 抽象層**
    - [ ] 建立 `services/aiService.js`。
    - [ ] 實作 `summarizePost(postData)` (回傳 Mock 資料或接 LLM API)。
    - [ ] 實作 `extractTopics(postData)`。
    - [ ] 實作 `rewriteContent(postData, targetPlatform)`。
- [ ] **Saga 流程整合**
    - [ ] 撰寫 `fetchPostSaga`：串接 Orchestrator -> 寫入 Supabase -> 觸發 AI 分析 -> 更新 DB。

## Phase 5: 前端 UI/UX 實作
- [ ] **URL 輸入與載入狀態**
    - [ ] 製作貼文網址輸入框元件。
    - [ ] 顯示載入中動畫 (區分 API 請求中 / 爬蟲運作中)。
- [ ] **資料集 (Collection) 與卡片視圖**
    - [ ] 製作 `PostCard` 元件 (顯示截圖、摘要、標籤)。
    - [ ] 製作 `CollectionBoard` 元件 (看版模式)。
- [ ] **拖拉互動 (Drag & Drop)**
    - [ ] 整合 `dnd-kit` 或 `react-beautiful-dnd`。
    - [ ] 實作卡片排序與跨資料集移動。
    - [ ] 更新 Redux state 並同步回 Supabase (`collection_post_map`)。
- [ ] **貼文詳情與閱讀模式**
    - [ ] 點擊卡片展開 Modal 或跳轉詳情頁。
    - [ ] 顯示完整備份內容 (文字 + 媒體 + 留言)。
    - [ ] 顯示 AI 分析結果 (Insights)。

## Phase 6: 註記、收藏與再創作
- [ ] **使用者註記功能**
    - [ ] 實作對貼文或資料集的 Highlight/Note 功能。
- [ ] **再創作 (Remix) 流程**
    - [ ] UI 介面：選擇貼文 -> 選擇目標風格 (IG/X) -> 點擊生成。
    - [ ] 呼叫 `aiService.rewriteContent` 並顯示結果。
    - [ ] 預留 "Share to Social" 按鈕 (僅需 console.log 資料結構)。

## Phase 7: 測試與文件
- [ ] **整合測試**：測試從 URL 輸入到資料入庫的完整流程 (Happy Path & Fallback Path)。
- [ ] **更新文件**：根據實作細節更新 `README.md` 與 `agents.md`。

## 後續優化與已知問題修復
- [ ] **修正內容擷取：支援內文連結提取**
    - **解決方案**：更新 `threadsParser.js` 與 `twitterParser.js`，增加 Regex 匹配或 DOM `<a>` 標籤篩選，確保內文中的外部連結能被獨立識別並存儲。
    - **思考**：許多知識型貼文的核心價值在於其引用的連結（如報導、論文），若遺失連結則 AI 分析的精準度會大幅下降。
- [ ] **修復併發競爭：支援多連結同時處理**
    - **解決方案**：在後端 Orchestrator 引入任務隊列，並確保 `browser.js` 採用 `BrowserContext` 隔離。
    - **詳細方案參照**：[docs/concurrency_strategy.md](./docs/concurrency_strategy.md)
    - **思考**：當用戶一次貼上多個貼文時，目前系統可能因共用單一爬蟲實例或全域變數導致資料被覆蓋（Race Condition），需實作隔離處理。
- [ ] **增強 UX：實作擷取失敗的 SnackBar 反饋**
    - [ ] **解決方案**：在前端 `UrlInput.jsx` 或 `Layout.jsx` 中整合全域通知組件，並在 Saga 的 `fetchPostFailure` 動作中觸發顯示錯誤訊息（如：解析失敗、網址無效）。
    - [ ] **思考**：爬蟲行為具備高度不確定性（受反爬蟲策略影響），必須提供明確的視覺反饋供用戶知曉失敗原因，而非讓 UI 停留在載入狀態。
```