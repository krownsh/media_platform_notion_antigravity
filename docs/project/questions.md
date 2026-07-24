# 專案常見問題與技術重點提示 (Questions & Troubleshooting)

## 🛠️ Puppeteer 在 1Panel ARM 環境下的安裝與調試
**時間**：2026-01-05
**問題描述**：在 1Panel 的 ARM 架構伺服器中，Puppeteer 無法正常啟動，出現 `Syntax error: newline unexpected` 或 `Could not find Chrome` 報錯。

### 1. 核心原因分析
*   **架構不相容**：Puppeteer 預設下載的 Chrome 是針對 x86 架構的。在 ARM 處理器 (如 AWS Graviton, Oracle ARM) 上運行會報出語法錯誤。
*   **容器隔離性**：1Panel 預設使用 Docker 容器，在容器終端機手動 `apt-get install` 的軟體，會在容器重啟或重構時被抹除 (Ephemeral Storage)。
*   **環境變數迷蹤**：在容器化環境下，`dotenv` 有時無法正確抓到根目錄的 `.env`，導致指定的路徑失效。

### 2. 完整排錯歷程 (Debug Journey)
1.  **第一階段 (缺失)**：原本報錯找不到 Chrome。
2.  **第二階段 (架構錯誤)**：透過 `npx puppeteer install` 下載了 Chrome，但因為是 x86 編譯版，ARM 無法執行，噴出 `newline unexpected`。
3.  **第三階段 (環境隔離)**：手動進容器安裝 `chromium` 成功後，重啟伺服器導致安裝檔遺失，回到 `DEFAULT` 狀態。
4.  **第四階段 (最終修復)**：透過「自動安裝腳本」+「路徑自動偵測」解決。

### 3. 最終解決方案 (Best Practice)
*   **安裝原生 Chromium**：不要使用 Puppeteer 下載的瀏覽器，改用系統套件管理員安裝原生支援 ARM 的版本。
*   **啟動指令自動化**：為了防止容器重啟後遺失安裝物，將安裝指令寫入 1Panel 的 **「啟動指令」**。
    ```bash
    # 範例
    apt-get update && apt-get install -y chromium libnss3 ... && node server/index.js
    ```
*   **程式碼自動偵測**：在 `puppeteer.launch` 加入路徑自動偵測，優先尋找 Linux 系統執行檔。
    ```javascript
    if (fs.existsSync('/usr/bin/chromium')) {
        executablePath = '/usr/bin/chromium';
    }
    ```

### 4. 驗證指令
*   `which chromium`：確認執行檔位置。
*   `ls -l /usr/bin/chromium`：確保在 **當前容器** 內檔案確實存在。
*   查看日誌中是否有 `[ThreadsCrawler] 🛠️ Final Executable Path: "/usr/bin/chromium"`。

---

## 🤖 AI 模型使用順序與 Fallback 機制
**最後更新**：2026-01-05

### 1. 貼文總結與分析 (Analysis Chain)
目前文字分析與 remix 統一使用 MiniMax。分析嘗試 `minimax-m2.7` 與 `MiniMax-Text-01`，並要求模型回傳完整 JSON object；沒有 Google、OpenRouter 或 mock fallback。

### 2. 內容二創與圖片生成 (Remix Workflow)
* **文字改寫／remix**：由 MiniMax 處理。
* **圖片生成與圖片工作流**：目前沒有替代供應商，介面與 API 已停用；日後選定供應商時再以獨立設計重新啟用。

### 3. 如何切換模型或設定？
* 調整 `server/.env` 的 `MINIMAX_API_KEY` 與選填的 `MINIMAX_GROUP_ID`。
* 若要調整分析邏輯，核心程式碼位於 `server/services/aiService.js` 的 `analyzeThreadsPost` 函式。

---

## 🔧 環境變數 `.env` 的配置與讀取路徑
**時間**：2026-04-08
**問題描述**：確認專案是否全部統一吃根目錄的 `.env`，而沒有 `server/.env`？

