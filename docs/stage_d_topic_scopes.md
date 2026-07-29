# Stage D：資料夾主題範圍

這個階段把既有的 `collection_collections` 資料夾變成使用者控制的行動邊界。

## 部署

在 Supabase SQL Editor 執行：

`database/deployments/stage_d_collection_topic_scopes.sql`

它只會建立 `collection_topic_scopes`；不會修改貼文、分類、內容草稿或既有 POC 資料。

## 模式

- `collect`：只收藏。
- `research`：允許研究提案，但不執行專案 POC。
- `poc_proposal`：只有在 `project_targets` 含目標專案別名時，才允許建立 POC 提案。

`poc_proposal` 不是自動執行權限。CLI 預設只產生提案；只有人類明確執行下列指令後，才會呼叫模型、Tavily 與 Docker：

```powershell
node scripts/agent-sdk/analyze-item.js <outbox_id> --execute-poc
```

不帶 `--execute-poc` 時，使用本機規則分類與唯讀的專案掃描，不會呼叫 MiniMax、Tavily 或 Docker。

## UI 設定

部署後到 `Insight` 頁面的「主題範圍與行動界線」：

1. 選資料夾的模式。
2. 填主題目標（描述該資料夾可思考的問題）。
3. 若選「POC 提案」，填可比對專案，例如 `media_platform_notion_antigravity`。
4. 儲存。
