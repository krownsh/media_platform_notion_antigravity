# 停止「一篇貼文一個資料夾／Topic」實作計畫

> 狀態：規劃完成，尚未實作  
> 範圍：媒體貼文後段 preprocess、Supabase Collection／Topic、Vault 落檔、既有資料遷移  
> 原則：先停止新增污染，再盤點與遷移；不刪除既有資料，不自行合併語義不同的主題。

## 問題定義

目前 unattended preprocess 把模型對單篇貼文產生的 `topic.title` 與 `folder.domain` 直接 materialize 成長期容器：

1. `persistTopicDecision()` 在找不到 Topic 時，建立 `collection_topics`，而且寫成 `origin = agent_auto / status = active`。
2. `persistFolderDecision()` 在找不到同名 Collection 時，建立 `collection_collections`。
3. `stage_m_codex_remote_preprocess.sql` 在遠端 DB-only 路徑重複相同行為，造成 local 與 remote 都會新增容器。
4. `vaultNoteService.buildVaultNotePaths()` 以模型產生的 domain 建 `wiki/domains/<domain>/`；復刻方案再建立 `domain/<domain>/<project>/復刻規劃.md`。
5. `my-mediacrawl-skill` 現行規格明確要求以上路徑，因此只修程式、不修 skill，之後仍會復發。

### 當次 live baseline（2026-09-03）

- 貼文：376 篇；已指派 Collection 290 篇；未指派 86 篇。
- Collection：55 個；其中 33 個標記為 Hermes 自動建立。
- Hermes 自動建立的 Collection 中，29 個只有 1 篇貼文。
- 全部 Collection 中，38 個只有 1 篇貼文，6 個目前為空。
- Topic：60 個，全部為 `agent_auto`，而且 60 個全部只有 1 個 source match。

這證實問題始於資料層，不只是 Obsidian 顯示問題。

## 目標模型

### 五個概念必須分離

| 概念 | 定義 | 是否可由單篇貼文自動建立 |
|---|---|---|
| Post | 一篇來源貼文 | 可以 |
| Workflow context | 分析、候選分類、研究／復刻構想 | 可以 |
| Collection | 使用者在產品 UI 管理的資料夾 | 不可以 |
| Topic workspace | 多篇來源共用、可持續研究的主題 | 不可以直接啟用 |
| Project | Owner 明確決定實作的專案 | 不可以 |

### 新流程

```text
Capture
  → 建立 Post / Workflow
  → 分析與重複偵測
  → 只比對既有 Collection / Topic
      ├─ 有可信既有 ID：建立關聯
      └─ 沒有：保持 unfiled，候選名稱只存 workflow.context
  → Vault 寫入共用來源區
  → Owner 明確接受後，才建立 Collection / Topic / Project
```

## 核心決策

### 1. Unattended preprocess 改成「link-only, never-create」

`persistFolderDecision()`：

- 可沿用 exact duplicate 已存在的 `collection_id`。
- 可接受已驗證、屬於同一 user 的 `collection_id`。
- 不再根據自由文字 `folder.domain` 建立 Collection。
- 沒有可信 ID 時回傳 `assigned: false, reason: no_existing_collection`。

`persistTopicDecision()`：

- 有 `topic_id` 時，只查驗並建立 source match。
- 可用 canonical slug 查找既有 active Topic，但找不到時不可 insert。
- 新候選只寫入 `workflow.context.classification_suggestions.topic`。
- 不再產生 `hermes-<post-id>` Topic。

### 2. 自由文字分類與實體容器 ID 分離

把 preprocess contract 升級為向後相容的 schema v2：

```json
{
  "topic": {
    "topic_id": null,
    "suggested_title": "Claude Code 自動化",
    "confidence": 0.91
  },
  "folder": {
    "collection_id": null,
    "suggested_name": "agent工具",
    "confidence": 0.91
  }
}
```

- `suggested_*` 只供搜尋、UI 提示與後續人工決策。
- 只有 ID 能造成持久關聯。
- 舊的 `topic.title`／`folder.domain` 可暫時讀取，但只能轉成 suggestion，不能觸發 create。

### 3. Topic 恢復「提案不是 active workspace」

Stage C 原始設計本來要求 agent-created Topic 為 `agent_proposal / proposed`；Stage K 才放寬成 `agent_auto / active`。本次要恢復邊界：

- 無明確 Owner 接受，不建立 active Topic。
- 第一版先把候選保存在 workflow context，不增加新 Topic row。
- 未來若要做「多篇來源自動聚類」，必須達到至少 3 個不同 source，才可建立 `agent_proposal / proposed`，仍不能自動 active。

