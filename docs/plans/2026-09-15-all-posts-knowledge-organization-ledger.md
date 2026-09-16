# 全量貼文知識主題整理 Acceptance Ledger

Original proposal: `2026-09-15-all-posts-knowledge-organization.md`（同目錄）
Last evidence review: 2026-09-16（K0/K1 live-safe 唯讀盤點與 K1 Owner decision record；非寫回/非 runtime 路由驗收）
Current focus: K1.1 closeout evidence and delivery review — K1.1-C1～C3 已具當次 Docker runtime 與已授權 live RPC readback 證據；K1.1-C4 仍受全域 delete 禁令阻擋。下一步為 evidence/ledger 收束、雙階段 review、精準 stage 與本機 agent-dev commit；不 push、不合併 main。

## 規則

Static 不代表 runtime，Docker 不代表 live，來源存在不代表語意正確，Browser/build 不互相替代。每列 complete 需原通過條件、產物與當次直接證據齊全。Owner review 記實際決策與日期；前案 waiver 不沿用。
本次 K0 私有產物位於 `/Volumes/DevSSD/hermes/knowledge-organization/k0-20260916T002220+0800/`；後續 run 仍使用 `/Volumes/DevSSD/hermes/knowledge-organization/<run-id>/`。本 ledger 是唯一逐項狀態來源，計畫保留原始目標。

## Acceptance matrix

