# Everynote 知識分類與知識圖執行任務

> 狀態：**規劃已記錄，等待 Owner 明確說「開工 Phase N」**。本檔不是 DB 寫入、資料夾建立、貼文搬移或刪除授權。
>
> Canonical taxonomy：`docs/knowledge-taxonomy/source-taxonomy-v1.json`

## 已確認的架構決策

### 1. 來源資料夾（唯一一級分類）

- `source-taxonomy-v1.json` 的 **20 個分類**是唯一正式的一級來源分類。
- 路由問題：**「這篇來源未來主要幫我完成哪一種工作？」**
- 一篇貼文最多一個主資料夾；無法明確判定時保持 Inbox。
- 現有 53 個 `collection_collections` 不是新版白名單；全部是 legacy，不得再用於新貼文路由。
- 不可用 `primary_category`、舊自動 topic 或 tag 取代一級資料夾。

### 2. 新來源資料夾的擴充治理

Owner 授權：若 20 類均不適用、且確有必要，可建立新來源資料夾。

建立前必須同時符合：

1. 所有現有分類的 include/exclude 明確不適用。
2. 不是單一工具、單一公司、單一事件或短期熱門詞。
3. 是可重複出現、可產生長期工作結果的類型。
4. 有明確名稱、include、exclude、首次來源與和既有類別的差異。
5. 建立新版 `source-taxonomy-v<N>.json` 與 immutable decision record；不得靜默修改 v1。

### 3. Legacy 53 資料夾

- 第一階段退出日常 UI、禁止作為新路由目的地。
- **不自動搬移或重新分類舊貼文**；舊貼文由 Owner 後續逐篇討論。
- 真正物理 delete 必須等所有 post/map/scope/workflow 引用為零，完成 DevSSD backup、逐 ID delete manifest、Owner 明確核准與 live readback 後才可執行。
- 在真正 delete 前，以 retired/hidden/legacy 狀態保存歷史脈絡；不可將「前端隱藏」冒充「已刪除」。

### 4. 知識圖（不等於資料夾）

知識圖以 Owner 已執行過的專案為起點，核心 node 僅為：

- **System**：持續運行的工作機制或產品系統。
- **Architecture**：系統的組成、責任與運作方式。
- **Idea**：可驗證、採用或反駁的原理、策略、假設。

允許關係：`implements`、`uses`、`constrains`、`evidenced_by`、`contradicts`、`extends`。

**Owner-first gate：貼文絕不自動加入知識圖。** 每次要加入時，必須先問 Owner：

```text
這篇要延伸哪一個既有專案／知識地圖？
還是要以它建立一張新的知識地圖？
```

只有 Owner 指定既有地圖或明確同意建立新地圖後，才可建立 evidence link、節點或關係。新概念不可只因單篇貼文而自動成為正式 node。

### 5. 新 URL 的目標體驗

```text
URL / image
→ Capture API
→ Capture Worker 保存原始來源
→ Inbox
→ 以 20 類判斷主資料夾，或低信心保留 Inbox
→ 若涉及知識圖，先問 Owner 要延伸既有哪一張地圖／專案，或建立新地圖
→ research / POC / content / Vault 均另經 Owner 決定
```

## 執行 Phase 與 Gate

### Phase 0 — Governance 文件定版（無 live mutation）

- [x] 新建 `source-taxonomy-v2.json` 的治理格式；v1 保持 immutable。
- [x] 記錄 20 類為唯一一級分類、taxonomy 擴充條件、legacy 退休政策。
- [x] 更新 capture skill/SOUL：新來源可在 20 類中路由；低信心留 Inbox；知識圖必須 Owner-first 問題。
- [x] 更新本 repo 的 taxonomy plan 與 acceptance ledger，移除「folder = topic」的錯誤敘述。

**Gate：** Owner 審閱文件。不得建立 collection、不得寫 DB。

### Phase 1 — 唯讀 live inventory 與 migration manifest

- [x] 盤點 53 個 legacy collection：ID、名稱、post/map/scope/workflow 引用、owner、可否 retire。（2026-09-25 唯讀 manifest）
- [x] 盤點既有 `collection_topics`、source matches、知識圖相關 schema；不把它們當一級分類。（2026-09-25 唯讀 manifest）
- [x] 產出 20 類 bootstrap manifest：key、名稱、include/exclude、knowledge-space affinity、預期 DB 目的地。（2026-09-25 唯讀 manifest）
- [x] 產出 legacy retirement manifest；任何有引用項目列 blocker。（2026-09-25 唯讀 manifest）
- [x] 對資料範圍、schema 與 manifest 做 read-only 回讀。（2026-09-25；Phase gate 仍等待 Owner 確認）

