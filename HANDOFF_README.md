# Everynote 交接：20 類 Taxonomy、Legacy 退休與 Owner-first 知識圖

> **已被現行工作流取代。** 本文件保留為歷史交接證據，不得用作現行 collection
> 行為規則。唯一正式引導是
> `hermes/skills/owner-guided-media-workflow/SKILL.md`；若內容衝突，以該 skill
> 與 `agents.md` 為準。

> **狀態：等待下一位 Agent 開工。** 本文件是交接與執行邊界，不是 live DB、分類、刪除、Vault 或 PM2 操作的授權。

## 0. 入口與必讀文件

```text
專案：/Volumes/DevSSD/10_Projects/Personal/media_platform_notion_antigravity
tasks：/Volumes/DevSSD/10_Projects/Personal/media_platform_notion_antigravity/tasks.md
正式 taxonomy：docs/knowledge-taxonomy/source-taxonomy-v1.json
capture skill：owner-guided-media-workflow
```

先讀 `tasks.md` 與完整 `source-taxonomy-v1.json`，再檢查 `git status`。不得清除、覆蓋或混入既有未追蹤檔。繁中回覆；每項主張須有當次工具輸出。

## 1. Owner 已確認決策

### 20 個來源資料夾是唯一正式一級分類

- `source-taxonomy-v1.json` 的 20 個分類是唯一正式來源資料夾。
- 路由問題：**「這篇來源未來主要幫我完成哪一種工作？」**
- 一篇貼文最多一個主資料夾；不明確、跨類、來源不足時留 Inbox。
- 不使用現有 53 個 collection、`primary_category`、舊自動 topic 或 tag 當一級分類。

20 類：

```text
產品構想與需求驗證
產品策略、成長與商業化
使用者研究、UX 與 Onboarding
UI 設計系統與視覺實作
Web 應用開發
iOS 開發與 App Store
Android 開發與 Google Play
系統架構、後端與資料
工程實踐、品質與測試
Git、PR 與工程協作
部署、CI/CD 與基礎設施
安全、隱私與憑證管理
遊戲與互動產品開發
AI 程式開發工具
Agent 系統、MCP 與自動化
生成式影像、影片與音訊
AI 互動、Prompt 與模型使用
知識管理、學習與個人生產力
投資與金融市場
職涯、生活與興趣
```

### 新分類可建立，但必須是受治理的 taxonomy 擴充

Owner 授權：若 20 類都明確不適用，且確有長期必要，Agent 可以建立新資料夾。

必須同時滿足：

1. 既有 include/exclude 都不適用。
2. 不是單一工具、公司、事件或短期熱門詞。
3. 是可重複出現、可形成長期工作結果的類型。
4. 有名稱、include、exclude、首次來源、與既有類別差異。
5. 建立新的 `source-taxonomy-v<N>.json` 與 immutable decision record；不可靜默改 v1。

目前 v1 還寫 `create_new_categories: owner_approval_required`。Phase 0 必須先正式處理這個新決策與既有文件的規則衝突；不可只改 runtime 文字。

### 53 個舊 collection 是 legacy

- 53 個現有 collection 不再是日常主分類，不能作為新貼文路由目的地。
- 先退休／隱藏，保留舊 post relation 作為歷史脈絡。
- **不批次自動重分舊貼文**；Owner 之後會逐篇討論。
- 真正 delete 必須等 post/map/scope/workflow 等引用歸零，完成 DevSSD 備份、逐 ID delete manifest、Owner 明確核准與 live readback。
- UI 隱藏不是已刪除。

### 知識圖是 Owner-first，不等於資料夾

知識圖的核心節點：

```text
System：持續運行的工作機制或產品系統
Architecture：系統的組成、責任與運作方式
Idea：可驗證、採用或反駁的原理、策略、假設
```

可用關係：`implements`、`uses`、`constrains`、`evidenced_by`、`contradicts`、`extends`。

**貼文不可自動加入知識圖。** 每次要加入前必須先問 Owner：

```text
這篇要延伸哪一個既有專案／知識地圖？
還是要以它建立一張新的知識地圖？
```

