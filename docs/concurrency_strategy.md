# 併發處理與環境隔離實作方案 (Concurrency & Isolation Strategy)

## 1. 問題背景
當使用者在快速且連續輸入多個網址時，目前系統面臨以下 Race Condition 風險：
*   **Saga 取消機制**：前端 Redux-Saga 目前使用 `takeLatest`，這會導致當新請求發出時，尚未完成的舊請求會自動被中斷 (Cancel)，造成「只吃最後一筆」的現象。
*   **爬蟲狀態共享**：若多個抓取任務共用同一個瀏覽器分頁或同一個 Session 目錄，可能會導致 Cookies、Cache 或 LocalStorage 的相互干擾，影響資料正確性。
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

### 第三層：伺服器端併發限制 (Concurrency Control)
*   **技術**：在 `Orchestrator` 層導入 `p-limit` 或相似的 Promise 限制邏輯。
*   **參數**：設定 `MAX_CONCURRENT_CRAWLS = 3` (可依伺服器規格調整)。
*   **效果**：當用戶一次貼上大量連結時，系統會自動進入隊列處理，確保伺服器負載維持在安全範圍。

## 3. 實作工作流 (Workflow)

1.  **前端改造**：更新 `src/store/rootSaga.js` 以支援並行 Action。
2.  **後端核心升級**：修改 `server/services/crawlerService/browser.js` 加入 Context 建立與銷毀邏輯。
3.  **流量調控**：在 `server/services/orchestrator.js` 包裹 `processUrl` 的非同步邏輯，實現任務佇列。
4.  **驗證測試**：連續發送 5 個 Threads 網址，觀察控端日誌 (Logs) 是否正確排隊並成功產出 5 筆紀錄。

---
*文件更新紀錄：2026-01-05*
