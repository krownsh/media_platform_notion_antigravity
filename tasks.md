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
- [x] **修正內容擷取：支援內文連結提取**
    - **解決方案**：更新 `threadsParser.js` 與 `twitterParser.js`，增加 Regex 匹配或 DOM `<a>` 標籤篩選，確保內文中的外部連結能被獨立識別並存儲。
    - **思考**：許多知識型貼文的核心價值在於其引用的連結（如報導、論文），若遺失連結則 AI 分析的精準度會大幅下降。
- [x] **修復併發競爭：支援多連結同時處理**
    - **解決方案**：在後端 Orchestrator 引入任務隊列，並確保 `browser.js` 採用 `BrowserContext` 隔離。
    - [x] **UI/UX 增強**：實作「骨架卡片」與「任務中心抽屜」以呈現佇列狀態。
    - **詳細方案參照**：[docs/concurrency_strategy.md](./docs/concurrency_strategy.md)
    - **思考**：當用戶一次貼上多個貼文時，目前系統可能因共用單一爬蟲實例或全域變數導致資料被覆蓋（Race Condition），需實作隔離處理。
- [x] **增強 UX：實作擷取失敗的 SnackBar 反饋**
    - [x] **解決方案**：在前端 `Layout.jsx` 中整合全域通知組件 `Notification.jsx`，並在 Saga 的 `catch` 動作中觸發顯示錯誤訊息。
    - [x] **思考**：爬蟲行為具備高度不確定性，提供明確的視覺反饋能顯著提升使用者信心。

## Phase 8: Field Theory 功能內化 (分類、聚合與查詢)
- [x] **分類機制 (Classification)**
    - [x] 檢視與完善 `categoryRules.js` 與 `categoryProcessor.js`，對齊 `ft classify` 的正則與邏輯判斷。
    - [x] 結合現有的 `aiService.js`，當正則無法涵蓋時自動透過 LLM 精準歸類目標標籤。
- [x] **聚合與統計 (Aggregation)**
    - [x] 擴充 `statsService.js`，實作如同 `ft categories`、`ft domains` 與 `ft stats` 的貼文數據統計。
- [x] **資料視覺與全局查詢 (Visualization & Search)**
    - [x] 完善剛建立的 `InsightPage.jsx` 儀表板 (對應 `ft viz`)，綁定 `StatCard` 與 `BarChart` 呈現數據。
    - [x] 深入實作全域的全文檢索功能 (對應 `ft search`)，與依分類條件過慮。

## Phase 9: 靜態資源本地化 & 儲存優化
- [ ] **將外部圖片轉存至內部 Storage / 資料庫**
    - [ ] 在爬蟲抓取時，自動將大頭貼 (Avatar) 與貼文圖檔 (Post Images) 下載並轉存到自有的資料庫或 Supabase Storage中。
    - [ ] 更新貼文資料儲存邏輯，以內部儲存的網址取代原平台的 CDN 網址，徹底解決 CDN 過期導致的 403 破圖問題。

## Phase 10: 介面優化與響應式設計
- [x] **響應式 Sidebar 調整**
    - [x] 在小螢幕時將 Sidebar 改為置頂導覽列 (Sticky Header)。
    - [x] 實作下拉式選單以顯示導覽選項。
    - [x] 調整小螢幕時的整體版面配置 (Main Content 寬度與 Padding)。
- [x] **各頁面內容響應式優化**
    - [x] 優化 InsightPage 在手機端的圖表與數據顯示。
    - [x] 優化 ViewAllPage 的卡片網格佈局。
    - [x] 檢查 Modal 與通知彈窗在手機端的比例。

- [x] **修復 AI 摘要 undefined 錯誤**
    - [x] **問題診斷**：在 PostDetailView 中存取  nalysis.summary 時，若 AI 服務因配置或網路問題未回傳正確物件，前端會發生運行時崩潰。
    - [x] **解決方案**：
        - 更新 server/services/aiService.js 確保在所有失敗路徑下皆回傳預設 Mock 物件。
        - 更新 server/index.js 增加對 AI 執行結果的防禦性檢查。
        - 更新前端各組件 (PostDetailView, SidebarSearch, ViewAllPage) 增加屬性安全存取與類型檢查。
