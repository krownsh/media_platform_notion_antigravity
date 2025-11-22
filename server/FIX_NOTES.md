# 修正說明

## 問題
前端嘗試載入使用 Node.js 模組（`process`, `fs`）的 `aiService.js`，導致瀏覽器錯誤。

## 解決方案
將 AI 分析功能完全移至後端處理：

### 架構變更

**之前（錯誤）：**
```
前端 (orchestrator.js) 
  → 呼叫 aiService.js (❌ 使用 Node.js 模組)
  → 呼叫 OpenRouter API
```

**現在（正確）：**
```
前端 (orchestrator.js)
  → 呼叫後端 /api/process
    → 後端 (server/index.js)
      → 呼叫 threadsCrawler (爬取資料)
      → 呼叫 server/services/aiService.js (✅ Node.js 環境)
        → 呼叫 OpenRouter API
      → 回傳包含 analysis 的完整資料
```

### 檔案變更

1. **新增**：`server/services/aiService.js` - 後端專用的 AI 服務
2. **刪除**：`src/services/aiService.js` - 前端不再需要
3. **修改**：`server/index.js` - 在 `/api/process` 端點整合 AI 分析
4. **修改**：`src/services/orchestrator.js` - 移除前端的 AI 呼叫邏輯

### 使用方式

現在當你在前端輸入 Threads URL 時：
1. 前端呼叫 `POST /api/process` 並傳送 URL
2. 後端自動：
   - 爬取 Threads 貼文
   - 執行 AI 分析（如果有設定 API Key）
   - 回傳完整資料（包含 `analysis.summary`）
3. 前端在 `PostDetailView` 顯示 AI Summary

### 測試

```bash
cd server
node test_ai_analysis.js
```

### 環境變數

確保 `server/.env` 或專案根目錄的 `.env` 包含：
```
OPENROUTER_API_KEY=sk-or-v1-你的金鑰
```

## 狀態

✅ 前端畫面已修復
✅ AI 分析功能正常運作（後端）
✅ 錯誤處理完善（AI 失敗不影響主要功能）
