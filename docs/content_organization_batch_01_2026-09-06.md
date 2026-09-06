# 內容整理第 3 階段第 1 批 journal

執行時間：2026-09-06<br>
正式資料庫：`dcyjictvatixbflfrsfg`<br>
狀態：已套用並 postflight 驗收。

## 已核准且套用的 11 筆

| 目標 Collection | Source ID |
| --- | --- |
| 投資 | `f9c2b22b-ac98-4eec-9cdd-e0df114c09b6` |
| 投資 | `8c13f3ac-c2e7-498b-b0ea-2f7107faca76` |
| 投資 | `80c88058-3e7d-4f43-9a63-94ade27d371b` |
| 狗狗 | `9884ddcb-9f17-410d-8c40-fd930f6b92f5` |
| 狗狗 | `66458737-71fe-40e3-be9c-c03cabe9dd1d` |
| 狗狗 | `9c55a364-2cb4-43f3-9f67-ce5f9c62b756` |
| 狗狗 | `fa6de3f5-6e96-485a-a1da-69152aa77c7d` |
| 狗狗 | `5ed7bf3d-996c-4a23-afd2-13ca49d8b02d` |
| codex | `b9e1dcec-d3ec-400f-83d7-2c0a26211521` |
| codex | `3fb1c239-de45-4c5b-a8d7-fe9f4ae55dbc` |
| codex | `ced0a6bd-cf39-49f8-8d25-a9f7566f2919` |

每列套用前的 `collection_id` 都是 NULL。交易同時更新貼文及其搜尋投影的 `collection_id`。

## 防護與驗收

- 目標 Collection、貼文與搜尋投影均限制為同一 Owner。
- 交易要求貼文及搜尋投影各更新 11 列；任一筆數不符會 raise exception 並 rollback。
- 首次交易因一個錯誤 UUID 被 foreign key 拒絕；重查確認無局部更新後，使用單一共用 move mapping 成功套用。
- Postflight：11/11 貼文與 11/11 搜尋投影在指定目標；378 篇貼文不變；inbox 從 89 降至 78；全庫 projection mismatch 為 0。

## 回復條件

只有在列出的 `source_id` 仍屬相同 Owner、目前仍指向本 journal 的目標 Collection，且沒有後續人工調整時，才能將貼文與搜尋投影的 `collection_id` 一起改回 NULL。不得以整庫 rollback 處理後續批次。