### 1. 提問與解答
**提問**：現在是不是都是吃根目錄的 `.env`，而沒有 `server` 的 `.env`？
**解答**：不是的。專案目前依然維持「前端」與「後端」的環境變數分離配置，`server/.env` 仍然存在且被後端程式依賴。

### 2. 環境變數檔存放差異
*   **根目錄的 `.env` (包含 `.env.development` 等)**：僅供 **前端 (Vite)** 使用。裡面專門放置帶有 `VITE_` 前綴的公開暴露變數，例如 `VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY` 等。
*   **`server/.env`**：供 **後端 (Node.js)** 使用。這裡面包含了所有伺服器的敏感資訊（不可暴露給前端），例如 `MINIMAX_API_KEY`、Supabase `SUPABASE_SERVICE_KEY`、社群發布憑證等。

### 3. 程式碼驗證
在後端主程式 `server/index.js` 及一些腳本中，依然明確指定了要讀取這份特定路徑的設定檔：
```javascript
// 例如 server/index.js 
dotenv.config({ path: './server/.env' });

// 或是某些執行腳本
dotenv.config({ path: path.resolve(__dirname, '../.env') });
```

> [!IMPORTANT]
> 為了安全及職責分離，請勿將後端依賴的密鑰搬家到根目錄（會被前端打包工具看見），後端依舊主要讀取 `server/.env`。

---

## 🔧 前後端 `.env.example` 變數需求解析
**時間**：2026-04-08
**問題描述**：兩個 `.env.example`（根目錄與 server 目錄）分別需要填寫哪些變數？用途為何？

### 1. 根目錄 `.env.example` (前端 Vite 專用)
這個檔案為**前端介面**需要的環境變數，變數名稱都必須以 `VITE_` 開頭才能被瀏覽器讀取：
*   **`VITE_SUPABASE_URL`**：Supabase API 的專案連線網址。
*   **`VITE_SUPABASE_ANON_KEY`**：Supabase 的公開金鑰 (Anon Key)，供前端一般使用者認證及受限資料存取使用（會受 Supabase RLS 規則限制）。
*   **`VITE_API_BASE_URL`**：我們自己後端伺服器的網址。開發環境通常是 `http://localhost:3001` 或 `3501`，用來讓前端知道打哪支 API。

### 2. `server/.env.example` (後端 Node.js 專用)
這個檔案為**後端伺服器**需要的敏感資訊與環境配置，不會且**不該**暴露給前端：
*   **【伺服器基本設定】**
    *   `PORT`：後端伺服器啟動的 Port（如 3001 或 3501）。
    *   `FRONTEND_URL`：允許跨域 (CORS) 呼叫的前端網址（如 `http://localhost:5173` 或正式域名）。
*   **【Supabase 設定】**
    *   `SUPABASE_URL`：與前端相同，即 Supabase 專案網址。
    *   `SUPABASE_SERVICE_KEY`：這非常重要！這是**管理員級別的高權限金鑰 (Service Role Key)**，能夠繞過 RLS 防護，讓後端得以不受限制地將資料寫入或同步到資料庫。
*   **【AI 及爬蟲服務】**
    *   `MINIMAX_API_KEY`／`MINIMAX_GROUP_ID`：後端文字分析與 remix 使用的 MiniMax 憑證。
    *   `APIFY_API_TOKEN`：(選填) 作為備用的 Apify 爬蟲金鑰。
    *   `PUPPETEER_EXECUTABLE_PATH`：由於 1Panel 伺服器架構等限制，用來明確指定系統原生 Chromium 執行檔的路徑 (例如：`/usr/bin/chromium`)。
*   **【各大社群平台 API Tokens】**
    *   `INSTAGRAM_ACCESS_TOKEN` / `INSTAGRAM_ACCOUNT_ID`：發 IG 用的長效金鑰與帳號 ID。
    *   `THREADS_ACCESS_TOKEN` / `THREADS_USER_ID`：發 Threads 用的金鑰與帳號 ID。
    *   `TWITTER_ACCESS_TOKEN`：發 Twitter(X) 的 OAuth 金鑰。

