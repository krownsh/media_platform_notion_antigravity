# 專案記憶

## 2026-07-29：工作推進方式

- 使用者明確要求：除非需要其登入、外部授權、付費決定或不可逆的資料操作，Agent 必須自行持續處理下一個可驗證的工作，不得反覆把「下一步」丟回使用者。
- 對使用者回報時必須先交付可見成果或明確阻塞點；不要只說流程已通或要求使用者確認。
- 每次自主接續工作前，必須先說清楚「接下來要做的可見交付」與「使用者此刻不需要做什麼」。不得只報技術設定、commit 或背景狀態。
- GitHub App runtime 同步目前暫停；不應阻塞收藏資料夾、主題範圍、未整理貼文安全預設與本機 POC 提案的其他工作。

## 2026-07-29：Supabase NULL 篩選

- Supabase JS 對 UUID 欄位的 NULL 條件不可使用 `.eq('column', null)`，會送出字串 `"null"` 而導致型別錯誤。必須使用 `.is('column', null)`。
- 寫入多個相關資料前先做可檢查的前置條件；若發生半套寫入，先唯讀盤點實際狀態，再只補齊缺少的部分。

## 2026-09-04：主題工作區的實際資料必須先盤點

- 使用者質疑既有主題來源時，必須先以唯讀 Supabase 查詢確認，不得只依早期 MVP 文件或前端 API 推論。
- 本專案實際資料庫有後續 Stage K／M 的自動預處理：Hermes／Codex preprocess 會建立 `origin = agent_auto` 的 active topic，並依分數自動接受部分來源匹配。
- 2026-09-04 盤點結果為 60 個 topic、單一 owner、全部 `agent_auto`；其中 35 個來源匹配已被 agent 自動標為 `accepted`。後續改造前必須保留稽核軌跡、停止自動接受，且不得直接刪除既有資料。

## 2026-09-04：Schema patch 定位

- 修改 SQL schema 時，不能以重複出現的欄位尾端作為唯一 patch context；必須以目標 `CREATE TABLE` 區塊錨定，並以契約測試確認 constraint 位於正確資料表。曾在未提交草稿中把 `collection_collections_id_user_unique` 錯放到 `collection_post_comments`；已在部署前修正，未影響任何資料庫。

## 2026-09-06：批次分類資料寫入

- 同一批資料若同時更新貼文歸屬與搜尋投影，move mapping 只能定義一次並由兩個 update 共用；禁止手寫兩份 VALUES 清單，以免 target UUID 漂移。
- 資料庫成功回傳空結果不等於驗收完成。每次 batch 必須明確核對：預期筆數、目標 Collection、搜尋投影一致性、總貼文不變與 inbox 差額。
- tenant-aware foreign key 擋下錯誤目標後，先以唯讀查詢確認完整 rollback，才能修正並重送；不得假設失敗交易沒有局部影響。
