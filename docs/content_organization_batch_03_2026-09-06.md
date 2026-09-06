# 內容整理第 3 階段第 3 批 journal

執行時間：2026-09-06<br>
正式資料庫：`dcyjictvatixbflfrsfg`<br>
狀態：已套用並 postflight 驗收。

## 已核准且套用的 11 筆

| 目標 Collection | Source ID |
| --- | --- |
| 教學 | `e751402e-da7e-4328-9803-ffc357b1fe2d` |
| 教學 | `8a78681d-d08d-4b1e-865f-fe09337126cf` |
| 教學 | `bf541fbb-fe55-4d14-8262-618618964741` |
| 好用套件 | `091480ce-50f9-4f97-9200-fddd3006b22f` |
| 好用套件 | `ec0fbfe2-6161-42e3-973c-e9afe78b1a9b` |
| 好用套件 | `5871eded-edb4-4422-a917-70373d6a60bb` |
| 好用套件 | `9d190f26-2a14-4f1e-b8a3-17c40e09a3f9` |
| agent工具 | `c9298aa6-4ba9-4223-b05f-6066efe4482b` |
| agent工具 | `4874e220-ebc9-4571-bacf-88df519fb65c` |
| agent工具 | `ef3d7fd7-9363-4717-9f35-fdf172780a4c` |
| agent工具 | `e316e3c1-69f6-4f98-9a23-a82f337929b5` |

每列套用前的 `collection_id` 都是 NULL。交易同時更新貼文及其搜尋投影的 `collection_id`。

## 防護與驗收

- 目標 Collection、貼文與搜尋投影均限制為同一 Owner。
- 交易使用單一 JSON move mapping，貼文與搜尋投影各更新 11 列；任一筆數不符會 raise exception 並 rollback。
- Postflight：11/11 貼文與 11/11 搜尋投影在指定目標；378 篇貼文不變；inbox 從 67 降至 56；全庫 projection mismatch 為 0。

## 回復條件

只有在列出的 `source_id` 仍屬相同 Owner、目前仍指向本 journal 的目標 Collection，且沒有後續人工調整時，才能將貼文與搜尋投影的 `collection_id` 一起改回 NULL。不得以整庫 rollback 處理後續批次。
