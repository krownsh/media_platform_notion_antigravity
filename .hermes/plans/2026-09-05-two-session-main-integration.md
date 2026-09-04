# 兩個 Session 整合回 main 計畫

> 狀態：已完成唯讀盤點，尚未合併、尚未 push、尚未搬遷舊資料
>
> 基準：`main` = `75a38da`；本任務成果 = `agent-dev` / `4891248`

## Session 與分支現況

| Session | 工作內容 | 實際 Git 狀態 |
|---|---|---|
| 停止貼文資料夾擴張 | link-only preprocess、Vault 固定路徑、Stage O、Stage P RLS、dry-run | 獨立 worktree 的 `agent-dev`，7 個 commit，只有 `artifacts/` 未追蹤 |
| 除錯貼文重複請求與顯示 | posts 重複請求／白畫面、無圖片顯示、Topic／Project governance | 專案根目錄的 `main`，19 個 tracked 檔案修改、6 個功能檔案未追蹤，尚未 commit |

兩個 Session 不在同一個成果分支，但共用同一個 repository object database。
不得直接把 `agent-dev` merge 進目前 dirty 的 `main`。

## 已確認的重疊與衝突

兩邊同時修改 7 個路徑：

1. `MEMORY.md`
2. `Task_Logs/2026-09-04.md`
3. `database/README.md`
4. `docs/topic_agent_mvp.md`
5. `scripts/agent-sdk/preprocess-workflow.js`
6. `server/services/autonomousKnowledgeService.js`
7. `src/store/rootSaga.js`

目前 patch preflight 已確認其中 5 個會直接套用失敗：`MEMORY.md`、
`Task_Logs/2026-09-04.md`、`database/README.md`、
`scripts/agent-sdk/preprocess-workflow.js`、
`server/services/autonomousKnowledgeService.js`。

正確整合語意：

- `autonomousKnowledgeService.js`：保留 Collection／Topic 不自動建立；只允許
  `origin=user` 且 `status=active` 的既有 Topic；match 先為 `suggested`。
- `preprocess-workflow.js`：保留固定 Vault 分類建議語意，同時保留另一 Session
  的 accepted Topic POC gate。
- `rootSaga.js`：同時保留 `takeLeading(fetchPosts)` 去重，以及所有 RLS mutation
  的 `user_id` owner filter。
- 文件與 Task Log 採 append/人工整併，不覆蓋任一 Session 的紀錄。

## 資料庫交錯點

已上線的 migration 是互補的：

- `stage_o_stop_auto_container_creation`：替換 DB-only preprocess，停止建立
  Collection／Topic。
- `stage_o_topic_project_governance`：新增 Project registry、Topic governance
  欄位與阻擋 `agent_auto` Topic 的 trigger。
- `stage_p_collection_rls_hardening`：啟用 Collection／Post RLS、grant 與
  same-owner FK。

合併前仍需補一個 additive migration，不回改已部署歷史 migration：

1. DB-only preprocess 只接受同 owner、`origin=user`、`status=active` 的既有
   Topic。
2. Agent 建立的 source match 一律為 `suggested`，並寫入
   `decision_source=agent`；只有人工接受 API 可改為 `accepted/user`。
3. baseline schema 與 schema aggregator 同步納入 Project governance、Stage P
   RLS 與上述最終函式，確保新環境不會缺一半。

## 安全合併順序

1. 暫停兩個 Session 對這個 repository 的寫入。
2. 從目前 `main` 建立 `codex/ui-topic-governance`，承接另一 Session 的 dirty
   working tree；檢查後 commit，絕不直接在 `main` commit。
3. 從乾淨 `main` 建立 `codex/integrate-september` 的獨立 worktree。
4. 先 merge `codex/ui-topic-governance`，再 merge `agent-dev --no-commit`。
5. 依上方語意人工處理 7 個重疊檔案；不得使用整檔 ours/theirs 覆蓋。
6. 新增 additive DB hardening migration，並同步 baseline schema、aggregator、
   docs 與測試。
7. 在 integration branch 執行合併後驗證：
   - 兩個 Session 的 targeted Node tests（包含 Topic governance 與 35 個既有測試）
   - 本次異動檔案 ESLint
   - `npm run build`
   - `git diff --check`
   - Supabase 唯讀 postflight：migration history、RLS/policies/grants、Topic
     trigger、Project schema、資料筆數與跨 owner links
8. 全部通過後才把 `codex/integrate-september` 合併回 `main`。
9. push 仍需 Owner 另行明確授權。

## 不與本次合併綁在一起

- 不搬 Vault 舊檔。
- 不重掛既有 Post 的 Collection。
- 不刪除／合併／封存既有 Collection 或 Topic。
- 不執行 dry-run 中的 184 個 Collection、60 個 Topic、186 個 Vault 項目。

舊資料清理是可選維護工作，不是本次程式與 RLS 上線的必要條件；若保留
歷史雜訊可以接受，可暫時完全不執行。