### 4. Vault 不使用模型自由文字建立 domain

一般來源貼文統一寫入：

```text
wiki/threads/<platform>/<YYYY-MM-DD>-<title>--<post-id前8碼>.md
```

規則：

- `<platform>` 是有限集合，不由模型創造。
- 不以 `folder.domain` 或 `topic.title` 建資料夾。
- 同一篇貼文的摘要、研究、POC、復刻構想都放在同一份 managed note。
- 選擇「復刻方案」只新增該來源筆記內的 `## 復刻方案` 區塊。
- 只有 Owner 明確選擇「做成 sideproject」時，才建立正式 Project 卡／工作區。

### 5. Collection 保持 user-owned

- UI 手動建立 Collection 的既有 API 保留。
- 自動處理只能建議既有 Collection，不能新增。
- Frontend 可顯示「建議放入 X」與「暫不分類」，但建立新 Collection 必須是 Owner 動作。

## 實作工作拆分

### Task 0：隔離與保護現場

**不修改產品行為，只建立安全工作區。**

- 目前 `main` 有未提交變更，且 `server/services/autonomousKnowledgeService.js` 與未追蹤測試正好碰到本計畫範圍。
- 實作時不得覆蓋、stash 或清除這些變更。
- 從乾淨基準建立 DevSSD 上的 `agent-dev` worktree；所有新修改只進該 worktree。
- 未經授權不 merge main、不 push。

### Task 1：先寫 RED 測試，鎖住「不可自動建立」

**Files**

- Modify: `test/script/autonomous_preprocess_contract.test.js`
- Modify: `test/script/vault_note_contract.test.js`
- Add: `test/server/autonomous_knowledge_no_autocreate.test.js`
- Add: `test/script/no_auto_container_sql_contract.test.js`

**測試案例**

1. 只有 `folder.suggested_name/domain` 時，不呼叫 `collection_collections.insert()`。
2. 提供合法既有 `collection_id` 才能 assign。
3. exact duplicate 可繼承既有 Collection。
4. 只有 `topic.suggested_title/title` 時，不呼叫 `collection_topics.insert()`。
5. 提供既有 `topic_id` 才能建立 match。
6. SQL remote preprocess 不包含 auto insert Collection／active Topic 路徑。
7. Vault source path 不含模型 domain。
8. replication plan 不建立獨立 `domain/<domain>/<project>/` 目錄。
9. retry 保留 managed block 外的人工內容。

### Task 2：修改 local preprocess contract 與 persistence

**Files**

- Modify: `server/services/autonomyPolicyService.js`
- Modify: `server/services/autonomousKnowledgeService.js`
- Modify: `scripts/agent-sdk/preprocess-workflow.js`

**步驟**

1. 加入 `collection_id / suggested_name / suggested_title` 正規化。
2. 舊欄位降級為 suggestion，不允許 materialize。
3. 將 `persistFolderDecision()` 改成只繼承或連結既有 ID。
4. 將 `persistTopicDecision()` 改成只連結既有 ID／slug，不再 insert。
5. 將未採用候選寫入 `workflow.context.classification_suggestions`。
6. `toNoteInput()` 不再把 suggestion 當作 Vault domain。

### Task 3：修改 remote DB-only preprocess，維持 local/remote parity

**Files**

- Add migration: `database/deployments/stage_o_stop_auto_container_creation.sql`
- Modify: `database/deployments/schema_aggregator.sql`
- Update SQL contract tests from Task 1

**步驟**

1. Replace `codex_stage_collection_preprocess()`。
2. 移除以 `v_topic_title` 自動 insert active Topic 的分支。
3. 移除以 `v_domain` 自動 insert Collection 的分支。
4. 只接受屬於相同 user 的既有 ID；無 ID 則保持 unfiled。
5. 把自由文字候選保存在 context，不丟失分析結果。
6. 保持 vault_sync queue、lease release、error log 與現有停止條件不變。

### Task 4：修改 Vault writer，消除一文一資料夾

**Files**

- Modify: `server/services/vaultNoteService.js`
- Modify: `scripts/agent-sdk/write-vault-note.js`
- Modify: `test/script/vault_note_contract.test.js`

**步驟**

1. `buildVaultNotePaths()` 改成固定 `wiki/threads/<platform>/`。
2. filename 加 post ID 短碼，避免同名貼文覆蓋。
3. replication 內容併入同一份來源筆記 managed block。
4. 移除自動 `domain/<domain>/<project>/復刻規劃.md` 寫入。
5. Outcome 保留 `outcome=saved + relative_path + post_id` 三欄。
6. retry 對同 post 保持 idempotent，且保留人工補充。