| ID | 原始通過條件 | 必要產物/路徑 | 必要證據層級 | 當次證據 | 證據限制 | 狀態 | 下一步 |
|---|---|---|---|---|---|---|---|
| K0-C1 | owner/cutoff/唯一 ID 與 live 範圍精確一致 | `/Volumes/DevSSD/hermes/knowledge-organization/k0-20260916T002220+0800/manifest.json` | Live-safe 唯讀 | 2026-09-16：`node …/k0-live-audit.mjs` 以 Supabase `select(*)` 讀取 427 posts；唯一 owner `50984520-69ad-4e64-b9c1-503f5c1b0e63`、NULL owner 0、cutoff `2026-09-15T16:25:36.466Z`。manifest 固定 427 records/427 IDs/427 unique IDs，record↔ID 順序一致；ID-list SHA-256 `300d7b83…0850ff8a` 回算一致；內容 fingerprint NULL 0。另以 `information_schema.columns` 查核六張相關表目前 schema。 | 此為 cutoff 當下的唯讀快照；fingerprint 偵測內容漂移，不證明擷取完整或語意正確；未寫 DB/Vault。 | complete | Owner 若授權 K1，重讀本 manifest 後建立完整白名單與同名 Topic 對照。 |
| K0-C2 | 全量品質、schema、人工關聯基線可查 | `/Volumes/DevSSD/hermes/knowledge-organization/k0-20260916T002220+0800/inventory.md`、`manifest.json`、`baseline.json` | Live-safe 唯讀 | 2026-09-16：同一唯讀 audit 實際輸出：content 427、短於 40 正規化字元 28（逐 ID 列於 inventory）、無內容 0；assigned 333、unassigned/Inbox-candidate 94、dangling/cross-owner collection 0。collections 53，其中精確 auto 描述 33、post 引用 0；topics 71（agent_auto/archived 60，user/active 11）；source matches 60（accepted 59/suggested 1）；analyses 424、非空 summary 332；workflows 427，stage/status 分布已列。六表的 live `information_schema.columns` 回傳 columns 並驗 collection_id、topic/source match、workflow 與 analysis 目前契約；所有關聯 orphan/cross-owner 集合為空。 | 內容品質只涵蓋存在/長度/結構與關聯完整性，不是逐文語意或媒體實看；資料夾仍只是候選，尚未獲 Owner 白名單核准；不是 Docker 路由安全或 live 寫回證據。 | complete | K1-C1/K1-C2 提交完整 folder ID/名稱候選、同名 Topic 對照與 Inbox 規則，等 Owner 定案。 |
| K1-C1 | 收藏資料夾 inventory 全量分離人工核准候選與 auto 排除項，不以 DB 存在推定核准 | `/Volumes/DevSSD/hermes/knowledge-organization/k0-20260916T002220+0800/folder-whitelist.json`、`topic-proposal.md`、`owner-decision-k1.md` | Live-safe 唯讀 + Owner decision record | 2026-09-16：Owner 明確核准全部 20 個候選；私有 record 回讀 `approved_count:20`、unique 20、與 auto overlap 0，20 筆皆標記 `approved_as_formal_taxonomy`。 | 核准 taxonomy 不等於已套用路由；不授權貼文/資料夾 DB 寫回。 | complete | K1.1 以此 20 IDs 製作受控 runtime allowlist 設計與 Docker safety test plan。 |
| K1-C2 | 完整 folder→同名 Topic 對照、Inbox 規則及白名單由 Owner 100% 定案 | `/Volumes/DevSSD/hermes/knowledge-organization/k0-20260916T002220+0800/topic-mapping.json`、`taxonomy-approval.md`、`topic-proposal.md`、`owner-decision-k1.md` | Owner review + schema 核對 | Owner 已明確定案：DB Topic 為最終知識成果落點；folder→Topic 維持 0 對照、無非精確例外。回讀 `topic_mapping:maintain_zero_exact_name_mapping`；20/20 對照列仍是 `no_exact_active_user_topic_keep_unmapped`，新 Topic 提案 0；Inbox 規則保留。 | DB Topic 是未來結果目的地，非本階段 DB 寫入授權；folder 不得據此自動 link Topic。 | complete | K1.1 先提精準受控路由/Topic 隔離 Docker plan，獲 Owner 批准後才實作。 |
| K1.1-C1 | 全歸檔路徑僅核准同 owner folder，禁止 auto/無效 ID 及自行建立 | `server/config/ownerCollectionTaxonomy.js`、`autonomousKnowledgeService.js`、`preprocess-workflow.js`、routing-safety-evidence.md | Docker runtime | 2026-09-16：`node:20-alpine --network none`、repo 唯讀掛載執行 37/37 passed；Q.3 以 Owner 授權套用至 live RPC，readback 確認 allowlist 與 0.85 guard。 | Docker 未跑真實 workflow/UI；live readback 證明函式定義，不證明端到端處理。 | verified | evidence review 後精準 stage/commit。 |
| K1.1-C2 | 保留已歸檔含並行人工操作；模糊留 null；冪等/失敗續跑 | `autonomousKnowledgeService.js`、folder_routing_safety.test.js、routing-safety-evidence.md | Docker runtime | 2026-09-16：Docker 37/37 passed；focused folder suites 14/14 passed。Q.3 readback 確認 tenant-scoped `id + user_id + collection_id is null` conditional assignment。 | 未以 live workflow 製造寫入驗收；不宣稱 live end-to-end。 | verified | evidence review 後精準 stage/commit。 |
| K1.1-C3 | folder→Topic 對照受控且不覆蓋 accepted/rejected、不觸發無關行為 | `autonomousKnowledgeService.js`、topic_match_governance_hardening.test.js、Stage Q.1/Q.2 migrations、routing-safety-evidence.md | Docker runtime | 2026-09-16：Docker 37/37 passed，含 accepted/rejected 保留、folder/Topic 隔離與 source-owner guard 合約；Q.1/Q.2 已獲 Owner 授權套用。 | 靜態/隔離證據不代表 UI 或真實 workflow。 | verified | evidence review 後精準 stage/commit。 |
| K1.1-C4 | 自動分類精準移除且有備份/引用檢查/回讀；若不能執行保留 blocker | auto-folder-cleanup-status.md、核准清單、SSD 備份、回讀 | 授權 Live-safe + 備份驗證 | 上次 33 個、posts/map/scopes 皆 0；未刪 | 隱藏不等於刪除 | blocked | 全域 delete 禁令未解；不可繞過或擅自封存 |
| K2-C1 | 代表樣本逐結論可追溯、零捏造 | pilot-manifest.json、pilot-topics/、pilot-review.md | 來源逐結論核對 | 尚無 | 試整理不代表全量 | absent | 整理核准樣本 |
| K2-C2 | Owner 確認粒度、落點、全量預算上限 | pilot-review.md | Owner review | 尚無 | 未報數值不可當預算獲准 | absent | 記錄實際使用量與決策 |
| K3-C1 | manifest 全量有處置，blocked 不冒充 organized | coverage.json、exceptions.md、source-cards.jsonl | 全量對帳 + 來源核對 | 尚無 | 處置率不是成功率 | absent | 分批整理/逐筆對帳 |
| K3-C2 | 所有主題有實質綜整、引用、關聯與限制 | topics/、knowledge-map.md | 來源核對 | 尚無 | 標題清單不是知識綜整 | absent | 逐主題綜整與稽核 |
| K3-C3 | 每則有全文證據卡或 blocker；未分類提案僅限白名單，模糊留 Inbox，既有歸屬保留 | source-cards.jsonl、classification-manifest.json、inbox-review.md | 全量原文核對 + ID 對帳 | 無 | 分類提案不等於已寫回 | absent | 明確/模糊分開稽核 |
| K4-C1 | 精準差異及持久化入口確認，rebuild 不覆蓋語意稿 | writeback-plan.md、write-manifest.json | Static + Docker runtime | 尚無 | 欄位存在不證明可安全寫回 | absent | 驗入口，不支援則另提開發計畫 |
| K4-C2 | dry-run 零寫入/冪等/續跑/租戶/conflict/回復均實測 | safety-evidence.md | Docker runtime | 尚無 | 隔離測試不代表 live 成功 | absent | 逐案例記命令/實際輸出 |
| K4-C3 | 明確核准目的地/ID/操作筆數/備份回復 | owner-approval.md | Owner approval | 尚無 | 計畫授權不等於寫入授權 | absent | 提交 manifest 供批准 |
| K5-C1 | 備份可驗、小批寫回及來源鏈回讀通過 | 備份、apply-results.jsonl、readback-report.md | Live-safe 授權寫回 + 目的地實看 | 尚無 | 工具回報成功不等於回讀成功 | absent | 備份與核准小批 |
| K5-C2 | 全量核准差異回讀一致，未核准不變、conflict 不覆蓋 | apply-results.jsonl、readback-report.md、conflicts.jsonl | Live-safe 對帳 | 尚無 | 小批不能替全量 | absent | 批次套用與回讀 |
| K6-C1 | 分母/結果/例外一致，所有引用存在且 owner 正確 | final-report.md | 全量對帳 + Live-safe | 尚無 | blocked 不算成功 | absent | 逐 ID 核對 |
| K6-C2 | 每主題抽查、低信心全查，5 條查找路徑實測 | retrieval-acceptance.md | 原文核對 + Browser/目的地互動 | 尚無 | build 不代替查找體驗 | absent | 記實際操作與結果 |