---

## 🎯 對齊目標：內化 `fieldtheory-cli` 架構 (commit 6b2f85de...)
**時間**：2026-04-08
**問題描述**：確認 commit 6b2f85de5f04dd0e2942c46c1e6cc1f071ea2a59 的開發方向，以及如何將 `afar1/fieldtheory-cli` 關於分類、聚合、查詢的功能內化到本系統。

### 1. 進度與方向確認
**現況解析**：在該 commit 中，已初步建立了以下模組，這是在為 Field Theory 的功能打底：
*   **後端聚合與分類**：引入了 `categoryProcessor.js`、`categoryRules.js` 以及 `statsService.js`。
*   **前端視覺化**：新增了 `InsightPage.jsx`、`BarChart.jsx`、`StatCard.jsx` 供儀表板使用。

**對齊 `fieldtheory-cli` 核心功能**：
*   `ft sync`：我們的爬蟲 Orchestrator 已部分實現此自動化抓取功能，未來只需強化增量紀錄。
*   `ft classify`：對應剛建立的 `categoryRules.js` (正則) 與 LLM 處理邏輯，接下來需要確保新進來的貼文全數進行分類標記。
*   `ft viz` / `ft stats` / `ft categories`：對應正開始製作的 `InsightPage.jsx`，將分類與聚合結果視覺化。
*   `ft search`：利用現有架構補強全文檢索搜尋。

### 2. 接下來的執行重點
我已將這些對齊後的工作事項記錄在 `tasks.md` 的 `Phase 8` 中。目前的焦點將是：「**讓系統抓回來的雜亂發文，經過 `categoryProcessor` 結構化後存入資料庫，接著透過 `statsService` 將聚合資訊拋轉給 `InsightPage`，用一致性的介面給出最佳的個人資訊儀表板。**」

---

## 📂 雙軌分類系統 (Manual Folders vs. Auto Categories)
**時間**：2026-04-08
**問題描述**：使用者詢問關於 `fieldtheory-cli` 內化策略下，自動分類與手動收藏的差異。

### 1. 提問與解答 (對齊 Field Theory 策略)
1. **自動分類標示**：
   * 貼文會透過 `categoryProcessor` 自動掃描關鍵字並打上標籤。
   * **顯示位置**：目前呈現為 `PostCard` 內容區下方的 **#標籤 (Tags)**。
2. **新增分類規則**：
   * 目前規則存放在 `server/services/categoryRules.js`。
   * 您可以透過更新該檔案的正則表達式來新增自動分類邏輯（未來計畫提供介面化設定）。
3. **歸屬數量差異**：
   * **手動收藏（Collections）**：一對一。像「資料夾」，確保管理清晰。
   * **自動分類（Categories/Tags）**：一對多。一篇文可以同時具備多個領域屬性（如：AI + Web），會完整反映在儀表板的統計中。

### 2. 技術架構對稱
* **後端處理**：`categoryProcessor.js` (內化 `ft classify`)。
* **聚合顯示**：`InsightPage.jsx` (內化 `ft stats` / `ft categories`)。



---

## 🐦 Twitter (X) 抓取留言 (Comments) 的設計現況
**時間**：2026-04-17
**問題描述**：使用者詢問 Twitter 抓取時沒有抓到留言內容，是本來就沒設計嗎？

### 1. 現狀說明
**是的，目前的設計確實尚未包含留言抓取。**
*   **技術限制**：目前的 `twitterCrawler.js` 是透過 Twitter 的 GraphQL API (`TweetResultByRestId`) 進行抓取。
*   **資料結構**：該 API 節點主要回傳「貼文主體」資訊（內文、媒體、作者、統計）。留言（Replies）在 Twitter 的系統中屬於另一個層級的資料，通常需要呼叫 `TweetDetail` 或類似的 Timeline 介限 API 才能獲取完整的對話樹。
*   **目前重點**：現階段系統的設計重心在於「主貼文內容」的備份、AI 摘要與分類。為了保持抓取速度與避免 Guest Token 過快被限制，目前僅抓取單篇貼文的核心內容。