### Task 5：更新 UI／API 語意

**Files**

- Modify: `server/index.js`（Topic API 僅保留 user explicit create）
- Modify: `src/utils/folderSuggestion.js`
- Modify: 相關 collection/topic selector component（實作前以搜尋確認確切檔案）
- Modify tests: `test/script/topic_api_contract.test.js`, `test/script/folder_suggestion.test.js`

**步驟**

1. Folder suggestion 僅回傳既有 collection ID。
2. Topic suggestion 僅回傳既有 Topic 或 suggestion，不自行建立。
3. UI 明確區分「建議歸類」與「建立新資料夾」。
4. 使用者未選擇時保持未分類，不阻塞貼文其他處理。

### Task 6：更新 skill 與操作文件

**Files**

- Modify: `hermes/skills/my-mediacrawl-skill/SKILL.md`
- Modify: `hermes/skills/my-mediacrawl-skill/references/vault-notes.md`
- Modify: `docs/topic_agent_mvp.md`

**規則更新**

- 明文寫入 `unattended preprocess is link-only; never create Collection/Topic/Project`。
- Preprocess JSON 範例改成 ID + suggestion。
- Vault path 改成 `wiki/threads/<platform>/...`。
- 復刻方案預設併入來源筆記；只有 sideproject 決策才能建立 Project。

### Task 7：先停止新增污染，再做既有資料 dry-run

**Add scripts**

- `scripts/maintenance/audit-auto-containers.js`
- `scripts/maintenance/plan-auto-container-migration.js`

輸出到 DevSSD，不直接更新資料庫：

```text
artifacts/container-migration/<timestamp>/
├── baseline.json
├── collection-plan.csv
├── topic-plan.csv
├── vault-plan.csv
└── unresolved.json
```

每筆需包含：舊 ID／路徑、post ID、建議目標、依據、confidence、是否需人工確認。

### Task 8：既有資料遷移（需要第二次 Owner 授權）

本階段不包含在第一次實作授權內。

1. 先備份 DB 對照與 Vault 受影響檔案至 `/Volumes/DevSSD/hermes/`。
2. Owner 確認 canonical mapping。
3. Collection：將貼文重新掛到確認後的既有 Collection，未確認者設為 unfiled。
4. Topic：把可合併的 source matches 移到 canonical Topic；其餘 legacy singleton 標為 archived，不刪除。
5. Vault：移動至 `wiki/threads/<platform>/`，更新 workflow `relative_path` 與內部 links。
6. 不留大量 redirect stub；以 migration manifest 保留追溯。
7. 執行 post-migration count 與 broken-link 檢查。

## 驗證方式

### Docker 隔離測試

依 Owner 的既有要求，不能只做 host code review：

```bash
docker run --rm \
  -v "$PWD:/app" \
  -w /app \
  node:20-alpine \
  sh -lc 'npm ci && npm test'
```

另外執行針對性測試：

```bash
node --test \
  test/server/autonomous_knowledge_no_autocreate.test.js \
  test/script/autonomous_preprocess_contract.test.js \
  test/script/no_auto_container_sql_contract.test.js \
  test/script/vault_note_contract.test.js
```

### 必須通過的驗收條件

1. 用全新名稱跑一筆 preprocess，Collection count 不增加。
2. 用全新名稱跑一筆 preprocess，Topic count 不增加。
3. 未匹配的貼文保持 `collection_id = null`，但分析、搜尋、研究流程照常完成。
4. 提供既有 Collection／Topic ID 時，關聯成功且不新增容器。
5. 一篇新貼文只新增一份 `wiki/threads/<platform>/...md`，不新增 domain/project 資料夾。
6. 選「復刻方案」只更新同一份來源筆記。
7. local preprocess 與 remote DB-only preprocess 結果一致。
8. queue、Cron、vault_sync drain 不因本次修改而停住。
9. API／DB error log 仍包含 workflow ID、post ID 與失敗 stage。
10. 完整測試在 `node:20-alpine` 容器內通過，回報實際輸出。

## 明確不做

- 不直接刪除任何 Collection、Topic 或 Vault 檔案。
- 不自動把語義相近的資料夾強行合併。
- 不把既有 user-created Collection 當成污染資料。
- 不在修規則前先搬舊資料。
- 不 push、不 merge main、不部署。

## 執行邊界

第一次「開工」建議只授權 Task 0–7：修規則、測試、產生 dry-run；不遷移既有資料。Task 8 必須等 Owner 看過 dry-run mapping 後另行授權。
