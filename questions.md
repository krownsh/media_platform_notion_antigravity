# Questions

## 2026-07-29：目前 POC 工作流是否已完成？

### 使用者提問

「你說的〔POC 對應的 threadsCrawler.js TODO〕這是啥我不懂。所以我現在整個工作流是 ok 的嗎？會怎麼走？」

### 說明

- `threadsCrawler.js TODO` 是 Project Auditor 在現有專案程式碼中找到的一個未完成標記。它被 Opportunity Matcher 當成「可拿來測試 Code Review POC 的候選目標」，不是使用者必須立刻開發的需求，也不是 POC 成功後必然要整合的功能。
- POC 工作流已完成真實驗證：來源擷取、Tavily 擴充、路由判斷、沙盒程式生成與靜態安全檢查、受限 Docker 執行、Supabase JSONB 寫回、貼文詳情頁結果顯示均已成功。
- 目前是可手動觸發的完整流程，不是常駐自動 worker。每次新來源仍需由本機 runner 啟動分析；POC 路由完成後，結果會寫入貼文詳情頁的「POC 驗證結果」面板。
- 原作者貼文預設只保存與顯示原文。再創作路由只能作為可選草稿，不能自動發布或當成主要交付。