```

## Phase 11: 介面細節優化與尺寸調整
- [ ] **調整 PostCard 尺寸與字體**
    - [ ] 增加卡片最大寬度 (加寬)。
    - [ ] 加大卡片內文、標籤、作者資訊等字體大小。
- [ ] **優化網格佈局以適應新尺寸**
    - [ ] 調整 `CollectionBoard` 與 `ViewAllPage` 的網格最小寬度。
    - [ ] 更新骨架卡片尺寸與主卡片保持一致。

## Phase 12: 系統架構重構與身份驗證優化
- [ ] **API 身份驗證與資料歸屬優化 (Attribution Refinement)**
    - [x] 重構 `/api/process` 與 `orchestrator.js` 以支援傳遞 `userId` 並處理後端自動存檔。 (已實作)
    - [x] 遷移前端 Saga 的資料寫入邏輯至後端，消除雙重寫入隱患。 (已實作)
    - [x] 實作 `SUPABASE_SYSTEM_USER_ID` Fallback 機制，確保 API 直接呼叫（如 Postman）仍能正確歸屬。 (已實作)

## Phase 13: Crawler-only 擷取與 `/api/process` 契約保護
- [x] **停用貼文讀取的官方 API 優先策略**
    - [x] Orchestrator 不再呼叫 `socialApiService.fetchPost()`。
    - [x] 保留 `/api/process` 的 URL、request body 與 `{ source, data }` response 契約，避免破壞 n8n。
    - [x] Threads 使用 Puppeteer／Chromium；X 保留 Guest Token＋網站內部 GraphQL 爬蟲；其他網址使用通用 Puppeteer／Chromium。
- [ ] **補齊平台專用爬蟲與解析器**
    - [ ] Instagram 專用 Chromium parser（登入牆、展開內文、輪播、留言、Reels）。
    - [ ] Facebook 專用 Chromium parser（登入狀態、Mobile/Desktop fallback、貼文與留言）。
    - [ ] YouTube 專用 Chromium parser（描述、字幕、章節、留言；不使用官方 Data API）。
    - [ ] Notion／GitHub／一般文章建立平台 parser，避免全部依賴 `innerText` 與 5000 字截斷。
    - [ ] 決定 X 是否從 Guest GraphQL 改為全 Chromium DOM 擷取；現況雖非官方 API，但不是 Chromium。
    - [ ] 移除或封存已不再用於「讀取貼文」的 `socialApiService.js`，保留發佈 API 與擷取流程的職責隔離。
- [ ] **爬蟲可靠性與資料品質**
    - [ ] 將 Puppeteer browser cache 從 `C:\Users\...\.cache\puppeteer` 遷移至 `G:\` 的專案快取區，設定 `PUPPETEER_CACHE_DIR` 並加入 `.gitignore`；遷移前先確認與清理既有 C 槽快取。
    - [ ] 補 Cookie／登入 session 管理、代理、重試退避、selector 版本化與失敗截圖。
    - [ ] 統一輸出 `UnifiedPostObject`，驗證 platform、original_url、author、content、images、comments、full_json。
    - [ ] 修正 X Article 只抓到文章 URL、沒有正文的情況。
    - [ ] 為每個平台建立 fixture 與 parser regression test。
    - [ ] 增加 `/api/process` n8n contract integration test，覆蓋成功、降級、重複 URL 與核心平台失敗。

## Phase 14: 收藏資料的 AI 行動化管線（待確認後實作）
- [ ] **保留不可變 Raw Layer**：原始爬蟲結果先完整入庫，AI 失敗不得污染或阻擋原始資料。
- [ ] **拆分同步與非同步責任**：評估讓 `/api/process` 快速完成擷取入庫，AI enrichment 改由 queue／n8n 非同步處理，避免 n8n timeout。
- [ ] **建立 Action Router**：把收藏判斷為 `archive`、`learn`、`implement`、`plan`、`strategy`、`content/remix`，並保留信心分數與判斷理由。
- [ ] **learn**：整理概念、先備知識、實作練習、驗證題與下一步學習順序。
- [ ] **implement**：提取 repo／工具／安裝方式、環境需求、最小 POC、驗收條件與風險。
- [ ] **plan**：轉成可執行任務、依賴關係、優先級、預估成本與完成定義。
- [ ] **strategy**：提取可複製流程、適用條件、反例、決策規則、KPI 與實驗設計。
- [ ] **content/remix**：提取可再利用觀點、素材、受眾、平台格式與發布草稿。
- [ ] **去重與聚類**：合併重複工具／相同 GitHub repo／相同方法，形成持續更新的 Topic Dossier。
- [ ] **人工確認閘門**：AI 可以提出建議與草稿，但安裝套件、改程式、建立專案、發文或付費操作前必須再確認。
- [ ] **改善分類資料品質**：統一繁簡標籤、修正 `summary` 內分類與 `primary_category` 欄位不一致、處理純 URL 收藏。
- [ ] **根據最近 100 筆建立初始個人路由權重**：優先處理 Agent Skills、AI 開發工具、自動化、程式實作、設計／內容工作流；投資類獨立分流。

## Phase 15: 已確認的既有缺口
- [ ] 將 Node.js 20 升級至 Node.js 22 以上；Supabase JS 已於 2026-06-30 結束 Node 20 支援，升級前需驗證 Puppeteer、Vite、n8n 呼叫與部署環境。
- [ ] 補上 `aiService.getAvailableModels()` 與 `aiService.generateImageFromPrompt()`，或移除對應無效路由。
- [ ] 移除 `ImageWorkflowPage` 的 `user-id-placeholder`，改用已驗證使用者 ID。
- [ ] 修正 `/api/process` 未驗證 caller／信任 body `userId` 的資料歸屬風險，同時提供 n8n 專用 API key 驗證。
- [ ] `/api/posts` 使用 service-role 查詢時必須依 `req.authUser.id` 過濾，避免跨使用者讀取。
- [ ] 補齊 image workflow 使用的資料表 schema 與 RLS。

## Phase 16: 統一 BrowserManager 與登入 Profile 管理
- [ ] 建立單一長生命週期 BrowserManager，集中 Chrome binary、launch args、timeout、proxy、重試、log 與 graceful shutdown。
- [ ] 每個 crawl job 建立獨立 BrowserContext／Page，不共享任務狀態。
- [ ] 將 Threads 與通用 crawler 改成 platform adapter／parser，不再各自呼叫 `puppeteer.launch()`。
- [ ] 僅對需要登入的平台建立「平台＋帳號」專屬 persistent profile，加入 profile lock 與並行保護。
- [ ] 定義 browser crash 後 context 清理、重啟、任務重試與 zombie process 偵測。
- [ ] 保留 X Guest GraphQL adapter；待 DOM crawler 穩定後再決定是否接入 BrowserManager。

## Phase 17: 語意去重、知識聚類與 Claude-Obsidian 同步
- [ ] 建立 canonical URL、platform post id、content hash 的 exact duplicate 判斷。
- [ ] 建立 semantic duplicate／related content 判斷，將相同工具、repo、方法歸入同一 Topic Cluster。
- [ ] AI 只產生相對既有 cluster 的新增觀點、差異與反例，避免重複摘要與重複任務。
- [ ] 定義 Source Post、Knowledge Item、Topic Cluster／Dossier、Action Candidate 四層資料契約。
- [ ] 用既有 100 筆資料 dry-run 聚類，人工驗證誤合併與過度拆分。
- [ ] 確認 Claude-Obsidian Vault 在 Mac 的完整路徑、目錄分類、檔名規則與 frontmatter 契約。
- [ ] 建立 read-only Markdown exporter，先輸出 preview，不直接寫正式 Vault。
- [ ] 建立 Mac Local Sync Agent，使用 sync cursor、版本、checksum、原子寫入與衝突狀態同步 Supabase → Vault。
- [ ] 保護人工筆記區塊，AI 同步只能更新 managed section，不得覆蓋本機人工編修。
- [ ] 確認 n8n 執行位置；遠端 n8n 只排程，本機 Agent 負責 filesystem，若同機才允許 n8n 直接呼叫 exporter。
- [ ] 圖片預設引用 Supabase Storage；離線附件下載列為第二階段。

## Phase 18: Mac Claude-Obsidian Vault 建置
- [x] GitHub 選型：採用 `AgriciDaniel/claude-obsidian`，不採用僅提供聊天介面的 Claudian。
- [x] 唯讀檢查 `bin/setup-vault.sh` 的主要寫入與下載行為。
- [ ] 在 Mac 確認外接碟實際掛載路徑為 `/Volumes/DevSSD`。
- [ ] clone 至 `/Volumes/DevSSD/claude-obsidian`，執行 `bash bin/setup-vault.sh`。
- [ ] clone 後先讀取 repo local `AGENTS.md`／`CLAUDE.md`，確認依賴、模式與寫入規則。
- [ ] 在 Obsidian 將該資料夾開啟為 Vault，確認 graph、CSS、community plugins 與基本 wiki scaffold。
- [ ] 選定方法論模式；本專案初步建議 PARA 作為行動管理、Topic Dossier 以 Resources／MOC 表達。
- [ ] 建立 Supabase → preview → Vault 的 Local Sync Agent，不把 service-role key 寫入 Vault。
- [ ] n8n 新增 process 後續節點：取得 postId → 觸發 Actionizer／Cluster → 寫入 sync outbox。
- [ ] 完成一筆手機分享端到端驗證：手機 → tunnel → n8n → `/api/process` → Supabase → Vault preview。

## Phase 19: 知識行動管線 Master Plan 執行里程碑
- [x] 完成手機、n8n、`/api/process`、Supabase、AI、Local Bridge、Claude-Obsidian 的完整責任切分。
- [x] 完成 exact／semantic／related 三層去重聚類設計。
- [x] 完成 Action Candidate 分數、類型、狀態與人工批准閘門設計。
- [x] 完成 Knowledge Job、Cluster、Action、Sync Outbox／State 的資料模型草案。
- [x] 完成新 API、n8n 節點、錯誤降級、安全邊界與驗收情境草案。
- [ ] Phase 0：補 `/api/process` n8n contract fixtures 與 correlation id。
- [ ] Phase 1：既有 100 筆 dry-run，產出 cluster／delta／Action Candidate 評估報告。
- [ ] Phase 2：確認 schema 後建立 Knowledge Pipeline migration 與 job worker。
- [ ] Phase 3：Mac clone／初始化 Claude-Obsidian，選定 PARA mode。
- [ ] Phase 4：建立獨立 Mac Local Vault Bridge 與 preview sync。
- [ ] Phase 5：n8n 串接 knowledge job、poll、bridge、通知。
- [ ] Phase 6：10 筆試跑後回填 100 筆，再開啟正式自動同步。
- [ ] Phase 7：知識流程穩定後，獨立重構 BrowserManager。
