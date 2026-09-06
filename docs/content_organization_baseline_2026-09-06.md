# 內容整理第 0 階段基準

產生時間：2026-09-06 14:49 UTC<br>
正式資料庫：`dcyjictvatixbflfrsfg`<br>
方法：唯讀 SQL 盤點；未讀取貼文正文、未修改資料庫、Vault 或排程。

## 固定保護範圍

以下 22 個 Collection 為 Owner 保留範圍。後續作業只能以這份 ID 清單識別，不能用
名稱、描述或是否空白取代 ID 判斷。

| Collection | ID | 主要貼文 | Topic scope |
| --- | --- | ---: | ---: |
| agent loop | `3e2328d0-c904-4416-9d89-1eda3d56b1cd` | 1 | 0 |
| agent工具 | `cb934189-6dd4-4448-a423-1f3d8b5730ec` | 231 | 0 |
| ai圖片+影片 | `2f26f840-db76-46a8-884a-8c7515aa17ba` | 10 | 1 |
| ai建模 | `a2697b52-a8d3-4f5c-ad1a-064900d589c7` | 0 | 0 |
| ai漫劇 | `41cb8bc2-4c62-4ea8-a1bc-7314549bf2ce` | 0 | 0 |
| codex | `a7bfa5b1-a5fb-4bd3-9a5b-6cc81e044b4f` | 0 | 0 |
| prompt | `dfb65351-5d97-4cd3-b0e6-65061f8b1af0` | 1 | 0 |
| TEST-POC模式 | `379575d6-5bed-4b43-a451-6adaf92c7024` | 3 | 1 |
| TEST-收集模式 | `6b8c5fcc-3012-4676-91ff-47577f1cba69` | 1 | 1 |
| TEST-研究模式 | `e503f608-92cc-477d-80d1-bc0d8e1796d5` | 1 | 1 |
| UI skill | `57ccf24f-4d3e-45bd-99eb-63de93c1e468` | 1 | 0 |
| 其他 | `c6c52278-3827-4a9a-b8cf-137758a35570` | 1 | 0 |
| 副業 | `0dbf7c12-48f1-4d69-995f-4908be7ba4a9` | 5 | 0 |
| 好skill | `aef97ffe-9063-49a6-984c-f71245da76ae` | 2 | 0 |
| 好用套件 | `a9f086bc-5041-4157-9ae3-bfd73ccc9ae6` | 2 | 0 |
| 工程師開發優化 | `76945268-b2e1-4c8e-bece-11a2000af0a6` | 14 | 1 |
| 帳號監控 | `34ab6683-d000-47e3-a8f2-a634d74e1763` | 0 | 0 |
| 投資 | `57d4a857-193c-40d6-9779-bcc3b617bbfe` | 12 | 0 |
| 教學 | `6cbc331a-060a-4b1b-96ef-8ea440315316` | 2 | 0 |
| 泰文 | `68e4be51-6a94-492d-bac2-9a6aa11d5a15` | 0 | 0 |
| 狗狗 | `2bbf3989-268f-40dd-8c5c-31c9d5eb34bc` | 1 | 0 |
| 考試 | `e29f4e0a-91d2-4eff-8606-f79f535558e9` | 1 | 0 |

這些分類共有 289 篇主要貼文。空 Collection 仍為保留範圍，不隨本計畫自動隱藏、合併或刪除。

## 現況摘要

| 項目 | 數量 | 狀態 |
| --- | ---: | --- |
| 貼文 | 378 | 289 篇在 Owner Collection、89 篇 inbox |
| Hermes legacy Collection | 33 | 主要貼文 0、多重收藏 map 0、Topic scope 0 |
| Collection post map | 0 | 沒有主要收藏與多重收藏不一致列 |
| 搜尋投影不一致 | 0 | `collection_post_search_documents.collection_id` 與貼文一致 |
| 工作流 | 378 | 332 筆記錄有 `wiki/` Vault 相對路徑；尚未驗證 Mac 實體檔案 |
| Active Project | 6 | 已確認 repo 基底 |
| Active user Topic | 11 | 正式可用 Topic |
| Archived agent Topic | 60 | 不列為日常研究／POC 的有效 scope |
| Topic 來源關聯 | 57 正式接受、3 封存歷史 | 3 筆不強行歸屬六個 repo |