只有 Owner 指定既有專案／地圖或明確同意建立新地圖後，才可建立 evidence link、node 或 relation。不得以單篇貼文、tag、標題或摘要自動生成正式 node。

### Owner-first 原則

owner-guided-media-workflow 的目的不是替 Owner 思考或變成教學：

- Agent 做 capture、原始證據、技術狀態、有限選項與風險。
- Owner 決定意義、分類、知識地圖、要延伸哪個專案、是否新建地圖與下一步。
- 只在答案能解鎖真實決策時提問；不腦補、不連環教學、不過度解釋。
- capture、summary、tag 或容器不等於已整理。

## 2. Capture runtime 現況

Live 已完成 capture-only cutover：

```text
Capture API → durable request queue → Capture Worker → process Inbox
```

新 capture：

- 保存來源／媒體。
- 不自動寫 semantic analysis、category、tags、topic、outbox 或 workflow。
- `outbox_event_id` 應為 null。
- 直接 URL／圖片是 capture 指令，不必加「處理」。
- Capture 後呈現來源事實；在 Phase 4 經 Docker + live 驗收前，不可自動選資料夾。

PM2 當次快照：

```text
media-collection-server：online，PID 45584
media-collection-capture-worker：online，PID 45674
```

Cron 都保持 paused：

```text
Media inbox review：job_id 8bdbc7df4531
Media inbox acceleration auto-restore：job_id a279605bdc39
```

不得自行恢復 Cron 或重啟 PM2。

## 3. 執行順序與 Gate

完整 checklist 以 `tasks.md` 為準：

```text
Phase 0：Governance 文件定版，無 live mutation
Phase 1：唯讀 live inventory 與 migration manifest
Phase 2：Docker-first 安全能力
Phase 3：Live taxonomy bootstrap 與 legacy 退休
Phase 4：啟用新 URL 路由
Phase 5：舊貼文逐篇整理
Phase 6：專案導向知識圖
```

### 下一步：只可準備 Phase 0

先向 Owner 復述 Phase 0 的目的、檔案範圍、以及「不碰 DB」邊界。只有 Owner 明確說：

```text
開工 Phase 0
```

才可執行。

Phase 0 允許：

- 建立 v2 taxonomy 的治理格式，v1 保持 immutable。
- 文件化 20 類主架構、taxonomy 擴充、legacy 退休及知識圖 Owner-first gate。
- 更新 skill/SOUL 的規則文字，但不得使 runtime 搶先寫 folder。
- 修正舊文件中「folder = topic」或「舊 collection 是白名單」的錯誤。

Phase 0 禁止：

```text
建立／退休／刪除 live collection
搬移或分類任何 post
寫 DB / Vault
改 PM2 / Cron
建立知識圖 node / relation
```

每個後續 Phase 都需要新的 Owner 明確授權；Phase 0 授權不推定 Phase 1+。

## 4. 工作樹與 Git 警示

Live repo branch：`main`。

已有未提交變更與未追蹤暫存檔，尤其：

```text
M server/services/captureFinalizationService.js
M server/services/captureProcessingService.js
M tasks.md
?? 多個 .hermes-* / .tmp-* 暫存檔
?? docs/plans/2026-09-15-all-posts-knowledge-organization.md
```

capture-only 隔離 worktree：

```text
/Volumes/DevSSD/hermes/worktrees/capture-only-intake
branch: agent/capture-only-intake
```

其中另有未提交 source/test/migration 變更。不得把 capture-only 工作與 taxonomy／knowledge-map 工作混成同一 commit；先讀 diff、測試與當前 source 再行動。

歷史 Docker 證據（不代表新 taxonomy 已驗）：

```text
capture-only contract：3/3 passed
Capture Processing regression：11/11 passed
總計：14/14 passed
```

## 5. 回報與驗收紀律

每次只回報：結論、動作、實際證據、下一個 Owner 決定。

每個 milestone 必須記：原始通過條件、產物絕對路徑、命令／查詢、實際輸出、證據層級、未驗邊界、下一個 gap。

static、Docker、Browser 與 live readback 不可互相替代。未經授權不可 push、merge、刪檔、寫 live DB 或寫 Vault。