### 2. 未來規劃
若未來有「留言分析」的需求，我們可以在 `twitterCrawler.js` 中擴充 `comments` 的提取邏輯：
*   需要額外解析 API 回傳中的 `replies` 陣列（若有）。
*   或是針對目標貼文 ID 進行二次遞迴請求以獲取留言列表。
*   **目前的程式碼預留位**：在回傳物件中，`comments` 欄位目前固定回傳空陣列 `[]`。

---

## 🔐 API 端點 `/api/process` 的身份驗證與資料庫關聯問題
**時間**：2026-04-20
**問題描述**：為什麼在 Postman 呼叫 `/api/process` 只需帶 URL 就能執行？這樣資料庫如何知道該貼文屬於哪個帳號？這是否是一個問題？

### 1. 現狀分析
目前系統的資料流向如下：
1. **API 呼叫**：前端或 Postman 呼叫 `/api/process` 並帶入 `url`。
2. **後端處理**：後端 Orchestrator 進行爬蟲抓取與 AI 分析，並回傳格式化後的資料。
3. **資料庫儲存**：
   * **前端流向**：前端 `rootSaga.js` 收到資料後，才在瀏覽器端使用對應的 `userId` 呼叫 Supabase 將資料存入 `posts`、`post_media` 等表。
   * **API/Postman 流稱**：後端雖然有 `upsertPost` 邏輯，但因為 API 沒帶入 `userId`，後端為了避免違反資料庫 `user_id NOT NULL` 的限制，會選擇跳過寫入。

### 2. 為什麼這是一個問題？
這確實是一個**設計架構上的缺陷**，主要原因有：
*   **職責未對齊**：後端已經做了最重的爬蟲與 AI 分析，卻不負責最後的存檔，導致如果有人跳過前端直接 call API，資料就無法被追蹤或建立索引。
*   **安全風險**：資料庫寫入邏輯放在 client-side (Saga)，雖然方便但也讓寫入行為分散，較難維護且容易被操縱。
*   **API 一致性**：理想情況下，API 應該具備「原子性」——即處理完畢即存檔，或至少讓呼叫者可以指定歸屬的使用者。

### 3. 優化建議
*   **後端主動寫入**：應修改 `/api/process` 接受 `userId` 參數（或從 JWT Token 中解析），讓後端在處理完貼文後直接完成資料庫歸屬。
*   **前端簡化**：前端只需顯示後端存檔後的結果，不需再負責複雜的多表寫入邏輯。

---

## 🧠 收藏資料如何轉成可執行成果
**時間**：2026-07-18

### 使用者提問

1. Threads crawler 與通用 Puppeteer crawler 是否相同？
2. Puppeteer 快取在 Windows C 槽是否需要遷移？Mac 是否安全？
3. 最近 100 筆收藏明顯偏向安裝工具、複製流程、做 POC 與技能產品化，系統接下來具體要怎麼做？

### 1. Threads 與通用 crawler 的關係

- 底層相同：兩者都使用 `puppeteer` 啟動 Chrome／Chromium 類瀏覽器。
- 實作不同：Threads 使用 `threadsCrawler.js` 的平台專用 selector、貼文結構、留言與媒體解析；一般網站使用 `browser.js`，主要讀取 meta、article/main/innerText。
- 兩者會各自呼叫 `puppeteer.launch()`，不是共用同一個 browser instance 或 parser。
- X 目前是 Guest Token＋網站內部 GraphQL，不走 Puppeteer。

### 2. 快取位置

- Puppeteer 目前未設定 `PUPPETEER_CACHE_DIR`，套件預設為 `homedir()/.cache/puppeteer`。
- Windows 已確認落在 C 槽，後續應遷移至 G 槽。
- Mac 實際環境尚未檢查，不能假設安全；應明確設成 `/volumes/DevSSD`，避免寫入 Home／系統碟。
- 目前先不搬動或刪除既有快取，避免打斷 crawler；遷移需另行驗證 Windows、Mac 與部署主機。