## K0 execution evidence — 2026-09-16

- **Private run root:** `/Volumes/DevSSD/hermes/knowledge-organization/k0-20260916T002220+0800/`（未放入 Git）。
- **Commands / query:**
  1. `node scripts/maintenance/audit-auto-containers.js --output /Volumes/DevSSD/hermes/knowledge-organization/k0-20260916T002220+0800` → `{"ok":true,"counts":{"posts":427,"collections":53,"topics":71}}`，並寫入 `baseline.json`。
  2. `node /Volumes/DevSSD/hermes/knowledge-organization/k0-20260916T002220+0800/k0-live-audit.mjs` → live-only `select(*)` audit：posts 427、selected owner `50984520-69ad-4e64-b9c1-503f5c1b0e63`、unassigned 94、content exceptions 28、collections 53、auto collections 33/reference posts 0、topics 71、matches 60、analyses 424、workflows 427；寫入 `manifest.json`、`inventory.md`。
  3. `node /Volumes/DevSSD/hermes/knowledge-organization/k0-20260916T002220+0800/verify-manifest.mjs && shasum -a 256 /Volumes/DevSSD/hermes/knowledge-organization/k0-20260916T002220+0800/manifest.json /Volumes/DevSSD/hermes/knowledge-organization/k0-20260916T002220+0800/inventory.md` → `records:427`、`ids:427`、`unique_ids:427`、`ids_match_records:true`、`record_ids_match_ids:true`、`hash_matches:true`、`null_fingerprints:0`；artifact SHA-256：manifest `1197ec3175979ebb5a4d9dea7de0eddce528db457200f6b4e8326da0d4c853b4`，inventory `08d0aaaf556039da10053e8ddbcb12071497e6e5c6c2e4873321bfdda017c5fb`。
  4. Read-only SQL: `select table_name, column_name, data_type, is_nullable from information_schema.columns where table_schema = 'public' and table_name in ('collection_posts','collection_collections','collection_post_analysis','collection_post_workflows','collection_topics','collection_topic_source_matches') order by table_name, ordinal_position;` → six target tables returned, including `collection_posts.collection_id` (uuid nullable), `collection_topics` knowledge fields, `collection_topic_source_matches` decision/status fields, and workflow/analysis relations.
- **Evidence tier boundary:** all four are live-safe read-only evidence. They do not prove semantic synthesis, folder whitelist approval, Docker routing safety, Browser behavior, or any DB/Vault writeback.

## K1 execution evidence — 2026-09-16

