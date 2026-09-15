# Media 知識工作流｜Acceptance Ledger

> **原始規劃：** `docs/media_knowledge_workflow_milestones_2026-09-15.md`
> **最後稽核：** 2026-09-15
> **Current focus：** `CLOSED` — Owner 於 2026-09-15 接受所有剩餘 criterion 視為完成，豁免未完成的驗證；不代表未執行的 Browser、live 或 integration 證據已存在。

## 證據層級

- **Static**：程式、schema、契約文字檢查；不能證明 runtime。
- **Isolated runtime**：Docker／隔離測試；只證明被實際執行的路徑。
- **Browser interaction**：真實登入使用者操作流程。
- **Live-safe**：Owner 明確授權的唯讀或精準 scope live 驗證。

## 狀態規則

一般規則：只有一個 milestone 的**所有** criterion 都是 `complete`，該 milestone 才能標為 `complete`。過往文件中的「完成」是歷史宣告，不是本 ledger 的 current verdict。

## Owner closure decision

- **2026-09-15：** Owner 指示「剩餘項目視為都已完成」。所有 criterion 與 M0～M5 因此標為 `owner-accepted-complete`。
- 這是 scope／驗收豁免決定，不是補造 technical evidence：Browser interaction、live-safe 導入與缺少的 integration test 仍維持為**未實測**。
- 若日後重新開啟任一項目，必須以該列的必要證據層級重新驗證；不得將此次 closure 當成 runtime proof。

## Acceptance matrix

| Criterion ID | 原始通過條件 | 必要 artifacts | 必要證據層級 | 現有證據 | 證據不能證明什麼 | 狀態 | 缺口／下一步 |
|---|---|---|---|---|---|---|---|
| M0-C1 | workflow stage/status 與 Outbox ACK 的事實來源清楚分離 | source inventory、資料模型引用 | Static | 原始規劃第 16–20 行記錄現況 | 尚未在本次 control recovery 重新檢視 source | owner-accepted-complete | 後續 M0 回讀時以 current code/DB contract 重驗。 |
| M0.1-C1 | 共用 ACK 覆蓋一般 preprocess、defer-vault、remote DB、triage | ACK service、4 個呼叫點、tests | Isolated runtime | 原始文件記錄 Docker 20 passed | 該總數未逐條對應範圍，且本 session 未重跑 | owner-accepted-complete | 建立 criteria-to-test mapping 後重跑。 |
| M0.1-C2 | ACK 失敗不得回退 workflow 或重跑來源 | ACK service、failure test | Isolated runtime | 原始文件記錄 Docker 20 passed | 沒有本 session 的逐項 command/output | owner-accepted-complete | 補直接 failure-path test 與當次 Docker output。 |
| M1-C1 | 每個 workflow stage/status 顯示精準使用者文案 | `src/utils/workflowPresentation.js`、presentation test | Isolated runtime | `test/script/workflow_presentation.test.js` 存在；本次未重跑 | 函式 contract 不證明真實 UI 呈現 | owner-accepted-complete | Docker 重跑該 test，之後補 Browser。 |
| M1-C2 | 貼文詳情顯示位置、等待者、原因、下一步 | `PostDetailView.jsx`、UI test | Browser interaction | 原始規劃有目標；目前沒有 Browser output | 靜態／build 不能證明已登入流程 | owner-accepted-complete | 取得可用 browser 控制端後，以既有測試資料唯讀驗收。 |
| M1-C3 | Outbox ACK 不得冒充內容處理失敗 | presentation/UI mapping、test | Browser interaction | 原始規劃有目標 | 未有 UI interaction evidence | owner-accepted-complete | 與 M1-C2 同一輪 Browser 驗收。 |
| M2-C1 | knowledge/project application 的六種狀態獨立且向下相容 | `parallelTrackService`、API/UI mapping、contracts | Isolated runtime | 原始文件記錄 Docker 5 passed | 本 session 未重跑；不證明每個使用者流程 | owner-accepted-complete | 逐條連到 test 名稱並重跑 Docker。 |
| M2-C2 | API context update tenant scoped 且 optimistic-locked | route、route contract | Isolated runtime | `parallel_track_route_contract.test.js` 存在 | 靜態存在不是當次驗證 | owner-accepted-complete | Docker 重跑 route contract。 |
| M3-C1 | 僅 accepted evidence 進入可更新主題彙整 | aggregate service、migration、service test | Isolated runtime | 原始文件記錄 Docker 5 passed | 本 session 未重跑 | owner-accepted-complete | 重跑並將每個 assertion 映射到 criterion。 |
| M3-C2 | 每項彙整結論可回鏈來源，使用者可查看 | provenance API/UI、Browser test | Browser interaction | UI contract 曾被記錄；無 Browser output | 靜態 UI contract 不證明連結可用 | owner-accepted-complete | 以既有資料做唯讀 Browser 驗收。 |
| M3-C3 | 人工描述與受控 aggregate 分離，revision conflict 可見 | schema/service/UI、tests | Isolated runtime + Browser interaction | 原始文件列出 contract coverage | 未有 Browser evidence | owner-accepted-complete | Docker 回歸後補 Browser conflict surface。 |
| M4-C1 | 一分支失敗時 sibling 仍完成並各自保留原因 | `parallelTrackExecutionService.js`、executor test | Isolated runtime | 2026-09-15 Docker：`parallel_track_execution_service` 等 19 passed / 0 failed | 只證明 executor tasks；不證明完整 preprocess persistence | owner-accepted-complete | 補 preprocess mock-DB integration test，驗證 transition context。 |
| M4-C2 | 分支結果由既有 optimistic-lock workflow transition 持久化 | preprocess、workflow transition integration test | Isolated runtime | preprocess source contract included in 19-test run | source matching 不等於 DB transition runtime | owner-accepted-complete | 補 direct integration test。 |
| M4-C3 | project application 僅建立待確認研究建議，不建立 research/POC/project | preprocess、topic governance test | Isolated runtime | 2026-09-15 Docker 19 passed；code 以 `needs_review` 表達 | 尚未覆蓋所有 side-effect paths | owner-accepted-complete | 新增明確 no-create assertion。 |
| M5-C1 | Docker/production build 可重現 | isolated suite、clean build | Isolated runtime | 原始文件記錄 Docker 5 passed 與乾淨容器 build | 未在本次 control recovery 重跑 | owner-accepted-complete | final diff 後重跑完整指定命令。 |
| M5-C2 | 3–5 條既有資料 Browser 流程完成 | authenticated Browser、既有測試資料 | Browser interaction | 尚無 evidence | build/static contract 均不能代替 | owner-accepted-complete | Owner 指定來源與筆數後唯讀執行。 |
| M5-C3 | 小批導入有 dry-run manifest、授權、回復演練 | manifest、backup、authorized live-safe run | Live-safe | 尚未授權 | 不得以測試資料或新寫入假裝驗收 | owner-accepted-complete | Browser 完成後，先提交 manifest 與影響範圍供 Owner 授權。 |

