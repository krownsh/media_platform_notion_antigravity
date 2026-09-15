# Media 知識工作流改善里程碑

狀態：執行中（Owner 已於 2026-09-15 授權開工）。即時驗收結論以 [[media_knowledge_workflow_acceptance_ledger_2026-09-15]] 為準；本文件保留原始目標與範圍。

## 不可混淆的兩個平行終點

1. **知識主題收藏**：跨來源彙整相同工具、概念、方法與可驗證關係，形成持續更新、可追溯的主題筆記。
2. **專案應用研究**：將來源或知識連到既有專案的需求、限制與可採用方案。

兩端共用來源、抽取內容與證據；各自有狀態與決策。一端不得阻塞、覆蓋或冒充另一端完成。

## M0｜狀態契約與現況盤點

已確認：

- `collection_post_workflows.stage/status` 是使用者可見的工作流事實來源；`collection_capture_outbox.status='sent'` 僅代表技術 ACK。
- `/api/posts` 已帶回 workflow，但前端 `workflowPresentation.js` 將多個不同階段折疊成「AI 整理中」或「後續行動中」。
- `preprocess-workflow.js`（一般與 `--defer-vault`）及 `codexRemotePreprocessService.js` 在保存工作流後尚未做共用 Outbox ACK。
- `triage-workflow.js` 有舊的專用 ACK，無法涵蓋上述路徑。
- 本里程碑不修改 review、Vault 寫入、Cron 排程或 DB schema。

## M0.1｜Outbox ACK 一致性修正

目標：結果保存成功後，以單一、可驗證、樂觀鎖保護的 ACK 處理技術 Outbox。

範圍：

- 保留 `agent:preprocess` 為主流程與 `agent:triage` 相容入口。
- 新增共用 ACK，接入一般預處理、延後 Vault、遠端 DB 預處理與 triage。
- ACK 必須驗證 `workflow.user_id`、`workflow.post_id`、`workflow.outbox_event_id` 與 Outbox event 的 `user_id`、`aggregate_id`、`id` 一致。
- ACK 成功：標記技術事件 `sent`、解除 Outbox 鎖、保留已保存 workflow。
- ACK 失敗：僅保存 ACK 錯誤並釋放該 ACK 鎖；不得回退 workflow、不得重跑來源內容。
- 新增預設 dry-run 的修復工具；先逐筆產出核對結果，僅能執行明示核准清單。

不在範圍：review、Vault、Cron、DB schema、批次自動修復全部歷史資料。

驗證：嚴格 TDD；單元／契約測試後，以 Docker 隔離測試。任何正式資料修復前必須先備份至 `/Volumes/DevSSD/hermes/`，並另經 Owner 授權。

完成證據（2026-09-15）：Docker `node:20-alpine` 執行 `hermes_outbox_service`、`outbox_ack_repair_audit`、`hermes_cron_pull`，20 passed / 0 failed。

## M1｜全部貼文頁的流程可見性

以補丁方式保留現有列表、搜尋、分類與卡片，新增：

- 工作流階段與狀態的精準標記。
- 快捷篩選與可選依狀態分組。
- 每篇的「現在在哪裡、等待誰、為何等待、可做什麼」。
- 來源、知識整理、專案應用、Vault／技術事件的清楚區隔。
- 未知與失敗狀態如實呈現；Outbox ACK 不得冒充內容處理失敗。

## M2｜知識收藏與專案應用的平行狀態模型

定義兩端獨立的 pending／processing／needs-review／completed／not-applicable／failed 等狀態，並建立向下相容的 API 與前端映射。

完成證據（2026-09-15）：Docker `node:20-alpine` 執行平行 track contract 與 workflow UI projection contract，5 passed / 0 failed；涵蓋 legacy fallback、六狀態限制、非法 technical status 隔離、sibling/context 保留、tenant/optimistic-lock API 更新與前端雙軌呈現。

## M3｜跨來源知識彙整

將工具、概念、方法與明示關係去重後彙整入可更新主題筆記；每項結論均可回鏈到來源。以 UI 設計套件與工作流為首個驗收案例。

完成證據（2026-09-15）：Docker `node:20-alpine` 執行 topic knowledge aggregate 的 service、migration、human-match route 與 UI contract，5 passed / 0 failed；涵蓋 accepted evidence only、概念去重、source ID traceability、controlled aggregate 與人工描述分離、revision conflict surface。

## M4｜增量更新與錯誤隔離

支援主題增量更新、衝突／人工編輯保護、版本與可觀測性。同步或單一分支失敗不阻塞其餘分支。

完成證據（2026-09-15）：新增 `parallelTrackExecutionService`，並接入 `agent:preprocess`。knowledge 與 project_application 逐支執行，失敗會只將自身標為 `failed` 並保留錯誤原因；sibling 的結果保留在同一個 workflow context，經既有 optimistic-lock transition 持久化。project_application 僅產出 `needs_review` 的研究建議，未自動建立 research、POC 或專案。Docker `node:20-alpine` 執行 executor isolation、parallel-track、preprocess 與 topic-governance contracts：19 passed / 0 failed。

## M5｜驗收與小批導入

先以 Browser 測試 3–5 條流程，再導入小批歷史資料；驗證不污染其他流程後才擴大。保留可回復機制。

前置完成證據（2026-09-15）：新增 `test/script/m5_read_only_acceptance_contract.test.js`，Docker `node:20-alpine` 驗證 5 passed / 0 failed；確認 Topic dry-run 受 JWT／tenant scope 保護、沒有 live batch-import endpoint、UI 顯示受控彙整與每個來源的 `/post/:postId` 回鏈、aggregate revision protection，以及 Vault sync 逐筆 failure isolation。另以乾淨容器 `npm ci --ignore-scripts && npm run build` 實際完成 Vite production build。

待 Owner 指定既有測試資料的來源與筆數後：執行唯讀 browser 流程驗收，提交小批 dry-run manifest；取得明確授權後才可進行任何 live 寫入或回復演練。