**Gate：** Owner 確認 manifest；不得變更舊貼文或舊 collection。

### Phase 2 — Docker-first 安全能力（程式與 migration 設計）

- [ ] 新貼文只允許寫入 v2 canonical taxonomy 的 collection。
- [ ] 每篇貼文至多一個主資料夾；legacy ID 不可作新路由目的地。
- [ ] 低信心／跨類／來源不足保持 Inbox，不得硬塞。
- [ ] 新 taxonomy 類別建立要有 version、理由、來源與 audit record。
- [ ] 既有貼文的人工歸屬不得被重跑、retry 或並行操作覆蓋。
- [ ] 知識圖寫入必須要求 Owner 指定既有地圖／專案，或確認建立新地圖。
- [ ] Docker RED→GREEN：明確命中、低信心、legacy 拒絕、冪等、跨租戶、失敗回復、audit、knowledge-map gate。

**Gate：** Docker 實證全部通過，才可提 live mutation 計畫。

### Phase 3 — Live taxonomy bootstrap 與 legacy 退休

- [ ] 高風險操作前完成 schema/function/relation backup 至 `/Volumes/DevSSD/hermes/`，並驗讀與 checksum。
- [ ] 建立 20 個正式來源資料夾；名稱、key、邊界須逐一與 canonical taxonomy 對照。
- [ ] 將舊 53 個 collection 退休／隱藏，禁止新路由；不遷移舊 post。
- [ ] 逐項 readback：20 類正確、legacy 不可路由、舊 post 歷史 relation 未毀損、Inbox 正常。

**Gate：** Owner 明確核准 backup、逐 ID manifest、預計資料範圍與 PM2/DB 操作；完成 live readback。

### Phase 4 — 啟用新 URL 路由

- [ ] URL capture 後依 canonical 20 類產生主資料夾決策與理由。
- [ ] 不明確時保留 Inbox 並呈現候選與差異。
- [ ] 達新分類條件時建立 taxonomy v<N> 與 decision audit。
- [ ] 不產生 AI category/tag/topic/workflow/outbox；research/POC/content/Vault 保持 Owner gate。
- [ ] 若使用知識圖，先問 Owner「延伸既有哪張地圖／專案，或建立新地圖？」
- [ ] Docker + live single-source E2E 驗證，列出實際輸出。

### Phase 5 — 舊貼文逐篇整理

- [ ] 僅處理 Owner 指名的單篇 post。
- [ ] 顯示原始來源、legacy 歸屬與 20 類候選；Owner 決定後才寫入。
- [ ] 保留 before/after/reason/audit；每篇回讀。
- [ ] 未決、低信心或不值得整理者保留 legacy-unreviewed / Inbox，不冒充已整理。

### Phase 6 — 專案導向的知識圖

- [ ] Owner 先指定一個已執行專案與既有地圖作 pilot。
- [ ] 建立 System / Architecture / Idea nodes，並記錄每個 node 的定義、範圍、來源證據。
- [ ] 每個 relation 都需可解釋與可回鏈；不以標題、tag 或 AI 摘要冒充證據。
- [ ] 新概念僅在 Owner 指定地圖／同意新地圖後加入。
- [ ] 驗收「問題 → 專案地圖 → node/relation → 原始貼文」的查找路徑。

## 不能做的事

- [ ] 不把現有 53 collection 當新 taxonomy 白名單。
- [ ] 不批次把舊貼文猜測塞入 20 類。
- [ ] 不直接 delete legacy collection 或以隱藏冒充刪除。
- [ ] 不讓 folder、tag、primary_category、舊 topic 互相取代。
- [ ] 不讓貼文自動進入任何知識圖。
- [ ] 不在未通過 Docker、manifest、backup、Owner gate 前寫 live DB。
- [ ] 不修改 Vault，除非 Owner 明示「記」與既有落點。

## 執行紀律

- 每一 Phase 更新同一份 acceptance ledger，記錄：原始通過條件、產物、命令／查詢、實際輸出、證據層級、限制與下一缺口。
- 靜態檢查、Docker、Browser、live readback 不可互相替代。
- Git 精準 stage；不混入既有未追蹤檔；未經授權不 push/merge。
