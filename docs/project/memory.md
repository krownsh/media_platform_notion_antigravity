# Project Memory

## 2026-07-29：PL/pgSQL 回傳欄位會與查詢欄位同名衝突

1. `RETURNS TABLE (...)` 的欄位在 PL/pgSQL 函式內也會成為變數名稱；未限定的 `revision_number` 會和資料表欄位衝突，即使查詢目標只有一張表。
2. 所有函式內 SQL 查詢的資料表欄位都要使用 table alias（例如 `revision.revision_number`），並為已部署的錯誤函式提供獨立 hotfix migration，不得要求使用者重建或刪除表格。

## 2026-07-29：POC E2E 的需求偵測與安全生成

1. Project Auditor 若只看資料夾是否存在與少數安全模式，會把已有測試但仍有 `TODO/FIXME` 的專案誤判為「0 個需求」，使 POC 流程靜默跳過。需將具體實作標記轉成 `missing_feature`，並保留檔案位置與原始標記。
2. 即使 prompt 已禁止網路，模型仍可能產生連網程式。靜態檢查必須先於 artifact 寫入與容器啟動；第一次違規只重生一次，第二次違規改用明確標示的 deterministic fallback，不能用放寬 sandbox 來換取成功。
3. POC 成功只代表 `apply_poc` 路由完成。來源可能同時有 `quick_rewrite` 或 `research_content`，不可自動把共用 outbox 設為 `sent`。
4. Tavily API Key 缺失時必須留下警告並降級；本次 POC 仍可在無 enrichment 的情況完成，但不能宣稱已完成來源查證。

## 2026-07-29：多路由 outbox 不能用單一完成旗標處理

1. `collection_capture_outbox.status` 是整筆來源事件的 lifecycle，不是單一路由的完成旗標。來源同時有 `apply_poc`、改寫或翻譯時，任一路由完成都不能直接寫成 `sent`。
2. 先在既有 JSONB payload 加入版本化 `agent_routes`，可避免未經授權的 schema migration；但必須用 `updated_at` 樂觀鎖，否則 read-modify-write 仍會讓多 worker 互相覆蓋。
3. Supabase 官方在 2026-06-30 後不再支援 Node 20。即使目前 SDK 可運作，也應把後端與 Node POC runner 的 Node 22 升級列為下一個基礎建設項目。

## 2026-07-24：使用者要求保存工作時，不得擅自留下未提交變更

### 錯誤

使用者明確要求建立新分支、Commit 並 Push 時，Agent 只提交了當輪文件，擅自把工作樹中原有的 README、程式碼、tasks 與測試排除，導致分支仍保留未提交變更。

### 正確做法

1. 先檢查全部未提交變更、來源、測試與敏感資訊。
2. 使用者要求「保存目前工作」時，應完整保存所有合理的專案變更；只有密鑰、快取、build 產物或明確無關垃圾才排除。
3. 不確定的檔案要先列出並說明，不能自行留下後才告知。
4. 不同性質的變更可以拆成多個 Commit，但最後要確認預期範圍內的工作樹已乾淨。
5. Push 後驗證遠端 branch 與 Commit，並清楚回報仍未提交的項目；若沒有，明確說工作樹乾淨。

## 2026-07-28：執行流程必須先對齊實際 Schema 與作業系統能力

### 本次發現的錯誤

1. `complete-item.js` 寫入 outbox 不存在的 `processed` 狀態、`processed_at` 與 `error_message` 欄位，與 Stage B Schema 不符。
2. `server/index.js` 的 bearer token parser 使用未宣告的 `match`，會在 JWT 路徑發生 runtime error。
3. `enrichmentService.js` 宣稱使用 Node 20 原生 `fetch`，卻匯入未安裝的 `node-fetch`。
4. Windows POC runner 假設 `bash` 可用，但本機 `bash.exe` 是沒有預設 distro 的 WSL launcher。
5. 原 Docker sandbox 可連網、可安裝套件、可寫 host bind mount，不能宣稱為安全隔離。

### 正確做法

1. 任何 Supabase CRUD 修改前，先逐欄核對實際 migration／schema，並用契約測試鎖住 status 與欄位。
2. 外部邊界必須有 timeout、明確錯誤、耗時與非零退出狀態；不得只寫 console 後繼續假成功。
3. Windows 不把 Bash／WSL 當成預設能力；優先直接呼叫跨平台 CLI，Mac/Linux 才走 shell wrapper。
4. 執行 LLM 生成碼前，至少要有靜態拒絕、斷網、唯讀、no-new-privileges、cap drop、資源上限與 timeout。
5. 容器 daemon 未啟動時只能回報「程式／契約測試通過」，不得宣稱 Docker E2E 通過。
6. Docker image pull 前必須先查 Docker Desktop VHDX／disk image 的實際 Windows 位置；`DockerRootDir=/var/lib/docker` 只顯示 VM 內路徑，不能據此判斷未使用 C 槽。

## 2026-07-29：大型 VHDX 備份不能只看檔案大小

### 錯誤

第一次用一般 `File.Copy` 備份 33.51 GB Docker VHDX 時，命令在 120 秒被工具終止。目的檔已被配置成和來源相同的長度，但 SHA-256 不同，代表內容不完整；若只比對大小會誤判成功。

### 正確做法

1. 大型 VHDX 跨磁碟備份使用 `robocopy /J`，並給足長時限，不要用短 timeout 的一般 copy。
2. timeout 後先假設備份無效；不得因檔案大小一致就繼續遷移或刪除來源。
3. 完成後同時核對 robocopy failed/mismatch、byte length 與來源／備份 SHA-256。
4. Docker Desktop 必須完全停止且 VHDX 可獨占開啟後才能備份。
5. Docker disk image 的正式搬移使用 Docker Desktop GUI；不得手動剪下 VHDX。