### 3. 首要方案：AI 行動候選收件匣

不讓 AI 直接安裝工具、改專案或對外發布。每筆收藏先形成一張可審核的 Action Candidate：

1. 判斷是否值得處理：relevance、novelty、actionability、effort、confidence。
2. 路由到 `archive`、`learn`、`implement`、`plan`、`strategy`、`content/remix`。
3. 根據路由產生具體成果：
   - `learn`：概念、先備知識、練習、驗證題、下一步。
   - `implement`：repo、環境、安裝步驟、最小 POC、驗收條件、風險。
   - `plan`：任務拆解、依賴、優先級、成本、完成定義。
   - `strategy`：適用條件、決策規則、KPI、實驗設計。
   - `content/remix`：受眾、觀點、素材、平台格式、草稿。
4. 相似收藏先去重與聚類，避免每看到一篇 Skill 就新增一張重複任務。
5. 使用者批准後才進入真正執行；未批准只保留建議與證據。

### 建議的第一版 MVP

- 不改 `/api/process` 契約。
- 不直接自動執行。
- 先對既有 100 筆資料 dry-run，建立主題群組與 Action Candidates。
- UI 先做「待處理／已接受／略過／稍後」四種狀態。
- 第一批優先路由：Agent Skills、AI 開發工具、自動化工作流、程式 POC、設計／內容製作；投資資料獨立分流。
- 驗證標準不是摘要好不好看，而是候選行動是否值得做、能否直接開始、是否大量重複。

---

## 🕷️ 共用 BrowserManager、語意整理與 Claude-Obsidian 同步
**時間**：2026-07-18

### 使用者提問

1. Threads 與其他平台是否應共用 browser instance 或 profile，避免維護多套？
2. 除了判斷價值與下一步，也要避免重複內容，並把相近內容整理在一起。
3. 資料已存進 Supabase 後，如何同步到本地 Claude-Obsidian？

### 1. Browser 共用決策

- 應共用一套 `BrowserManager` 與長生命週期 browser process。
- 每個 crawl job 使用獨立 `BrowserContext`／Page，避免 Cookie、LocalStorage、request interception 與 selector 狀態互相污染。
- 不應讓所有平台共用同一個 persistent profile。
- 只有必須登入的平台才配置「平台＋帳號」專屬 profile，例如 `threads/account-a`、`facebook/account-a`；profile 由 BrowserManager 管理，不由各 crawler 自行 launch。
- Threads、Instagram、Facebook、Generic 等只保留 platform adapter／parser；啟動參數、browser binary、proxy、timeout、重試、log、profile lock 與關閉機制全部集中管理。
- X 現行 Guest GraphQL 可先保留為非瀏覽器 adapter；若日後改成 DOM crawler，也接入同一 BrowserManager。

### 2. 三層去重與整理

1. **Exact duplicate**：canonical URL、platform post id、content hash 完全相同時，只更新來源或擷取時間，不建立新知識頁。
2. **Semantic duplicate**：不同貼文在講同一工具／repo／方法時，掛到同一 Topic Cluster，保留多個來源，不重複產生任務。
3. **Related content**：主題相近但有新資訊時，合併到同一 Dossier，AI 只寫入「新增觀點／差異／反例」，不重新摘要全部內容。

建議知識結構：

- Source Post：不可變的原始貼文與擷取證據。
- Knowledge Item：從來源抽出的工具、方法、概念或策略。
- Topic Cluster／Dossier：同一主題的累積知識頁。
- Action Candidate：從 Dossier 產生的 learn／implement／plan／strategy／content 行動。

每次新資料進來都先回答：是否完全重複、屬於哪個 cluster、相較既有內容新增了什麼、是否值得建立或更新行動候選。

### 3. Supabase 與 Claude-Obsidian 的邊界

