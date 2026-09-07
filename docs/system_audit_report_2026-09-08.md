# 全系統稽核報告（2026-09-08）

範圍：只讀程式、Git 與安全測試；未讀取 `.env`／Vault 正文，未連 Supabase、未跑 Docker、付費 API、爬蟲、排程、部署或正式資料寫入。開始與結束 Git 快照均以 `main=223fe39` 為基準；本輪新增的兩份報告是唯一預期工作區寫入。

## 已確認問題（依修復順序）

1. **P0：已追蹤的歷史設定檔含未遮蔽 MiniMax API key。** 證據：`server/archive/legacy-config/temp_env.txt:1`，且 `git ls-files --stage` 證實它在 HEAD 受追蹤。任何有 repo 讀取權限者可用 `git show HEAD:server/archive/legacy-config/temp_env.txt` 取得值。影響是憑證外洩與可能的付費 API 濫用。建議立刻輪替／撤銷此 key，再由有遠端權限者做歷史清除；改成無值 template，並掃描 Git 歷史。此輪不重複憑證內容。
2. **P1：Vault 重試會因標題或日期變化另寫一份筆記。** `server/services/vaultNoteService.js:225-243` 每次只由 `posted_at/created_at`、`note_title/title/generated_title` 重算路徑；`server/services/vaultNoteService.js:264-285` 沒有接收／優先既有 `relative_path`，並直接寫新路徑。`scripts/agent-sdk/vault-sync-workflow.js:73-96` 在同步重試再次呼叫 writer，然後把新路徑回寫 DB context。現有測試只覆蓋同一標題重試（`test/script/vault_note_contract.test.js:70-90`），未覆蓋 AI title／日期變更或舊 workflow path。影響是同一 post 的舊 note 失聯、人工內容分散及 DB path 被改寫。修復應在 writer 的共享入口優先採用已完成／既有 workflow `relative_path`，若找不到再建立；另加 title/date 變動重試 fixture。
3. **P2：根目錄 `tasks.md` 的「待執行、尚未修改」與執行紀錄／程式不一致。** `tasks.md:3,25-34` 仍列回復待執行；`Task_Logs/2026-09-08.md:3-7` 卻記載已回復、已移除舊入口並完成 171 tests；現行 writer 也確為 platform 路徑（`server/services/vaultNoteService.js:225-243`）。影響是人員可能重做已回復工作或誤判部署狀態。建議 owner 依稽核證據更新任務宣告，但本輪遵照邊界未改 `tasks.md`。
4. **P2：已撤回的 Vault move 建議仍有可直接執行的 CLI 入口。** `scripts/maintenance/plan-auto-container-migration.js:189-224` 仍輸出 `vault-plan.csv`，並對每篇資料產生 `owner_review_vault_move_after_mapping_approval`；`package.json` 沒有此 script，但檔案可直接以 node 執行。它不會實際搬檔，但名稱與 CSV 可被誤當待套用 migration。`tasks.md:29` 要求停用／移除這類入口，與此殘留矛盾。建議改名成明確的 legacy/read-only proposal 或移至 archive，並在文件加上「已撤回、不可套用」；不應套用 manifest。
5. **P2：架構宣告的 API-first fallback 與有效 runtime 不一致。** `agents.md` 的 Orchestrator 規則要求 API 再 crawler，但 `server/services/orchestrator.js:14-19,140-175` 只走各 crawler；`server/services/socialApiService.js:35-55` 的 API service 定義未被 runtime import。`README.md:51-55` 則宣告 crawler-only。影響是維護者依 agent 規則會錯估限流、權限與 fallback 行為。建議選擇 crawler-only 為目前契約並修正角色文件，或真正接線 API；不要維持兩套真相。
6. **P2：MiniMax 並非退役殘留，而是活躍 runtime 依賴；退役狀態沒有可驗證決策。** `server/services/aiService.js:21-43,73-111,138-351` 使用 `MINIMAX_*` 並發 HTTP；`server/services/categoryProcessor.js:111-115` 以它為唯一 LLM fallback；`src/components/RemixPanel.jsx:11-15` 顯示 MiniMax 選項。文件也稱其為現行 provider（`docs/ai_classification_system.md:8,26`）。若產品決策是退役，現況會使分析／改寫失效；若未退役則不是 dead code。最小補證：指定現行 provider 決策與無憑證的 mock contract test；本輪未呼叫模型。

## ID 結果

