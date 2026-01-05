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