- Supabase 是 ingestion 與同步狀態的 source of truth。
- Claude-Obsidian 是可閱讀、可人工編輯的衍生知識工作區，不直接承擔原始 crawler 資料庫責任。
- `/api/process` 不直接寫本機 Vault；它只完成擷取入庫與建立後續處理事件。
- 由獨立 Local Sync Agent 在 Mac 上輪詢／訂閱待同步資料，轉成 Markdown 後原子寫入 Claude-Obsidian Vault。
- 遠端 n8n 負責流程編排；本機 Agent 負責實際 filesystem 寫入。若 n8n 本身就跑在同一台 Mac，可由 n8n 執行本機 exporter，但仍需保留 sync cursor、checksum 與衝突規則。

### 4. 建議同步格式

- 一個 Topic Cluster 對應一個穩定 Markdown 檔，而不是一篇社群貼文一個檔。
- Markdown frontmatter 保存 `cluster_id`、`source_ids`、`sync_version`、`last_synced_at`、`action_status`。
- 本機人工內容放在受保護區塊；AI 更新只覆寫 managed section，避免洗掉 Claude-Obsidian 中的人工筆記。
- DB 與本地都保存 checksum；兩邊同時被修改時標記 conflict，不靜默覆寫。
- 圖片可先保留 Supabase Storage URL；需要離線使用時再由 Local Sync Agent 下載到 Vault attachments。

### 5. 建議實作順序

1. 先定義 Knowledge Item／Cluster／Action Candidate 的 JSON 契約，不改現有 `/api/process`。
2. 對既有 100 筆資料 dry-run 聚類，人工檢查哪些被錯誤合併或拆太細。
3. 確認 Claude-Obsidian Vault 目錄、檔名規則與人工編輯保護區。
4. 實作 read-only exporter，先輸出 preview 目錄，不直接寫正式 Vault。
5. 驗證後再加入 Local Sync Agent、同步游標、checksum 與衝突處理。
6. 最後才把新資料的自動聚類與同步接到 n8n。

---

## 🍎 Mac n8n 與 Claude-Obsidian Vault 選型
**時間**：2026-07-18

### 已確認環境

- n8n 跑在 Mac 本機，透過對外通道接收手機分享連結。
- n8n 收到連結後呼叫本專案 `/api/process`。
- 新 Vault 預定放在 Mac 外接開發碟；macOS 標準掛載路徑應先確認為 `/Volumes/DevSSD/claude-obsidian`。

### GitHub 選型結論

選用 `AgriciDaniel/claude-obsidian`：

- 約 9.6k stars、1.1k forks、212 commits。
- 它是完整可 clone 的 Claude Code＋Obsidian 自組織知識 Vault，不只是 Obsidian 聊天外掛。
- 支援 source ingest、entity／concept 抽取、cross-reference、更新而非重複建立、hot cache、PARA／LYT／Zettelkasten／Generic 模式與 multi-writer lock。
- `Claudian` 雖然 stars 更高，但定位是把 Claude／Codex 聊天代理嵌入 Obsidian，不是本次需要的完整知識庫骨架。

### 安裝腳本檢查

`bin/setup-vault.sh` 主要在指定 Vault 內建立 `.obsidian`、`.raw`、`wiki`、`_templates`，並覆寫 Vault 內的 Obsidian graph／app／appearance 設定。若已存在 Excalidraw manifest 而缺少 `main.js`，會從 GitHub release 下載約 8MB 檔案。沒有發現刪除 Home 或在 Vault 外建立大型快取的指令。

### 預定 Mac 操作

```bash
git clone https://github.com/AgriciDaniel/claude-obsidian.git /Volumes/DevSSD/claude-obsidian
cd /Volumes/DevSSD/claude-obsidian
bash bin/setup-vault.sh /Volumes/DevSSD/claude-obsidian
```

clone 後必須先檢查 repo 的 `AGENTS.md`、requirements、Git remote 與工作樹，再進行個人化；不直接把 Supabase service-role key 放進 Vault 或 n8n 前端可見設定。

