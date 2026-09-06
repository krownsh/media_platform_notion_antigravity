# 內容整理第 3 階段第 4 批 journal

執行時間：2026-09-07<br>
正式資料庫：`dcyjictvatixbflfrsfg`<br>
狀態：已套用並 postflight 驗收。

## 已審閱且套用的 14 筆

| 目標 Collection | Source ID |
| --- | --- |
| 副業 | `4ad8359a-049a-4e4b-9b7e-7ae51beaba3a` |
| 副業 | `e3d1acaa-cf83-4cd1-9658-35c2b0674ff1` |
| 副業 | `3cdc49f0-612f-4914-a620-16b63d640b29` |
| 副業 | `eb32361b-91f6-44d6-ae7e-b99f474c48a5` |
| prompt | `54b9892f-dfcc-4bef-b385-48db2d20e534` |
| prompt | `dc28a3af-ed4a-4442-9bc7-fd99985bba85` |
| prompt | `dd7b769f-c89c-45cd-97f3-5ad8da0f70eb` |
| prompt | `af476ec0-31ad-4124-adc9-f5fea019df04` |
| 帳號監控 | `47cd6333-ed76-4db7-989a-b15a5157b2f1` |
| agent loop | `ebaa25e8-4cff-4745-ab02-33f882b3bdb8` |
| ai漫劇 | `639ca89d-2734-4e72-969f-4a0955fc70c9` |
| ai圖片+影片 | `3bd6fbf0-200e-4bf0-81cd-cf21bf0c57ae` |
| ai圖片+影片 | `28983a5c-9a3c-4409-be3d-1056afe27efb` |
| ai圖片+影片 | `475de93f-cbfc-46a5-8ae9-5405871849fe` |

## 防護與驗收

- 初次 preflight 的 prompt 目標 UUID 少一個字元，資料庫在 SQL 執行前拒絕；沒有寫入。修正後才進行第二次 preflight。
- 修正後 preflight：14 個唯一 Source ID、6 個 Owner 目標 Collection、14 篇貼文與 14 個搜尋投影皆存在且仍為 inbox。
- 交易使用單一 JSON move mapping，貼文與搜尋投影各更新 14 列；任一筆數不符會 raise exception 並 rollback。
- Postflight：14/14 貼文與 14/14 搜尋投影在指定目標；378 篇貼文不變；inbox 從 56 降至 42；全庫 projection mismatch 為 0。
- 四個已審閱批次合計新增 47 筆內容歸檔。其餘 42 篇保留 inbox，因低信心、內容歧義或沒有適合既有分類，未強制分類。

## 回復條件

只有在列出的 `source_id` 仍屬相同 Owner、目前仍指向本 journal 的目標 Collection，且沒有後續人工調整時，才能將貼文與搜尋投影的 `collection_id` 一起改回 NULL。不得以整庫 rollback 處理後續批次。
