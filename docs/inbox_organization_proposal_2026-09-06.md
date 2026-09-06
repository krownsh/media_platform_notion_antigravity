# Inbox 內容分類提案（唯讀）

產生時間：2026-09-06<br>
正式資料庫：dcyjictvatixbflfrsfg<br>
範圍：同一 Owner 的 89 篇 collection_id 為 NULL 的貼文。

## 結果

- 52 篇：中／高信心的既有自建 Collection 候選，仍需 Owner 逐列核准。
- 37 篇：低信心或未命中保守規則，維持 inbox。
- 沒有新增 Collection、Topic、Project；沒有更新貼文、搜尋投影、scope、workflow JSON 或 Vault。
- 完整逐列 CSV：docs/inbox_organization_proposal_2026-09-06.csv。

| 建議目標 | 中／高信心待核准搬移 | 留在 inbox |
| --- | ---: | ---: |
| 工程師開發優化 | 3 | 5 |
| 好用套件 | 3 | 3 |
| 好skill | 2 | 6 |
| 投資 | 5 | 1 |
| 狗狗 | 9 | 0 |
| 副業 | 3 | 1 |
| 帳號監控 | 3 | 0 |
| 教學 | 3 | 2 |
| 維持 inbox（未命中保守規則） | 0 | 14 |
| agent工具 | 2 | 0 |
| ai圖片+影片 | 1 | 2 |
| ai漫劇 | 2 | 0 |
| codex | 3 | 1 |
| prompt | 8 | 0 |
| UI skill | 5 | 2 |

## 判斷方法與邊界

1. 只以貼文內容、既有摘要與 tags 比對受控關鍵概念；沒有把平台欄位納入規則。
2. 只指向第 0 階段保護清單中的既有 Owner Collection；每個目標 ID 已回查存在。
3. owner_review_move_to_existing_collection 只是候選，尚未進行資料更新。
4. keep_inbox_low_confidence_candidate 與 keep_inbox_no_conservative_match 均不得在第 3 階段自動搬移。
5. CSV 以 source_id 與來源 URL 讓 Owner 回到原貼文審閱；content_evidence 是命中的內容概念，不是平台推斷。

## 下一個可執行動作

Owner 審閱 CSV 後，僅把明確核准的 source_id 交給第 3 階段。套用前必須再次核對該筆目前的 collection_id、user_id 與目標 Collection ID；任何期間被人工改動的列都跳過，不覆蓋。
