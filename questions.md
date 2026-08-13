# Questions

## 2026-07-29：目前 POC 工作流是否已完成？

### 使用者提問

「你說的〔POC 對應的 threadsCrawler.js TODO〕這是啥我不懂。所以我現在整個工作流是 ok 的嗎？會怎麼走？」

### 說明

- `threadsCrawler.js TODO` 是 Project Auditor 在現有專案程式碼中找到的一個未完成標記。它被 Opportunity Matcher 當成「可拿來測試 Code Review POC 的候選目標」，不是使用者必須立刻開發的需求，也不是 POC 成功後必然要整合的功能。
- POC 工作流已完成真實驗證：來源擷取、Tavily 擴充、路由判斷、沙盒程式生成與靜態安全檢查、受限 Docker 執行、Supabase JSONB 寫回、貼文詳情頁結果顯示均已成功。
- 目前是可手動觸發的完整流程，不是常駐自動 worker。每次新來源仍需由本機 runner 啟動分析；POC 路由完成後，結果會寫入貼文詳情頁的「POC 驗證結果」面板。
- 原作者貼文預設只保存與顯示原文。再創作路由只能作為可選草稿，不能自動發布或當成主要交付。

## 2026-07-29：未整理貼文與跨電腦專案識別

### 使用者提問

「那如果我根本還沒有為貼文整理資料夾呢？不同電腦資料夾名稱不一樣的話，專案名稱基準是什麼？是不是可以直接連結 GitHub？」

### 說明

- 未整理貼文不應被逼著先分類。系統會提供一個使用者層級的「未整理貼文」範圍，預設 `collect`，所以它只保存來源，不會自動研究或提出 POC。
- 專案的穩定身分採 Git remote 推得的 `github:owner/repository`，而非本機資料夾名稱。以本專案為例是 `github:krownsh/media_platform_notion_antigravity`。
- GitHub repo 用來識別同一個專案與日後讀取遠端；目前程式內容的唯讀掃描仍針對本機已 checkout 的同一 repo。沒有對應 checkout 時，不允許執行 POC。
- `poc_proposal` 只產生提案；MiniMax、Tavily 與 Docker 仍要人類明確加上 `--execute-poc`。
- 已確認 Codex 的 GitHub connector 可唯讀列出目前授權帳號可存取的 `krownsh` repo；但這只服務於 agent 操作。產品 runtime 應另接只讀 GitHub App／OAuth，不能把 MCP 當成產品的常駐 API。

## 2026-07-29：Atomic Finalization 與 Hermes Agent 的正確分工

### 使用者提問

1. 「原子 Finalization 這是啥、要幹嘛？」
2. 「不需要常駐 Outbox Dispatcher；系統要搭配 Hermes Agent，讓 Agent 定期去資料庫找資料，不能貼文寫入後完全不管，錯誤還沒人知道。」
3. 「產生 `source_routes`、依允許範圍建立 `agent_jobs` 是什麼、要幹嘛？」

### 說明與決策

- Atomic Finalization 是資料庫的一次 transaction：來源、analysis、media、comments 與 `source.ingested.v1` outbox 必須全部成功，任何一步失敗就全部 rollback。它避免 Hermes 讀到半套資料，或文章已入庫但沒有待辦事件。
- 系統改採 Hermes pull-based 模式，不建立後端常駐 dispatcher。`/api/process` 只完成擷取與原子入庫；Hermes Cron 先用零 LLM 的 gate 查 pending outbox，有資料才喚醒 Agent。
- Hermes claim 時保持 `pending`，只寫入 `locked_at`、`locked_by`、`attempt_count`；這樣主機中斷後可在 lease 過期時重新接手。成功寫入 route plan 才改成 `processing`，stored-only 則直接完成；失敗寫入結構化 `last_error` 並通知，禁止 silent failure 與無限自動重試。
- MVP 不寫 `source_routes` table。既有 `collection_capture_outbox.payload.agent_routes` 已保存同一份 route plan，再寫一張表會形成兩個真相來源。
- `agent_jobs` 只代表「人類已批准執行的具體任務」，包含允許的專案、路徑、命令、lease、結果與錯誤。文章入庫或分類時不能自動建立 `agent_jobs`。
- POC、改碼、安裝套件與發布仍需明確人工批准；Hermes 預設分析命令不得帶 `--execute-poc`。

## 2026-07-29：剛才是否已修改資料庫？下一步是什麼？

### 使用者提問

1. 剛才有改資料庫嗎？
2. 下一步是什麼？

### 回答與決策

- 尚未修改線上的 Supabase 資料庫，也沒有執行任何 migration。
- 已修改的只有本機 schema 文件與新增 additive migration：`database/deployments/stage_d_2_article_title.sql`。
- 下一步只做一件事：經人類明確確認後，把該 migration 套用到 Supabase；完成後再設定 Hermes Cron。

## 2026-07-29：為什麼沒有一次講完整個剩餘流程？

### 使用者提問與糾正

- 使用者已套用 migration，並指出逐步追問下一步非常疲累；要求一次講完所有待辦。

### 修正後的完整交接

- 已唯讀確認 `collection_posts.title` 可讀，且 `finalize_collection_capture` RPC 已暴露；舊文章 title 為 null 屬正常，因 migration 不回填。
- 尚未完成的必要鏈：讓實際 backend 載入本機新程式、在真正的 Hermes 主機安裝／找到 CLI、安裝 gate、設定 project root、建立帶訊息投遞的 Cron、跑新文章 happy-path E2E、跑 disposable failure drill、確認人工核准邊界。
- 目前程式只在本機 `agent-dev` commit，尚未 push／deploy；目前 Windows 找不到 `hermes` 指令，因此尚未建立 Cron。
- 後續交接必須一次列出已完成、未完成、阻塞、驗收與需授權項目，不得再擠牙膏。

## 2026-08-13：Hermes dispatch 改為一次性喚醒

目前實作已更新為：Capture Worker 完成一筆來源並原子寫入後，只觸發一次
Hermes webhook dispatch；不再啟動 `media-collection-hermes-dispatcher` 的常駐
polling。Hermes Cron 或手動 `npm run agent:dispatch-once` 也各只嘗試一次。
Supabase 的 singleton lease 保證同一時間最多一個 Hermes Agent；Agent 完成或
失敗後才釋放 slot 並嘗試喚醒下一筆。Capture queue 的 polling 仍保留，因為它
負責實際爬取／儲存，不是 Hermes 分析輪詢。
