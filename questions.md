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
系統在處理 Threads 貼文時，會依序嘗試以下模型直至成功（皆以免費額度優先）：
1.  **Google Gemma 3 (首選)**：`gemma-3-27b-it` (Direct API)。
2.  **xAI Grok (次選)**：`x-ai/grok-4.1-fast:free` (via OpenRouter)。
3.  **免費模型輪詢 (Fallback)**：若上述失效，會自動在 `deepseek-r1` 與 `qwen-2.5-vl` 之間切換。

### 2. 內容二創與圖片生成 (Remix Workflow)
*   **文字改寫**：首選 Google **Gemma 3 (27B)** 直連，若失敗則降級使用 `grok-2:free` (OpenRouter)。
*   **圖片生成**：使用 `openai/dall-e-3` (OpenRouter) 或專屬的 `Nano Banana Pro`。

### 3. 如何切換模型或設定？
*   若要修改 API Key，請調整 `server/.env` 中的 `GOOGLE_GENERATIVE_AI_API_KEY` 或 `OPENROUTER_API_KEY`。
*   若要調整分析邏輯，核心程式碼位於 `server/services/aiService.js` 的 `analyzeThreadsPost` 函式。

---

## 🔧 環境變數 `.env` 的配置與讀取路徑
**時間**：2026-04-08
**問題描述**：確認專案是否全部統一吃根目錄的 `.env`，而沒有 `server/.env`？

### 1. 提問與解答
**提問**：現在是不是都是吃根目錄的 `.env`，而沒有 `server` 的 `.env`？
**解答**：不是的。專案目前依然維持「前端」與「後端」的環境變數分離配置，`server/.env` 仍然存在且被後端程式依賴。

### 2. 環境變數檔存放差異
*   **根目錄的 `.env` (包含 `.env.development` 等)**：僅供 **前端 (Vite)** 使用。裡面專門放置帶有 `VITE_` 前綴的公開暴露變數，例如 `VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY` 等。
*   **`server/.env`**：供 **後端 (Node.js)** 使用。這裡面包含了所有伺服器的敏感資訊（不可暴露給前端），例如 `OPENROUTER_API_KEY`、`GOOGLE_GENERATIVE_AI_API_KEY`、後門高權限的 `SUPABASE_SERVICE_KEY` 等等。

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
    *   `OPENROUTER_API_KEY`：串接各大 AI 模型 (Grok, DALL-E) 的 OpenRouter 金鑰。
    *   (`GOOGLE_GENERATIVE_AI_API_KEY`：雖然 `.example` 中目前沒明確列出，但實際 `.env` 中有配置給 Gemma 模型使用)。
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
