# 主題工作區治理計畫

日期：2026-09-04

## 已確認決策

- 主題採「專案為主、領域為輔」；一個主題代表 `專案 × 領域`，不是單篇來源的 AI 摘要，也不是通用分類標籤。
- 專案身分採 GitHub remote 的 `github:owner/repository`，而非本機資料夾名稱。
- 只納入 GitHub 近 30 天有更新的 repo 作為 active project；其他資料只可留在收件匣或封存，不得自動建立 active topic。
- Agent 與 Hermes 可以提出候選，但不得建立 active topic 或自動接受來源匹配。

## Collection 與 Vault 實體歸檔（2026-09-05）

- Owner 建立的 Collection 一律保留，不改名、不刪除、不自動重新掛載其中貼文。
- 只有 description 明確標示為 `Hermes 自動建立的媒體分類資料夾` 的 Collection，才列入收斂與遷移候選。
- 一篇來源筆記只會有一個 Vault 實體位置：有既有 Collection 時寫入
  `wiki/collections/<Collection 名稱>/`；尚未分類時寫入 `wiki/inbox/`。
- 平台只保留在筆記 metadata，不能再決定來源筆記的資料夾路徑。
- Topic 是 `Project × 受控領域` 的多對多研究索引，不產生來源筆記副本或每篇資料夾。
- 已完成的 Vault write 會沿用已記錄且存在的 `relative_path`；Collection 改名不會在重試時悄悄複製出第二份來源筆記。實際搬移必須由已核准的 migration manifest 執行。
- 收斂 dry-run 僅能把 Hermes Collection 指向名稱完全匹配的既有 Owner Collection；沒有明確規則的資料一律維持未分類並進 `wiki/inbox/`，禁止自行創造新的收納類別。

## Active project registry

GitHub 查詢條件：`user:krownsh pushed:>=2026-08-05`。

| 顯示名稱 | 穩定專案識別 | 初始領域 |
| --- | --- | --- |
| Media Platform／知識行動庫 | `github:krownsh/media_platform_notion_antigravity` | 來源擷取、知識／RAG、Agent 工作流、內容流程 |
| My Hater React Native | `github:krownsh/my_hater_react_native` | 行動 App 開發 |
| Full-stack Path Inspector | `github:krownsh/my_full-stack-path-inspector` | 架構分析、程式碼智慧、開發者工具 |
| Chrome Extension Ordering | `github:krownsh/my-chrome-extension-ordering` | 瀏覽器擴充功能、工作流自動化 |
| Stock Portfolio Dashboard | `github:krownsh/v0-stock-portfolio-dashboard` | 市場資料、投資組合、技術分析 |
| myStickyBook | `github:krownsh/My-sticker-book` | iOS／SwiftUI、生活手帳、視覺／貼紙內容 |

領域是受控字典，不能由 Agent 任意造詞：

- `agent_workflow`
- `knowledge_rag`
- `data_crawling`
- `architecture_analysis`
- `browser_automation`
- `mobile_app`
- `ios_swiftui`
- `market_data`
- `portfolio_analysis`
- `visual_content`
- `product_growth`
- `infrastructure_security`

## 資料治理與遷移

1. 新增 project registry，topic 以 `project_id` 外鍵連結；topic 儲存單一受控 `domain_key`。
2. 先建立六個 active project，並建立使用者確認的 `專案 × 領域` topic；不從舊資料自動猜測或合併。
3. 現有 60 個 `agent_auto` topic 與其來源匹配保留稽核軌跡，不刪除。
4. 使用者確認對照後，將保留來源移至新 topic；舊 topic 改為 `archived`。
5. 目前 35 個 agent 自動 `accepted` 的 match 先降級為待人工覆核的 `suggested`，並保留原始分數、理由與 agent 來源。

## Hermes 與工作流對齊

### 停止自動建立與接受

- `scripts/agent-sdk/preprocess-workflow.js` 與
  `server/services/autonomousKnowledgeService.js` 已改為只儲存 proposal / suggestion。
- `scripts/agent-sdk/codex-remote-preprocess.js` 與
  `server/services/codexRemotePreprocessService.js` 已將 topic input 從既有 Stage M RPC 移除，僅保留 proposal 在 workflow context；Stage O 另用資料庫 trigger 防止任何繞過路徑建立 `agent_auto` topic。
- 不再允許新資料寫入 `origin = agent_auto` 或直接寫入 `status = accepted`。

### 以已確認主題驅動後續工作

1. 貼文詳情頁顯示 candidate topic、命中詞與理由；使用者可接受或拒絕。
2. Topic 頁只以「已接受來源」作為研究與行動的證據集。
3. `scripts/agent-sdk/research-workflow.js` 已檢查 active user topic 的 accepted match，並將 accepted topic snapshot 寫入研究 workflow context。
4. `scripts/agent-sdk/run-poc-workflow.js` 已檢查 active user topic 的 accepted match 與顯式 POC confirmation；既有 `analyze-item` 仍以 project target 的 topic scope 限制實際本機 repo。
5. `scripts/agent-sdk/triage-workflow.js` 只能產生候選；`scripts/agent-sdk/decide-workflow.js` 是唯一可記錄使用者接受／拒絕結果的流程。
