# 併發處理與環境隔離實作方案 (Concurrency & Isolation Strategy)

## 1. 問題背景
當使用者在快速且連續輸入多個網址時，目前系統面臨以下 Race Condition 風險：
*   **Saga 取消機制**：前端 Redux-Saga 目前使用 `takeLatest`，這會導致當新請求發出時，尚未完成的舊請求會自動被中斷 (Cancel)，造成「只吃最後一筆」的現象。
*   **爬蟲狀態共享**：若多個抓取任務共用同一個瀏覽器分頁或同一個 Session 目錄，可能會導致 Cookies、Cache 或 LocalStorage 的相互干擾，影響資料正確性。
*   **API 頻率限制 (Rate Limiting)**：即使不透過瀏覽器，直接使用 API (如 Twitter Guest API) 同時送出大量請求，也會因觸發 IP 封鎖導致所有任務失敗。
*   **資源過載**：若為每個任務都重啟完整的瀏覽器進程 (Puppeteer launch)，會造成伺服器 CPU/RAM 瞬時噴發，導致系統崩潰。

## 2. 三層隔離與控制架構 (Implementation Tiers)

### 第一層：Saga 任務多線程化 (Frontend)
*   **變更**：將監聽 `addPostByUrl` 的 Effect 從 `takeLatest` 修改為 `takeEvery`。
*   **目的**：允許前端同時發起多個 `handleFetchPost` Worker Saga，確保每個 URL 的處理流程都能獨立走完。

### 第二層：匿名瀏覽器上下文 (Incognito Browser Context)
*   **變更**：在 `browser.js` 中使用 `createIncognitoBrowserContext()` 代替直接在 Browser 下建立頁面。
*   **實作邏輯**：
    1.  維護一個長駐的 `browser` 實例。
    2.  對每個 `crawlPost` 任務，執行 `const context = await browser.createIncognitoBrowserContext()`。
    3.  在該 `context` 下開啟 `newPage()`。
    4.  任務結束後關閉 `context`。
*   **優點**：每個任務擁有完全獨立的匿名環境（無痕模式），資源開銷遠低於啟動多個瀏覽器。

### 第三層：伺服器端併發限制與頻率管理 (Unified Concurrency & Rate Control)
*   **核心理念**：不論是瀏覽器模式還是 API 模式，均視為「單一任務個體」，由 `Orchestrator` 統一控管。
*   **技術**：在 `Orchestrator` 層導入 `p-limit` 限制全域處理數量。
*   **API 專屬邏輯**：
    1.  **實例化隔離**：確保每個 API 請求使用獨立的 Header 實例。
    2.  **間隔延遲 (Staggering)**：在 API 任務之間加入隨機的微小延遲 (100ms~500ms)，模仿人類行為。
*   **參數**：設定 `MAX_CONCURRENT_TASKS = 3`。
*   **效果**：有效平衡「抓取速度」與「環境安全」，防止因瞬時併發 API 呼叫而導致的 429 (Too Many Requests) 錯誤。

## 4. UX 視覺化與錯誤管理 (Visibility & UX)

### 骨架卡片 (Queue Skeleton Cards)
*   **同步顯示**：當用戶提交網址後，不等後端回傳，前端立即在 `CollectionBoard` 生成一個「預佔位卡片」。
*   **狀態標籤**：卡片上顯示目前階段（如：`排隊中...` -> `抓取內容中...` -> `AI 分析中...`）。
*   **解決問題**：消除使用者對於「頁面沒反應」的焦慮感。

### 全域任務中心 (Task Center)
*   **抽屜介面**：提供一個可收合的清單，記錄所有執行中與失敗的任務。
*   **重試機制**：針對失敗任務提供「一鍵重試」按鈕。
*   **防呆控管**：
    1.  **數量上限**：當排隊任務 > 10 筆時，暫時禁用輸入框並提示使用者。
    2.  **重複過濾**：自動擋掉正在處理中的重複網址。

## 5. 實作工作流 (Workflow)

1.  **狀態定義**：在 `postsSlice` 擴充 `queue` 數組狀態。
2.  **前端改造**：更新 `src/store/rootSaga.js` 以支援並行 Action 與排隊狀態更新。
3.  **骨架實作**：在 `CollectionBoard.jsx` 渲染 `queue` 中的項目。
4.  **後端核心升級**：修改 `server/services/crawlerService/browser.js` 加入 Context 隔離。
5.  **流量調控**：在 `server/services/orchestrator.js` 實作 `p-limit` 任務佇列。
6.  **驗證測試**：連續發送多個網址，確認骨架卡片正確出現且任務依序完成。

---
*文件更新紀錄：2026-01-06*
