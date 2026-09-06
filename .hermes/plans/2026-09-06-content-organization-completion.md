# 內容整理收尾完整規劃

狀態：第 0、1、2 階段完成；第 3 階段的已審閱候選已分 4 個小批次套用並驗收（47 筆）。其餘 42 篇因低信心、內容歧義或未命中既有分類，刻意保留 inbox；不以清空 inbox 作為成功標準。逐階段驗收；資料搬移仍以逐筆 manifest 為準。
本次已完成第 0 階段唯讀盤點、第 1 階段 UI 收斂、第 2 階段分類提案及第 3 階段四個小批次套用；未修改 Vault 或排程。

## 一、目標與完成定義

1. 自建 Collection 全部保留，包括空資料夾、名稱、ID、原有貼文與手動排序。
2. Agent 造成的零散容器退出日常清單，但保留可查閱的歷史。
3. Collection 是內容分類；Topic 是研究工作區，以已確認的六個 repo × 受控領域組成。
4. Vault 來源筆記依內容分類，不依平台；一篇來源只有一份正式筆記。
5. 舊筆記整理後仍可開啟，內部連結、手寫內容與附件不丟失；工作流重試不產生第二份。
6. 新資料進來不再自動建立 Collection、Topic、Project 或單篇專案資料夾。
7. 未能確定分類的資料可留 inbox；不以 inbox 清空作為成功標準。
8. 畫面、資料庫、Mac 實際執行版本與 Vault 都驗收後，才宣告全部完成。

## 二、已確認基準與未知事項

以下是 2026-09-06 最近一次唯讀查詢結果，執行各階段前須重新盤點，不能把數量寫死為永久條件。

| 項目 | 基準 | 意義 |
| --- | --- | --- |
| 貼文 | 378 | 內容未刪除 |
| Collection | 55 | 22 個保留範圍、33 個 Hermes 容器 |
| Hermes 容器主要貼文 | 0 | 不代表其他關聯均為零 |
| 未分類貼文 | 89 | 其中 1 篇來自法律科技 |
| Project | 6 active | 使用既有已核准清單 |
| Topic | 11 active user、60 archived agent_auto | 資料庫封存已完成 |
| Topic 來源關聯 | 57 已接受至新 Topic、3 留在封存 Topic | 不是 57 篇已做完整內容品質審核 |
| 搜尋投影 Collection 不一致 | 0 | 此欄位最近檢查一致 |
| Git | main 已推至 bed1f51 | Mac 是否取得並使用此版未確認 |

Mac 實際 checkout、PM2 cwd、Hermes 執行 checkout、Vault 實體路徑／symlink、檔案數量、同步工具、手寫內容及路徑碰撞均尚未現場確認。
22 個保留 Collection 的判定目前依歷史盤點；下一步固化 ID 清單，來源不明者一律保護，不能只憑名稱或空白狀態認定為 agent 建立。

## 三、目標分類結構

Collection 直接使用現有 Owner 分類，不另建與其競爭的主題分類樹。22 個分類不必全部建立空的 Vault 目錄，有實際筆記才建立。

| Repo | 既有正式 Topic |
| --- | --- |
| media_platform_notion_antigravity | Agent 工作流、資料擷取／爬蟲、知識／RAG、產品成長、基礎設施／安全 |
| my_full-stack-path-inspector | 架構分析／程式碼智慧 |
| my-chrome-extension-ordering | 瀏覽器自動化 |
| my_hater_react_native | 行動 App 開發 |
| v0-stock-portfolio-dashboard | 市場資料 |
| My-sticker-book | 視覺／貼紙內容、iOS／SwiftUI |

六個 repo 是這次已確認的基底，不因 30 天未更新而自動封存，也不因發現新 repo 而新增 Project。GitHub target 大小寫須先檢查既有正規化與重複判斷；不可再插入大小寫不同的同一 repo。

Vault 目標：

```text
wiki/
  collections/<既有 Collection 名稱>/<日期>-<標題>--<post-id 短碼>.md
  inbox/<日期>-<標題>--<post-id 短碼>.md
```

目前 writer 使用 8 碼 ID；規劃不擅自更換所有命名。盤點需檢查短碼、名稱清洗、大小寫與 Unicode 正規化碰撞；發現衝突即列入例外，不覆寫。
跨主題以 Topic 關聯或連結處理，不複製來源筆記。復刻方案保留在來源筆記中，正式 Project 仍需明確選擇。

## 四、逐階段工作

### 0. 固定保護清單與關聯基準

