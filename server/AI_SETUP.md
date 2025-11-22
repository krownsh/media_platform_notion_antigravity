# AI 分析功能設定指南

## 功能概述

本系統已整合 OpenRouter API，可以使用大語言模型（LLM）自動分析 Threads 貼文內容，包括：
- 貼文主旨摘要
- 重點整理
- 圖片分析（如果有圖片）
- 情緒與語氣分析
- 關鍵字提取

## 設定步驟

### 1. 取得 OpenRouter API Key

1. 前往 [OpenRouter](https://openrouter.ai/)
2. 註冊或登入帳號
3. 在 Dashboard 中建立 API Key
4. 複製 API Key

### 2. 設定環境變數

在專案根目錄建立 `.env` 檔案（或複製 `server/env.template`）：

```bash
# 在專案根目錄
OPENROUTER_API_KEY=sk-or-v1-your-actual-api-key-here
```

### 3. 使用的模型

預設使用 **免費模型**：
- 文字分析：`google/gemini-2.0-flash-exp:free`
- 圖片分析：如果需要分析圖片，系統會自動使用支援視覺的免費模型

如需更換模型，請編輯 `src/services/aiService.js` 中的 `defaultModel` 設定。

可用的免費模型列表：https://openrouter.ai/models?order=newest&supported_parameters=tools&max_price=0

### 4. Prompt 自訂

AI 分析的 prompt 儲存在：
```
server/prompts/threads_summary_prompt.md
```

你可以編輯此檔案來調整分析的格式和重點。

## 使用方式

### 自動分析

當你透過前端輸入 Threads URL 時，系統會：
1. 爬取貼文內容（文字、圖片、留言）
2. 自動呼叫 AI 分析 API
3. 在 PostDetailView 的 "AI Summary" 區塊顯示分析結果

### 手動測試

你可以使用測試腳本來測試 AI 分析功能：

```bash
cd server
node test_ai_analysis.js
```

這會讀取 `threads_debug_structure.json` 並進行分析。

### API 端點

後端提供了獨立的 API 端點：

```
POST http://localhost:3001/api/analyze-post
Content-Type: application/json

{
  "fullJson": [
    {
      "index": 0,
      "text": "貼文內容...",
      "author": "作者名稱",
      ...
    },
    ...
  ]
}
```

回應：
```json
{
  "summary": "## 貼文主旨\n...\n\n## 重點整理\n...",
  "raw": { ... }
}
```

## 架構說明

### 資料流程

```
Threads URL
    ↓
threadsCrawler.js (爬取資料)
    ↓
full_json (結構化資料陣列)
    ↓
orchestrator.js (呼叫 AI API)
    ↓
aiService.js (OpenRouter 整合)
    ↓
analysis.summary (Markdown 格式分析結果)
    ↓
PostDetailView.jsx (顯示在 UI)
```

### 檔案說明

- `src/services/aiService.js` - AI 服務核心，處理 OpenRouter API 呼叫
- `server/prompts/threads_summary_prompt.md` - AI 分析的 system prompt
- `src/services/orchestrator.js` - 整合爬蟲和 AI 分析
- `src/services/crawlerService/threadsCrawler.js` - 產生 full_json 資料
- `server/index.js` - 提供 `/api/analyze-post` 端點

## 注意事項

1. **免費額度**：OpenRouter 的免費模型有使用限制，請注意配額
2. **圖片分析**：如果貼文包含圖片，會自動傳送給 AI 分析（最多 3 張）
3. **錯誤處理**：如果 AI 分析失敗，系統會繼續運作，只是不顯示 AI Summary
4. **API Key 安全**：`.env` 檔案已加入 `.gitignore`，請勿將 API Key 提交到版本控制

## 疑難排解

### AI 分析沒有顯示

1. 檢查 `.env` 檔案是否存在且 `OPENROUTER_API_KEY` 已設定
2. 檢查後端 console 是否有錯誤訊息
3. 確認後端伺服器正在運行（`node server/index.js`）

### API Key 錯誤

確認 API Key 格式正確：
- 應該以 `sk-or-v1-` 開頭
- 在 OpenRouter Dashboard 中確認 Key 狀態為 Active

### 分析結果不符合預期

編輯 `server/prompts/threads_summary_prompt.md` 來調整 prompt。
