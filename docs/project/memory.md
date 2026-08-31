# Project Memory

## 2026-08-13：Hermes 五分鐘 Cron 只做無人值守預處理

1. Capture Worker 先把 URL／圖片完成擷取、持久化與必要的圖片基礎分析；Hermes 不使用 Webhook dispatcher 或常駐 polling worker。
2. 五分鐘 Cron 只從 Supabase FIFO claim 一篇 `base_analysis`／`triage`／`preprocessing`，完成高信心、低風險的分類、重複來源比對、Topic／資料夾整理、Vault source note，以及可安全的離線 POC，然後釋放 lease 並結束；不得詢問使用者。
3. 需要研究的內容寫入 `research/pending`，由另一個 Research Cron 處理；需要確認的內容寫入 `review/awaiting_user` 與 `context.review_request`，由之後的互動／決策流程處理。
4. 網路、密鑰、套件安裝、付費 API、部署、發布或正式專案修改一律不是五分鐘 Cron 的自動動作。沒有明確風險／信心資料時視為高風險。
5. 不使用向量儲存；重複判斷使用 canonical URL、平台貼文 ID、內容雜湊，命中既有資料夾時沿用該資料夾。Vault 預設為 `~/.hermes/claude-obsidian`。

## 2026-07-29：Hermes 採 pull-based inbox，不是常駐自動執行器

1. `/api/process` 只負責擷取、Atomic Finalization 與建立 outbox；後端不啟動常駐 dispatcher。
2. Hermes Cron 先跑零 LLM gate；只有 unlocked／stale-locked pending row 才喚醒 Agent。claim 時保持 `pending` 並寫 lease，route plan 成功後才改 `processing`，避免主機 crash 造成永遠無法回收的 processing row。
3. `payload.agent_routes` 是 MVP 唯一 route-plan 真相來源，不同步寫 `source_routes` table。
4. 收藏與分類不得自動建立 `agent_jobs`。只有人類批准具體任務後，才可建立帶 allowed paths／commands 的 execution job。
5. Hermes 錯誤必須寫入結構化 `last_error` 並通知；失敗項目不進無限重試迴圈，等待人類決定。

## 2026-07-29：E2E 完成必須交付使用者可見成果

1. 後端資料庫狀態為 `sent`、測試通過或 API 回應成功，都不是使用者可驗收的完成品。
2. 當任務包含原文收藏、POC 或內容工作流時，完成前必須交付至少一個可直接查看的結果：前端頁面、可開啟的報告、明確的資料連結或直接呈現的摘要；不能只口頭說「跑通了」。
3. 使用者未要求再創作時，優先呈現原始來源與 POC 結果，不要把衍生草稿當作主要交付。

## 2026-07-29：收藏原文不等於授權或需要再創作

1. Route plan 中存在 `quick_rewrite` 或 `translate_localize`，只代表系統具備可產生草稿的能力；除非使用者明確要求再創作、發布或改寫，不能把它當作原作者內容必須被改寫的指令。
2. 捕捉原始貼文後，預設交付應是來源、分析與 POC／研究結果；衍生草稿只能維持 `draft`，不得要求使用者逐份核可，更不得自動發布。

## 2026-07-29：PL/pgSQL 回傳欄位會與查詢欄位同名衝突

1. `RETURNS TABLE (...)` 的欄位在 PL/pgSQL 函式內也會成為變數名稱；未限定的 `revision_number` 會和資料表欄位衝突，即使查詢目標只有一張表。
2. 所有函式內 SQL 查詢的資料表欄位都要使用 table alias（例如 `revision.revision_number`），並為已部署的錯誤函式提供獨立 hotfix migration，不得要求使用者重建或刪除表格。
3. `ON CONFLICT (column...)` 也會被 PL/pgSQL 的回傳欄位名稱干擾；若衝突目標已有命名 unique constraint，改用 `ON CONFLICT ON CONSTRAINT constraint_name`。

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

## 2026-07-29：部署交接不得擠牙膏

### 錯誤

1. 完成程式修改後只回報「下一步套 migration」，沒有一次交代後端載入、Hermes 主機、Cron、訊息投遞、happy-path E2E、failure drill 與人工核准邊界。
2. 讓使用者必須連續追問「下一步呢」，增加不必要的操作負擔。
3. 盤點時自行猜錯 Stage D migration 檔名；實際檔案是 `stage_d_collection_topic_scopes.sql` 與 `stage_d_1_unfiled_topic_scope.sql`。

### 正確做法

1. 每次完成架構或部署工作，最後必須一次列出：已完成、未完成、阻塞原因、所有剩餘步驟、每步驗收標準、哪些動作需要人類授權。
2. 能做的唯讀驗證與本機測試直接完成；schema、push、部署、外部訊息等需要授權的動作集中列出，不可逐項反問。
3. 使用者回報 migration 已套用時，立即唯讀驗證 schema／RPC，並明確區分「SQL 已部署」與「整條工作流已上線」。
4. 查找 deployment 必須先 `rg --files database/deployments`，不得先猜檔名。

## 2026-07-29：Hermes 不在目前開發電腦運行

1. 目前這台 Windows 電腦只負責專案程式、資料庫契約與本機驗證，不安裝、不啟動、不建立 Hermes Gateway／Cron。
2. Hermes 的安裝、pre-check gate、Cron、通知與跨電腦 E2E 集中追蹤於 `todo/2026-07-29_Hermes遠端主機接線與E2E驗收.md`。
3. 本機可以維護 Hermes 所需的跨平台腳本與測試，但不得因腳本存在就宣稱 Hermes 已上線。
4. 整體完成條件必須包含 Hermes 實際主機的 Cron execution、通知投遞、happy-path 與 failure drill 證據。

## 2026-07-29：完整 Lint 後仍要掃描 JSX runtime 名稱

1. 全專案 Lint 原有 49 errors／4 warnings；清理時發現 `RemixPanel.jsx` 在無 binding 的 `catch` 內引用 `e`，會在錯誤分支再次拋出 `ReferenceError`。
2. Lint 歸零後，文字掃描仍發現 `InsightPage.jsx` 使用未匯入的 `<motion.div>`。目前 ESLint 對小寫 JSX member expression 無法可靠抓出 `no-undef`。
3. Framer Motion 一律匯入成大寫 `Motion` 並使用 `<Motion.div>`，讓 unused／undefined 檢查有效。
4. 完整驗收要同時包含 ESLint、production build、測試與針對已知 JSX namespace 的文字掃描，不能只看單一工具綠燈。