- 輸出帶時間與 project ref 的唯讀盤點：保留 Collection ID、legacy Collection ID、貼文歸屬、Topic／來源關聯、Project、搜尋投影。
- 查清 legacy Collection 的多重收藏 mapping、Topic scope、外鍵與工作流引用；查清 57 個已遷移 Topic 關聯的既有研究／POC scope 是否一致。
- 不把舊 scope 整批複製到合併後 Collection，以免擴大可操作 repo。
- 保留變更前可還原欄位，不匯出密鑰或不必要的內容。可復用先前 baseline，但必須核對時間與完整度。
- 交付：保護清單、依賴清單、待解決差異。查不清的列為保護對象。
- 驗收：正確 project、同一 owner；分類／Topic／搜尋關聯無跨 owner；未知依賴有明確列出。
- 本階段只有盤點文件，沒有正式資料變更。

### 1. 畫面收斂與操作相容

- Topic 預設顯示 active 主題，依六個 Project 分組；封存主題另有可見入口，不與進行中混排。
- 新增／接受來源時只可選 active user Topic；封存 Topic 可查歷史，不能意外成為研究或 POC 的有效來源。
- Collection 預設保留全部 Owner 分類，包括空白分類。只有第 0 階段確認無有效依賴的 legacy 空容器移出主要清單；歷史入口仍可查閱。
- 優先局部調整展示與選擇器，保持 API 原有回傳契約，不用全域過濾造成其他消費端資料消失；完整狀態仍須可取得。
- 修正阻擋 Topic 載入的現有問題：loadTopics 將 authenticatedFetch 的 Promise 直接傳給 responseData，而 responseData 預期 Response；在本階段補正並驗證登入後真正可載入。
- 檢查貼文列表、搜尋篩選、拖拉分類、空 Owner Collection、新建分類與封存入口；不可只驗證靜態截圖。
- 驗收：當下 11 個 active Topic 可見、60 個封存可另查；Owner 分類不減；隱藏規則不影響既有收藏與 scope。
- 回復：還原這一階段程式 commit 即可；不刪資料、不新增 schema。

### 2. 剩餘內容與既有 Topic 歸屬覆核（先提案）

- 89 篇 inbox 依原文／摘要提出既有 Collection 的候選，附證據、信心與不確定原因；不按來源平台分類。
- 3 個無明確 repo 的來源先保留封存，不硬塞進六個 repo。
- 抽查 57 個已移轉關聯是否真的與目標 repo 有關；以舊 Topic 標題完成對照不等於已核對文章適用性。若發現誤配，產生修正清單，不直接改回。
- 沒有適合的分類就留 inbox；分類與是否需要 Project Topic 是兩個獨立決定。
- 交付：逐筆「原值 → 建議值、理由、待確認」清單，以及每個分類的預計數量。
- 驗收：沒有新建容器、沒有挪動自建分類內既有貼文；每筆提案可追溯。

### 3. 套用已核准的分類清單

- 只套用第 2 階段 Owner 已確認的列，未核准列保持不變。
- 同時核對 user_id、原 collection_id／topic_id 與更新版本；期間有人手動改過就跳過並報告，不覆蓋新決定。
- 更新必要搜尋投影；Topic scope 若需改動，列出具體 repo 權限差異，獨立確認。
- 小批次交易，提交前驗證，保存該批原值與結果；不刪 Collection、Topic、貼文或來源關聯。
- 驗收：核准列全部正確或有明確跳過理由；原有 Owner 分類紀錄與非目標資料不變。
- 回復：依批次原值回復，先確定目標未被後續人工修改；不能整庫倒回舊快照。

### 4. Mac 上線與未來寫入行為確認

- 核對 Mac 真實 checkout、Git commit、PM2 兩程序的 script/cwd、Node 版本與 server/.env 載入位置；只核對配置鍵與路徑，不輸出秘密。
- Hermes Cron／CLI 使用的 checkout 另查：PM2 重啟不代表 Hermes 已更新。
- 確認實際 Vault 根目錄及 symlink，區分工具 checkout 與筆記 Vault。
- 核對 ecosystem.config、環境與操作文件；目前檔案存在檢查不能證明「不是舊 checkout」，必須另外比對版本。
- 先用隔離測試 Vault 驗證已分類、inbox、重試沿用路徑及手寫區保留。使用 Node，不用 Docker，不另建常駐服務。
- Mac 由 Owner 執行部署；需要更新排程或暫停 writer 時列清楚具體目標與時間，不自動修改整組排程。
- 驗收：PM2、Hermes 均使用已核准版本；新筆記依內容歸檔；重試不新增第二份；不自動新建容器。
- 回復：保留前一個相容 commit；不可退回會自動建容器的舊版。不回滾已完成資料整理。

### 5. 既有 Vault 唯讀盤點與搬移提案