| ID | 狀態 | 證據與實際結果／下一步 |
| --- | --- | --- |
| A01 | 已確認正常 | local `agents.md`、計畫與 Ponytail/Supabase 規範已讀；唯讀邊界記於本報告。 |
| A02 | 已確認正常 | 11 worktrees、main `223fe39`；無 stash；本輪未見 HEAD 漂移。完整矩陣見 `docs/worktree_disposition_2026-09-08.md`。 |
| G01 | 已確認正常 | `git worktree list --porcelain`：根目錄加 10 個 worktrees，無 detached/locked/prunable。 |
| G02 | 已確認正常 | 全矩陣含 staged/unstaged/untracked/ignored。根 env 與 agent-dev artifacts 均保留；未建議納入 Git。 |
| G03 | 已確認正常 | 全分支 ancestor exit 0、unique commits/cherry rows 0；`b5bd090` parents 是 `af7013d` 與 `c25c528`。舊 checkout 重引風險已列矩陣。 |
| G04 | 已確認正常 | stash 空；唯一 artifacts 是 agent-dev manifest，建議保留且不可套用。 |
| G05 | 已確認正常 | origin URL 無認證；遠端／tracking HEAD `6dd66b2`，local main ahead 16；部署版本尚未確認。 |
| D01 | 確定有問題 | 見 P2 tasks 狀態矛盾。 |
| D02 | 確定有問題 | 見 P2 API-first 規則矛盾；另 `README.md:1-10` 仍是 Vite 模板，容易誤導操作入口。 |
| F01 | 確定有問題 | crawler-only 實作與 API-first 規則衝突；capture→finalize RPC→workflow 的靜態鏈在 `captureProcessingService.js:124-150`、`captureFinalizationService.js:43-104`。live capture 未測。 |
| F02 | 確定有問題 | 見 P2 MiniMax 活躍依賴；title 不覆蓋來源 title 的契約測試通過。 |
| F03 | 尚未確認 | 靜態上 Stage O 與 topic governance 禁止自動 active；未驗 live schema/data。最小補證是身份確認後唯讀 aggregates。 |
| F04 | 已確認正常 | platform path 不讀 Collection (`vaultNoteService.js:225-243`)；`topic_workspace_governance_plan.md:23-27` 同步。live 髒資料未知。 |
| F05 | 尚未確認 | workflow action 契約存在，但未跑 POC／真實 UI；`postWorkflowService.js:58-63` 會要求 vault action 才 complete。 |
| F06 | 確定有問題 | 原子寫入在 `vaultNoteService.js:213-222`，DB 成功記錄在寫檔後；但 P1 表明重試無既有 path 保護。實體 Vault 未查。 |
| F07 | 確定有問題 | 見 P1。 |
| F08 | 確定有問題 | 見 P2 dry-run/move 殘留；未套用、未刪檔。 |
| F09 | 尚未確認 | SQL 含 FIFO/lease/retry 上限（`stage_l...sql:87-109`）；靜態未覆蓋中斷後所有補償分支，且未碰 live DB。 |
| S01 | 尚未確認 | 已先讀 `database/schema/schema.sql`；靜態 RLS/tenant FK 可見，但 schema 檔與 live migration 沒有身份驗證。 |
| S02 | 尚未確認 | SQL 意圖有 RLS owner checks（`stage_p_collection_rls_hardening.sql:57-121`）；live 啟用/grants 未確認。 |
| S03 | 尚未確認 | `server/supabaseClient.js:8-25` 會載入敏感 `.env` 並用 service role；沒有 repo config 或可證實 project identity，故未連線。 |
| U01 | 尚未確認 | workflow badge merge 在 `b5bd090` 已納入；未跑瀏覽器/UI fixture，視覺與 API 狀態未確認。 |
| T01 | 已確認正常 | 先審 package scripts 與測試副作用；跳過會讀 env/DB/Vault、Docker 與 build（會覆寫 ignored `dist/`）。 |
| T02 | 已確認正常 | `node --test test/script/ai_provider_contract.test.js test/server/generated_title.test.js test/script/auto_container_migration_dry_run.test.js`：6/6 pass；`npm run lint` exit 0。 |
| T03 | 已確認正常 | 結束快照：HEAD 仍 `223fe39`、stash 空、`origin/main...main=0 16`；根目錄唯一新增／修改是本輪計畫、兩份報告與 Task Log，沒有程式、正式資料或 ignored build 覆寫。 |

## 未確認項的最小補證

先由 owner 提供或在安全 connector 確認 Supabase project ref 與 repo 設定一致，再對 schema、RLS、workflow status 做最小聚合唯讀查詢；不讀正文、不使用 service role 寫入。Vault 僅以隔離 fixture 覆蓋 P1，禁止要求或掃描遠端 Vault。部署、Hermes Cron 與 UI 視覺須在對應主機／fixture 個別驗證，不能由本機 Git 推論。
