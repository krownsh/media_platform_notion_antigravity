# 內容整理第 3 階段第 2 批 journal

執行時間：2026-09-06<br>
正式資料庫：`dcyjictvatixbflfrsfg`<br>
狀態：已套用並 postflight 驗收。

## 已核准且套用的 11 筆

| 目標 Collection | Source ID |
| --- | --- |
| 工程師開發優化 | `a528e615-0cc4-456e-9bff-988e7e22f186` |
| 工程師開發優化 | `f4b601cc-7626-441f-829f-f40a8105026d` |
| 工程師開發優化 | `4c16efca-475e-475a-bfe6-a9329533f9ea` |
| 工程師開發優化 | `48c28825-b4e8-4227-aeb0-bcb4b8b31673` |
| 工程師開發優化 | `06408519-dd1d-4083-8773-705d4646d753` |
| 工程師開發優化 | `610f8a7f-0eb2-4038-afd2-8a7ac4a5021b` |
| UI skill | `999e93ee-d6e8-4d4d-9cbe-2e92f3e00361` |
| UI skill | `3f96de0c-0730-457f-8e64-13b9dd1b542e` |
| UI skill | `2a44f56f-2f16-478e-b26c-257bd81ce0ce` |
| 好skill | `3acab1f0-aea8-420f-95c8-d58a73eafc25` |
| 好skill | `27f4e5d2-8402-49d4-91c8-93f5823ba30c` |

每列套用前的 `collection_id` 都是 NULL。交易同時更新貼文及其搜尋投影的 `collection_id`。

## 防護與驗收

- 目標 Collection、貼文與搜尋投影均限制為同一 Owner。
- 交易使用單一 JSON move mapping，貼文與搜尋投影各更新 11 列；任一筆數不符會 raise exception 並 rollback。
- Postflight：11/11 貼文與 11/11 搜尋投影在指定目標；378 篇貼文不變；inbox 從 78 降至 67；全庫 projection mismatch 為 0。

## 回復條件

只有在列出的 `source_id` 仍屬相同 Owner、目前仍指向本 journal 的目標 Collection，且沒有後續人工調整時，才能將貼文與搜尋投影的 `collection_id` 一起改回 NULL。不得以整庫 rollback 處理後續批次。