- **Command:** `node /Volumes/DevSSD/hermes/knowledge-organization/k0-20260916T002220+0800/k1-taxonomy-audit.mjs`
- **Actual output:** `current_owner_posts:427` / `manifest_posts:427` / added 0 / missing 0 / assignment drift 0 / total owner folders 53 / candidates pending 20 / exact auto exclusions 33 / active user Topics 11 / exact active-user same-name mappings 0 / no-exact mappings 20.
- **Artifacts:** `folder-whitelist.json`（`approved_folder_ids: []`）、`topic-mapping.json`、`topic-proposal.md`、`taxonomy-approval.md`、`k1-drift-check.json`；均在私有 run root，未放入 Git。
- **Artifact integrity check:** candidate ID list / excluded ID list / mapping rows all consistent, candidate-auto overlap 0. SHA-256: whitelist `26e17dab06b664389cbcb94b2bb1e49d02dfb67ecbf450d8b56c15dfed29ff88`; mapping `93511280f6732010122dd5054ea5bd79e3787f5b0897dc1a35e6f6a04c3390ce`; proposal `5cf17fb40370cfbccbaddccd41f05b37304f6fbec65cfd990c9d3b24f704cdc3`; approval `a2bd40d8efabc55005fa8c69b765005b7e884e1e1fcfffa83b7b8042bff188ca`; drift `1d4e1c20079bf2b025c4a0562f408f1cfe3b61a356c89160a39cd08b31a324b7`.
- **Decision boundary:** `owner_candidate_pending` is deliberately not a whitelist. This execution makes no classification, Topic relation, Vault/DB write, folder creation/rename/merge/split/archive/delete, preprocess run, Cron/PM2 action, or implementation claim.

## Milestone summary

| Milestone | Criteria | 狀態 | 原因 |
|---|---|---|---|
| K0 | K0-C1、K0-C2 | complete | 2026-09-16 已以當次 live-safe 唯讀固定 manifest、品質與關聯基線；不代表 K1 白名單、Docker 路由安全或任何 live 寫回已完成。 |
| K1 | K1-C1、K1-C2 | partial | K1-C1 complete：53 folders 已全量拆為 20 pending candidates + 33 auto exclusions。K1-C2 等 Owner 逐 ID 白名單、最終知識落點與 Topic 對照例外定案；目前精確同名 Topic 對照為 0。 |
| K1.1 | K1.1-C1–C4 | blocked | 防呆未實作；清理受 delete 禁令阻擋 |
| K2 | K2-C1、K2-C2 | absent | 尚未開工 |
| K3 | K3-C1、K3-C2、K3-C3 | absent | 尚未開工 |
| K4 | K4-C1、K4-C2、K4-C3 | absent | 尚未開工 |
| K5 | K5-C1、K5-C2 | absent | 尚未開工 |
| K6 | K6-C1、K6-C2 | absent | 尚未開工 |

## 規劃基線（非 criterion completion）

歷史基線（2026-09-15）：427 posts、archived 0、content 空白 0、332 posts 有非空摘要；Topics active 11/archived 60；6 Projects；matches accepted 59/suggested 1。K0 已於 2026-09-16 重查並固定新 manifest；當次 live 結果以 K0 execution evidence 與私有 artifacts 為準。未讀全量語意內容，未改 live 資料。

## Owner 修訂紀錄（2026-09-16）

本次 Owner 要求更新規劃並提供交接 prompt。正式分類改採收藏系統中已核准資料夾，所有自動建立分類不要；未分類貼文一起處理，模糊留 Inbox。舊 K1-C1 的全量證據卡要求轉至 K3-C3，K2 先完成樣本證據卡；不是刪除要求。K1 完整白名單定案與 K1.1 防呆為 K2/K3 前置條件。
尚未刪除 33 個自動資料夾，未實作 folder→同名 Topic，未搬動未分類貼文。K0 當次 live audit 確認 33 個 auto 資料夾、現有 post 引用 0，且 unassigned/Inbox-candidate posts 94；前端已隱藏 auto，不能宣稱 DB 清除。正式實作仍需開工，live 差異另核准。

## Lessons / guardrails

- 主題來源標題集合不是知識綜整，每個實質結論需原文支持。
- 全量處置率與成功率分開；blocked 留在分母。
- 不重設 workflow 重跑全量，不以 preprocess 意外觸發其他動作。
- 未驗入口、備份及 Owner 授權不得寫 DB/Vault。

## Session handoff

先讀原計畫、Current focus、unfinished rows、git status，再讀私有 manifest/checkpoint。每列補日期、完整命令/查詢、實際輸出、證據層級與限制後才改 complete。安全 blocker 停止寫入；來源不足可繼續其他獨立項。Owner 豁免使用 owner-accepted-complete，保留未驗邊界。
