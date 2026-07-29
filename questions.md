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
