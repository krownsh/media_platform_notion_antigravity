# AI 分析標題：回補與新貼文工作流計畫

## 已確認現況

- 2026-09-07 的唯讀盤點：383 篇貼文中有 374 篇 `collection_posts.title`
  為空；社群來源通常沒有原生文章標題。
- 現行 URL capture 已在 `server/services/captureAnalysisService.js` 呼叫模型，
  但 prompt／回傳結構只保存摘要、tags、topics，沒有標題。
- `collection_posts.title` 目前代表來源標題；直接將 AI 結果寫入該欄位會混淆
  原始來源與生成內容，也會讓日後重新抓取難以判斷是否該覆寫。
- `collection_post_analysis` 已是每篇貼文的 AI 結果儲存位置，適合保存
  `generated_title`。

## 目標與邊界

- 為沒有來源標題的貼文建立短、可讀、繁體中文的 AI 分析標題。
- 保留原始 `collection_posts.title`，不覆寫、不重抓來源、不重分類貼文。
- 新貼文於既有 capture analysis 的同一次模型回應產生標題，不增加第二次
  模型呼叫。
- 舊資料回補必須是可預覽、可限量、可恢復的 maintenance job；此計畫不執行
  批次 AI 呼叫或正式資料更新。

## 實作設計

1. 新增 additive migration，在 `collection_post_analysis` 加入
   `generated_title text`、`title_generated_at timestamptz`、
   `title_generation_source text`；沿用既有 owner RLS，不新增公開 RPC。
2. 調整 Threads／generic analysis prompt，使 JSON 明確回傳
   `generated_title`（12–32 字、描述內容、不含 emoji／引號／虛構事實）。
   `captureAnalysisService` 僅在來源 title 為空時保存此欄位。
3. 調整 URL capture finalization SQL，將 analysis JSON 的
   `generated_title` 寫入分析表；來源 title 仍只由爬取資料寫入。
4. 圖片來源的 Hermes image-analysis contract 同步加入可選
   `generated_title`，但缺值不可把原本成功的圖片摘要流程標示為失敗。
5. 前端、搜尋索引與 Vault writer 採顯示優先序：
   `source title` → `generated_title` → `來源未提供標題`。Vault 檔名只在新寫入
   時使用生成標題，絕不搬動既有檔案。
6. 新增明確的單元／契約測試：有來源 title 時不生成或覆寫；來源 title 缺失時
   保存正規化生成標題；空／不合法模型輸出保持 null 並留下可重試狀態。

## 舊資料回補（需第二次 Owner 授權）

1. 先以 service-role read-only script 產生 manifest：候選 post ID、是否已有
   摘要、內容長度、預估批次數；不輸出完整私密內容、不更新資料。
2. Owner 檢視 manifest 與模型成本後，從 `--limit 10 --dry-run` 開始；每批只選
   `title is null` 且 `generated_title is null` 的同一位使用者貼文。
3. 每成功一筆只更新 AI analysis 的三個 title 欄位；失敗記錄到可觀測的批次報告，
   不覆寫來源 title、不改 summary、tags、Topic、Collection 或 Vault。
4. 批次完成後重建搜尋文件，唯讀核對「缺顯示標題」計數，再由 Owner 決定是否處理
   失敗項目。不得將結果自動視為人工確認。

## 驗收與回滾

- 新貼文：來源未提供標題時，完成的 analysis 有 `generated_title`；來源有標題時
  AI 欄位保持 null。
- UI、搜尋、Vault 對三種顯示優先序一致；既有 Vault 路徑與資料夾不變。
- 回補 job 需具備 `--dry-run`、`--limit`、idempotent 選取條件與逐批報告。
- 回滾只需停止 job 並將本次 batch 寫入的 `generated_title` 欄位設回 null；不需要
  還原任何來源內容或分類。