### 目前阻擋

目前 Codex 執行環境是 Windows，只能寫入 G 槽，無法存取 Mac 的 `/Volumes/DevSSD`，因此尚未實際 clone。需在能控制該 Mac filesystem 的 Codex／Terminal 工作階段執行上述操作。

---

## 🧭 完整工作流規劃：手機收藏到可執行知識
**時間**：2026-07-19

### 使用者提問

在前往 Mac 實作前，需要先完整理解並確認整套工作流，而不是直接 clone Vault 或開始接線。

### 核心解答

整套系統分成七個互相隔離的責任：

1. 手機只負責分享 URL。
2. n8n 負責接收、立即回覆、呼叫 API 與流程編排。
3. `/api/process` 負責 crawler、正規化與原始資料入庫。
4. Knowledge Job 負責抽取、去重、語意聚類與更新 Dossier。
5. Actionizer 負責把知識轉成可審核的 learn／implement／plan／strategy／content 候選。
6. Local Vault Bridge 負責安全地把同步 package 寫成 Markdown。
7. Claude-Obsidian 負責閱讀、人工筆記、思考與批准後的實作工作。

完整 API、資料表草案、n8n 節點、錯誤降級、Vault 映射與分階段驗收，集中記錄於：

`docs/knowledge_action_vault_master_plan.md`

---

## 🚀 收藏必須找到應用出口，並由 Agent/Codex 主動執行
**時間**：2026-07-24

### 使用者重新確認的目標

1. 收藏的 Skill、套件、GitHub 專案、Prompt 與工作流，大概率是之後要實際應用的東西。
2. 系統不能只摘要、分類或等待使用者有空整理；必須主動匹配既有／過往專案，找出具體應用位置。
3. Agent 應代替使用者完成安全、隔離、可逆的研究、POC 與測試；需要正式修改、production、付費或對外行為時才要求批准。
4. Project Auditor 必須定時掃描整個「允許的專案」，主動發現需求、缺口、技術債、測試不足與可重用資產，不只依賴既有 `tasks.md`。
5. 收藏同時也是自媒體素材；內容不一定要走深入研究或 POC，可以直接改寫、轉譯為即時貼文。
6. 所有來源、應用案件、測試結果、內容作品與人工筆記都要形成可搜尋目錄，避免再次遺忘。

### 核心流程

```text
收藏
→ Route Agent 多路判斷
   ├─ quick_rewrite
   ├─ translate_localize
   ├─ research_content
   └─ apply_poc

apply_poc
→ Project Map／Project Needs
→ Application Case
→ Codex Research／POC／Test
→ adopt／pilot／defer／reject
→ Integration Proposal
→ 批准後 agent-dev 整合
→ 可再轉成實作型內容
```

### Codex 的新定位

- Codex 是 Local Agent Runner，不只是人工開啟後聊天。
- 邏輯 job 包含 project audit、opportunity match、research、POC、integration、content transform 與 Vault projection。
- Backend／Supabase 管理 Agent Job、lease、權限、進度與 artifacts。
- Codex 在能存取實際 repo／POC Lab／Vault 的 Windows 或 Mac 執行。
- 第一版應由單一可觀測 Orchestrator 依 job type 執行，不急著拆成多個互相對話的 Agent。
- 排程方式仍未確認：互動式 session、Task Scheduler／launchd 啟動 CLI，或常駐 thin runner。

### 防止收藏再次沉沒

每筆收藏必須進入：

- 已整合。
- POC 成功、等待批准。
- 明確延後，附 blocker 與 retry trigger。
- 實測淘汰，附失敗證據。
- 已轉成內容。
- 同時整合與內容化。

沒有下一步、重查條件或明確結論的收藏，不算完成。

### 下一次討論入口

直接規劃 MVP 分期與驗收標準，並確認第一批可被 Project Auditor 掃描的 allowlisted 專案；不需要重新梳理產品目標。
