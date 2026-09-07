# 全系統盤點計畫（2026-09-08）

規劃：Astra。執行：Terra。狀態：計畫已建立，以下清單不是盤點結果。

## 目的與邊界

回答三件事：有效修改是否安全保存且正確整合；文件與執行版本是否一致；反覆修改是否破壞整條工作流程。產出有證據的問題清單與 worktree 處置建議。本輪允許讀取與建立稽核報告；不修程式、不改 tasks.md 狀態、不刪暫存、不 commit／merge／push／部署、不修改正式 DB 或 Vault。

不使用 Docker、付費模型 API、真實爬取或遠端工作流觸發。不得要求使用者提供遠端 Vault 的本機路徑。測試必須先檢查副作用；僅執行使用 mock、fixture 或隔離暫存目錄且不讀取正式憑證的項目。遇到可能連線、寫 DB／Vault、啟動排程或付費呼叫的測試，跳過並記錄具體原因。

目前協調者提供的起始線索為 main `223fe39`、相對本機 origin tracking ref 領先 16 commits、含根目錄共 11 個 worktrees，以及 `b5bd090` 的 workflow-badges 合併。這些是待 Terra 重新核實的快照，不表示遠端即時狀態；不得沿用對話中 `af7013d` 或領先 13 commits 當最新事實。

## 證據與判定規則

每個 ID 都需填寫：狀態、證據（檔案與行號／commit／命令摘要／查詢時間）、實際結果、影響、下一步。狀態僅使用「已確認正常」「確定有問題」「尚未確認」「不適用」。沒有證據不算通過；歷史敘述、檔案存在、migration 名稱、測試數量皆不足以單独证明已執行或正確。敏感檔僅記路徑、用途與追蹤狀態，輸出遮蔽憑證與私人原文。

確定有問題需區分 P0（正在造成重大資料／安全影響）、P1（主要流程失效或可重複資料錯誤）、P2（局部功能／文件契約偏差）、P3（維護問題）。推測風險標為待確認，不冒充已發生事故。每項未知附最小補證方法，不用未知阻擋其他獨立盤點。

## 逐項執行清單