- 第 3 階段分類穩定後，在 Mac 盤點實際筆記；沒有 Vault 檔案的 DB 貼文單列，不推定檔案已存在，也不擅自補生。
- 以完整 post ID、metadata、既有 workflow path 與來源 URL 核對身分；只靠相似檔名不足以搬移。
- 範圍包含 source note、歷史 replication 資料夾、草稿、附件引用與筆記連結。真實手動 Project、人工內容與未識別筆記保留。
- 區分完全重複、同來源不同人工內容、孤立筆記、缺失檔案、路徑衝突、已正確歸檔。
- 每筆輸出：post/workflow ID、舊路徑、新路徑、檔案 hash、相關連結、DB 路徑引用、擬採動作與回復方式。
- 覆核 context.vault.relative_path、context.vault_sync.relative_path、action outcome 等實際使用中的路徑；歷史事件保留，不整包重寫 workflow JSON。
- 查 Obsidian／同步工具是否會同時改檔，以及進行搬移時可取得的 writer 暫停／鎖定方式。
- 驗收：每個擬搬檔案都有唯一身分及無衝突目標；例外另列；產出可審閱的前後資料夾樹與數量。
- 本階段不搬檔、不刪資料夾、不改 DB。

### 6. 小批次搬移與回復演練

- 只執行第 5 階段核准的 manifest。先選 5–10 篇涵蓋連結、手寫內容與草稿的樣本，再逐批推進。
- 使用者確認的短暫 writer 維護窗口內進行；盤點後 hash 或 DB 路徑已變動則停止該筆。
- 備份實際會改動的檔案與路徑欄位，位置在 Mac 外接碟且在 Vault 掃描範圍之外，避免備份又被當成來源。
- 檔案與 DB 無法共用一個交易：以逐筆紀錄追蹤複製驗證、引用更新、DB 路徑更新、舊檔移出 Vault 的完成狀態。中斷可續跑，不能假稱全部原子化。
- 保留正文與手寫區；只修正已核准的 metadata／路徑引用。不自動融合不同手寫內容的重複筆記。
- 舊檔在新位置、連結與 DB 引用驗收前不移除；驗收後移入可回復的 Vault 外備份區，確保 Vault 內只剩一份正式來源。
- 空資料夾須確認實際為空、沒有隱藏附件或人工專案再處理；33 個 DB 容器仍保留，不做永久刪除。
- 驗收：Obsidian 可開啟、內部連結與附件正常、手寫 hash／差異符合預期、重跑 writer 不產生舊路徑副本、已核准列可回復。
- 回復：依 journal 逆序恢復路徑／引用；如有新人工修改則保留並交人工處理，不以舊備份強蓋。

### 7. 最終驗收與交接

- 對照第 0 階段的保護 ID，確認 Owner Collection 原始資料未遭刪改，所有核准新增歸類可追溯。
- 分別提供 DB 整理、UI 展示、Mac 部署、Vault 實體搬移的完成報告；列出未決 inbox／例外，而不是一律標成完成。
- 核對六 repo／11 Topic 的實際有效來源與例外，搜尋投影及工作流引用一致。
- 驗證登入、收藏、搜尋、拖拉、Capture、preprocess、Vault sync；研究／POC 的既有人工 gate 維持。
- 依階段風險執行必要 Node 測試與 build；取得明確 exit code，不能只看到 transforming 就宣稱 build 通過。
- 更新既有治理與 PM2 文件，移除會引導回舊 domain/project 資料夾的過時操作說明。
- 交付：前後數量、例外清單、實際部署 commit、備份位置與回復程序。

## 五、執行與衝突邊界

- 本次只規劃。Owner 確認後先開工第 0 階段，完成後再進入下一項。
- 每階段動工前檢查工作樹與其他 session 變更，使用隔離分支，不自動提交別人的修改。
- 資料寫入前重查 schema、constraint、trigger、tenant 與目前值；不能只看過去計畫的欄位。
- 不新增付費資源、Supabase branch、套件或長期 worker；不用 Docker。
- 不停用 RLS、不刪貼文、不刪 Owner Collection、不自動開新 Project。
- 未核准的分類列、Vault manifest、永久刪除、schema 擴充或 scope 權限變更不包含在概括開工內。
- UI 變更可獨立回復；DB 與 Vault 操作各有批次紀錄。不能以「RLS 可關」或整庫 rollback 作為回復方案。
- 一般詞彙統一為「收件匣／內容分類／專案主題／封存」，避免把四者都稱為資料夾。

## 六、已知限制

- 無法由 Windows 檢查 Mac 真實 Vault；第 4–6 階段需要 Mac 現場執行結果。
- 既有遷移改寫了 match 的 topic_id；保留 legacy Topic 本身不是完整回滾證據，需要查回先前 baseline／對照清單，不宣稱已有完整歷史備份。
- 現有 Collection 描述不是不可偽造的 provenance；保護清單與依賴驗算是必要前置。
- 無法事先保證所有既有流程零影響；以限定修改範圍、針對性驗收及可回復批次降低影響。