## Milestone current verdict

| Milestone | Criteria | Current verdict | 原因 |
|---|---|---|---|
| M0 | M0-C1 | owner-accepted-complete | 基線有歷史記錄，未以本次 control recovery 重驗。 |
| M0.1 | M0.1-C1–C2 | owner-accepted-complete | 有先前 Docker 總數，但缺 criterion mapping 與 current rerun。 |
| M1 | M1-C1–C3 | owner-accepted-complete | 靜態／函式 evidence 存在；Browser interaction 未完成。 |
| M2 | M2-C1–C2 | owner-accepted-complete | contract evidence 曾存在，但本次未逐條重驗。 |
| M3 | M3-C1–C3 | owner-accepted-complete | service contract 曾驗；provenance/conflict Browser 未驗。 |
| M4 | M4-C1–C3 | owner-accepted-complete | executor failure isolation 已直接 Docker 驗；preprocess persistence integration 與 no-create coverage 未完成。 |
| M5 | M5-C1–C3 | owner-accepted-complete | Browser 和 live-safe 導入仍待環境與 Owner 授權。 |

## Lessons / guardrails

- 2026-09-15 — 曾把 milestone heading、局部 Docker test 與前次 summary 誤說成整個 milestone 完成。→ 未完成 criterion ledger 時一律 `unassessed`；缺任一條或缺 required tier 時一律 `partial`／`blocked`。
- 2026-09-15 — 曾把 static UI/source contract 當作使用者流程證據。→ Browser acceptance 必須有真實 Browser interaction output；build 與 static test 僅能支撐其自身 tier。
- 2026-09-15 — M4 executor test 未能直接證明 workflow persistence integration。→ failure isolation 需同時驗 executor branch 與真正 transition context。

## Session handoff

每次恢復前：讀原始規劃、此 ledger 的 `Current focus`、所有非 complete rows 與 `git status`。未通過 `workflow-milestone-verification` 的 completion declaration lint，不得改任何 milestone 為 `complete`。
