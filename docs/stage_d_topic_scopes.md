# Stage D：資料夾主題範圍

這一層把你的收藏資料夾變成工作流的「行動邊界」，而不是拿通用分類或程式 TODO 猜題目。

## 部署

在 Supabase SQL Editor 執行一次：

`database/deployments/stage_d_collection_topic_scopes.sql`

接著執行：

`database/deployments/stage_d_1_unfiled_topic_scope.sql`

它建立 `collection_topic_scopes`，並讓未整理貼文可有一個安全的使用者層級範圍。現有的 `collection_collections` 資料夾與既有收藏都不會被修改。

## 三種模式

- `collect`：只保存來源。不能研究、專案比對、產生或執行 POC。
- `research`：保留作研究題材；不會比對專案或產生 POC。
- `poc_proposal`：可針對 `project_targets` 中明確指定的 GitHub repo（格式 `github:owner/repository`），做本機唯讀盤點與 POC 提案。

`poc_proposal` 絕不表示自動執行。預設 `agent:analyze` 只會產生提案，不呼叫 MiniMax、Tavily 或 Docker。

## 操作

1. 開啟 Insight 頁面的「主題範圍與行動界線」。
2. 未整理貼文不需要先放資料夾；它有自己的安全預設。
3. 對每個資料夾選擇模式，並填入主題目標。
4. 只有在選擇 `POC 提案` 時，填入要允許比對的 GitHub repo，例如 `github:krownsh/media_platform_notion_antigravity`。
4. 按「儲存」。

先產生提案：

```powershell
npm run agent:analyze -- <outbox_id>
```

只有你明確決定要執行時才用：

```powershell
npm run agent:analyze -- <outbox_id> --execute-poc
```

後者才可能呼叫 MiniMax、Tavily 與 Docker sandbox。

## GitHub 連接界線

- `github:owner/repository` 是跨電腦的專案身分；本機 checkout 只是實際掃描與 sandbox 的暫時執行位置。
- Codex 的 GitHub connector 可讓操作員唯讀盤點與搜尋 repo，但它不是產品 runtime 可直接呼叫的服務。
- 若產品要自動同步使用者所有 repo，下一階段應使用只讀權限的 GitHub App 或 GitHub OAuth，並將同步結果存為專案目錄；不應把個人 access token 放進瀏覽器或資料庫。
