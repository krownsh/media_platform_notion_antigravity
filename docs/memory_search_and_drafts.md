# 記憶搜尋與自動草稿

## 搜尋

Stage N 的 `collection_post_search_documents` 是 `collection_posts` 的可重建
文字投影，不是第二個真相來源，也不儲存 embedding／pgvector。Hermes 每次
預處理會寫入標題、摘要、原文、標籤、作者、草稿與四組可解釋線索：

- `keywords`：概念與主題
- `entities`：工具、產品、人物、專案
- `aliases`：縮寫與別名
- `memory_cues`：使用者可能記得的自然語句

部署 Stage N 後，首次建立歷史索引：

```bash
npm run search:index
```

之後新貼文會在 capture finalization／Hermes preprocess 自動更新。前端的
「記憶搜尋」呼叫 `/api/search`，支援文字與 workflow status 篩選。

## 自動改寫

高信心、低風險的 `fast_rewrite` 可以在同一次 Hermes preprocess 直接落成
`content_assets`／`content_revisions` Draft，不再多叫一次模型；它永遠是
`published=false`，不會自動發布。草稿會同時出現在：

- Supabase 的 Content Studio 資料
- `Vault/content/drafts/<domain>/<format>/...md`
- 貼文詳情頁的 Hermes 工作流區塊

`content_synthesis` 只有在已完成研究或離線 POC 證據後才可自動產生。低信心、
需要連網／憑證／安裝套件或會修改正式專案的行為，仍只寫入 workflow 的
`review_request`，等待後續互動任務。

### 外部編稿 Skill 擴充

`content_output.rewrite_skill` 是保留的掛接點。外部 Skill 可提供名稱、版本、
預設、目標平台、編稿 brief 與限制條件；本專案只保存這些 metadata 與產出的
Draft，不複製或取代外部 Skill，讓不同平台的改寫規則可以獨立演進。
