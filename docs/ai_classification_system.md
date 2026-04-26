# AI 內容分類系統 (V2 - 動態配置版)

## 1. 系統概述
本系統採用「規則優先 (Rule-based) + LLM 備援 (LLM Fallback)」的雙軌制，對所有採集到的內容進行貼標分類。所有的分類邏輯（包含關鍵字與 AI 提示描述）均存儲於 `category_configs` 資料庫表中。

## 2. 核心組件
- **CategoryProcessor (server/services/categoryProcessor.js)**: 負責調度分類邏輯，讀取 DB 配置並處理標籤判定。
- **AiService (server/services/aiService.js)**: 提供 AI 模型連線，優先使用 **Minimax V2**，備援使用 **Gemini 1.5 Flash**。
- **BatchProcessor (server/services/batchProcessor.js)**: 批量處理未分類貼文。

## 3. 分類流程
1. **規則匹配**: 系統從 DB 抓取 `patterns` 欄位，利用正則表達式進行初篩。
2. **AI 備援**: 
   - 若規則匹配結果為 `other`，系統會將貼文內容與所有類別的 `description` 傳送給 LLM。
   - 採用的 Prompt 會強迫 AI 從定義好的 Slug 清單中選取一個。
3. **模糊判定**: 為了防止 AI 的回覆包含廢話，程式會檢索回覆中是否包含特定的 Slug 關鍵字。

## 4. 資料庫結構 (category_configs)
- `slug`: 標籤識別碼（如 `ai`, `tool`）
- `label`: 顯示標題
- `description`: 供 AI 參考的判定準則
- `patterns`: 關鍵字陣列
- `is_active`: 是否啟用該標籤

## 5. 環境變數要求
- `MINIMAX_API_KEY`: 必須，主要分類引擎。
- `SUPABASE_SERVICE_KEY`: 必須，用於繞過 RLS 操作同步表單。

---
*更新日期：2026-04-08*