## Collection 關聯與限制

資料庫目前對 Collection 有三個直接外鍵依賴：

| 依賴 | 刪除 Collection 的行為 | 本次意義 |
| --- | --- | --- |
| `collection_posts` | `collection_id` 設為 NULL | 不能用刪除作為收斂手段，會把貼文送回 inbox |
| `collection_collection_post_map` | cascade | 現有 map 為 0，仍需保留未來相容性 |
| `collection_topic_scopes` | cascade | scope 是研究／POC 邊界，不能因 UI 收斂而遺失 |

現有 6 個 Topic scope 都指向 Owner Collection 或 inbox，沒有指向 legacy Collection：

- `ai圖片+影片`：`poc_proposal`，目標 `github:krownsh/media_platform_notion_antigravity`
- `TEST-POC模式`：`poc_proposal`，目標 `github:krownsh/media_platform_notion_antigravity`
- `TEST-收集模式`：`collect`
- `TEST-研究模式`：`research`
- `工程師開發優化`：`poc_proposal`，目標 `github:krownsh/media_platform_notion_antigravity`
- inbox：`collect`

## Legacy Collection 的歷史引用

33 個 legacy Collection 雖已沒有主要貼文，仍被 183 個 workflow 的
`context.folder_persistence` 保存為當時分類結果：

- 124 筆是 `folder_persistence.collection_id`。
- 59 筆是 `folder_persistence.collection.id` 與對應名稱的完整物件。
- `action_plan` 沒有 legacy Collection 引用。

這些欄位是歷史稽核證據，並非現行貼文歸屬。後續 UI 收斂不得改寫它們；Vault writer
也會從貼文目前的 `collection_id` 決定新路徑。若未來需要移除 legacy Collection，必須
先有獨立的、可覆核的 workflow JSON migration，不能在一般分類或 Vault 搬移中夾帶處理。

## 第 1 階段可安全處理的範圍

1. Topic 頁預設只顯示 11 個 active user Topic，並提供封存歷史入口。
2. Collection 日常畫面預設顯示這 22 個 Owner Collection；legacy Collection 可在「歷史／已收斂」入口檢視。
3. API 的完整資料回傳維持可取得，避免搜尋、工作流或稽核資料因前端展示過濾而遺失。
4. 不改動 Collection、Topic、scope、workflow context、貼文歸屬或 Vault 檔案。

## 尚待後續確認

- Mac 真實 checkout、PM2／Hermes 版本與 Vault 實體檔案。
- 89 篇 inbox 的逐篇分類提案。
- 57 個已接受 Topic match 的內容適配性複核。
- 3 個封存 Topic source match 是否要長期保留或由 Owner 另行指定專案。
- 每一筆既有 Vault note 的完整 ID、手寫內容、附件與連結。

## 第 1 階段 UI 收斂（2026-09-06）

- Topic 頁修正登入後首次載入：`authenticatedFetch` 完成後才交由 `responseData` 解析。
- 日常工作區只顯示 `origin=user` 且 `status=active` 的 Topic，並依既有 Project 分組；其他 Topic 可由「歷史主題」入口查閱，不與進行中混排。
- 收藏夾日常列只顯示 Owner Collection。描述含 `Hermes 自動建立` 的 33 個 legacy Collection 可由「已收斂歷史分類」入口開啟。
- legacy Collection 的資料夾、彈窗與貼文卡均為唯讀：不接受拖放、不能改名或刪除，也沒有從彈窗移除貼文的 drop zone。
- API 回傳與資料庫內容保持不變；這一階段未變更 Collection、Topic、scope、workflow JSON、貼文歸屬或 Vault 檔案。