| ID | 範圍與所需證據 | 通過／問題判定 | 無法確認時 |
|---|---|---|---|
| A01 | 讀取專案入口、模式與適用規則；記錄本輪工具及環境限制 | 操作邊界可追溯；缺模式時不做程式修改 | 標記缺少入口或規則，繼續允許的唯讀項目 |
| A02 | 開始與結束記錄時間、main HEAD、所有 worktree HEAD／branch、status、stash refs | 兩次快照一致，或明確列出期間其他 session 造成的漂移 | 有漂移則重核受影響項，不把不同版本證據混成同一結論 |
| G01 | `git worktree list --porcelain`、本機分支、worktree 路徑是否存在，含 detached／locked／prunable | 每個 worktree 都有對應責任、狀態與處置列；找出未列管 checkout | 不掃描專案以外整顆硬碟；不可存取項列未知 |
| G02 | 每個 worktree 的 staged diff、unstaged diff、untracked、ignored 專案產物；stash 清單及必要 diff | 所有獨有內容都找到保存位置；index 不是自動等同已保存；機密不建議入 Git | 大型依賴／cache 只分類統計，不逐檔輸出；不可讀檔保留 |
| G03 | 各分支對 main 的 ancestry、ahead/behind、`git cherry` 或 patch-equivalence、merge/cherry-pick 歷史及最終檔案差異 | 判明真正未合併修改、等效整合、合併後被覆蓋及明確撤回內容 | patch 等效不能涵蓋 merge resolution 時人工核對關鍵 diff；不得僅憑 branch --merged |
| G04 | stash／patch／回補結果／manifest／臨時腳本與 tracked 複本的關係 | 建議保存、候選合併、保留、可清理均有理由和恢復途徑；不實際執行 | 找不到所有者或唯一內容用途即建議保留 |
| G05 | main 與 origin tracking ref、remote URL（遮蔽認證）、可用的唯讀遠端 HEAD；部署紀錄與執行端 revision | 本機已合併、已 push、已部署分開判定；前後端／Hermes／排程分開列版本 | 無遠端證據就僅報 tracking ref；正式版本未知不能推為最新 |
| D01 | tasks.md、Task_Logs、計畫、MEMORY、docs、package scripts 與 commit 證據 | 比對每條完成宣告／待辦，列出過時狀態與相互矛盾；尤其 tasks.md 仍「待執行」 | 不自行勾選或重寫任務；附建議更正與證據 |
| D02 | README、workflow 文件、skill、部署 SQL／腳本／設定樣板 | 現存入口、參數、模型、路徑與操作說明一致；歷史文件清楚標示歷史 | 不要求歷史文件全部改成現況，聚焦仍可誤導執行的內容 |
| F01 | URL/router → API → crawler → parser → unified post → persistence 實際呼叫鏈及錯誤分支 | fallback、部分成功、重複 URL、來源 ID、媒體缺失不誤報完整或重複寫入 | 不能安全 live capture 時以呼叫链與 fixtures 確認，live 行為未知 |
| F02 | AI summary／title／tags／insight 的 provider 路由、設定、fallback、回補入口與排程 | 新舊無標題流程有來源依據；不覆蓋人工標題；空結果／timeout／重試不誤標成功；MiniMax 退役後無活躍依賴 | MiniMax 字串按活躍程式、預設設定、死碼、歷史紀錄分開；不呼叫模型驗證 |
| F03 | Local 與 Remote DB-only preprocess 的共享／分叉邏輯、JSON 欄位與下游使用者 | 只能連結既有 Collection／Topic／Project；建議不自動成 active；重試、空分類、封存／越權 ID 行為一致 | 以具體分支與測試缺口列出風險，不假設兩份实现等價 |
| F04 | Collection 移動／改名／封存、Topic 狀態、Project 明確建立入口、列表/API查詢 | 首頁、sidebar、移動選單對封存一致；使用者分類不被背景處理覆蓋；無單篇自動容器復發 | 未查 live 資料時區分程式風險與實際髒資料 |
| F05 | Research → POC → replication plan 的寫入、讀取、狀態轉換與 UI | goal／MVP／acceptance criteria 與詳細頁/badge 保留；未授權不開正式 Project；成功／失敗／待確認語意一致 | 缺執行環境僅確認契約，不宣稱 POC live 可用 |
| F06 | Vault writer、呼叫者、workflow relative_path、草稿輸出、rollback diff 與 tests | platform 路徑與既有路徑兼容；Collection 改名／移動不改 Vault；不自動索引／搬檔；檔案成功後才記同步成功 | 僅依 DB 相對路徑、code 與 fixtures；實體 Vault 是否重複明確列未知 |
| F07 | 特查 `existingWikiPath` 移除、日期／AI標題改變、重跑及新舊 `wiki/sources`／platform paths | 同一 post 重跑不因重新算路徑而新建第二份筆記；確認 DB 舊路徑是否遭改寫或失聯 | 無實體 Vault 也需用離線案例证明／排除程式會產生不同路徑；實際發生量另列未知 |
| F08 | 搜尋殘留 migration／dry-run／DB-only manifest／move 建議的 scripts、CLI、docs、ignored 產物 | 已撤回方案無仍可被誤執行入口；保留歷史 manifest 不等於已執行 | 列出精確入口與是否預設安全，禁止 apply manifest 或移除檔案 |
| F09 | 全流程狀態圖與重試／併發／失敗補償：pending、processing、complete、failed 及實際欄位 | 不跳過必要步驟、不在部分失敗標完成；retry 有界、claim/lock/冪等保護、錯誤可見；重啟後可恢復 | 沒有測試的分支列出缺口；外部系統行為不猜測 |
| S01 | 先讀 schema 與 migrations，再逐一比對 CRUD、API DTO、前端型別／JSON、約束／defaults | 欄位、enum、nullable、FK、唯一鍵與讀寫契約一致；新增欄位不靠不存在 migration | schema 檔和 live 不同時雙方版本分開報告 |
| S02 | collection_posts／collection_collections 及受影響表的 RLS／grants／owner checks、service-role 使用 | 合法 owner 路徑完整、跨 owner 拒絕；前端不依賴 privileged client；政策關閉與啟用情況有證據 | 未連 live 只確認 SQL 意圖，不能報 RLS 已啟用；不以正式 INSERT/UPDATE 測試 |
| S03 | Supabase project ref、repo 設定與連線目標交叉驗證後，必要唯讀查 schema/migration/status counts | 身份一致後才查資料；讀取最少聚合／ID／路徑資訊；不暴露正文或金鑰 | 無法確認 project 身份立即停用 DB 分支，繼續本機盤點 |
| U01 | 卡片框線與 hover、原文連結詳情、modal backdrop、收藏卡片集中、搜尋名稱／確認狀態、處理狀態、POC入口、復刻呈現 | UI 行為與 API 狀態相符；新增 badges merge 未回引撤回 Vault 規則；loading/error/空資料清楚 | 無安全 UI fixture 時靜態結論與視覺未確認分開 |
| T01 | package scripts、tests/setup、import side effects、env 載入、網路／DB／fs／child-process mock | 先列安全可跑清單再執行；暫存輸出只在隔離專案測試區，不讀正式 .env | 不能證明隔離就跳過該命令；不使用試跑來判斷有無副作用 |
| T02 | 執行安全相關 Node tests／lint／build，記錄命令、版本、exit code、失敗摘要 | 看真實 assertions 與行為覆蓋；區分既有警告、新失敗、純字串測試假信心 | 依賴不存在先報阻礙，不自行安裝大型套件或改 lockfile |
| T03 | 測試後 git status、ignored 產物與開始快照對比 | 無正式資料變更；列出本輪報告與測試產物，沒有意外覆寫使用者檔案 | 發現意外副作用立即停相關步驟並報告，禁止自行清理掩蓋 |

## 執行順序與交付

1. Terra 執行 A01–A02，完成開始快照；G01–G05 與 D01–D02 建立版本／文件基準。
2. 以 main 的已記錄 HEAD 追查 F01–F09、S01–S03、U01；其他分支只查獨有變更及交互影響。發現正式風險先回報協調者，繼續不受影響項。
3. 通過 T01 後才執行 T02；完成 T03 與 A02 結束快照。有漂移重核受影響結論。
4. 建立 `docs/system_audit_report_2026-09-08.md`，包含完整 ID 狀態、證據、P0–P3 問題、未知與補證方法、各流程斷點及必要修復順序。原始摘要只保留足以重現的資訊。
5. 建立 `docs/worktree_disposition_2026-09-08.md`：每個 worktree／branch／stash／獨有產物各一列，欄位為路徑、HEAD、分支、dirty/index/untracked/ignored 摘要、相對 main 關係、patch 等效證據、獨有內容、紀錄位置、建議保存／候選合併／保留／可清理、理由與前置條件。所有動作僅建議，未執行。
6. 協調者彙整結果並追加本輪 Task Log。不要把「盤點完成」等同「系統沒有問題」；不因需後續修復就隱藏本輪已完成範圍。

完成標準：每個清單 ID 都有結果；每個發現的 worktree／stash／獨有產物有處置列；所有確定問題可回溯證據；已合併／已 push／已部署分開；未確認項明確，沒有未授權修復或清理。
