# 內容分類系統（規則式／Hermes 交接）

## 1. 系統概述
本系統採用規則式分類，對所有採集到的內容進行貼標判定。MiniMax 已退役，server 不配置或呼叫 LLM；需要 AI 判讀時由 Hermes Codex agent 在 HTTP 流程之外處理。所有可用分類規則均存於 `collection_category_configs` 資料庫表中。

## 2. 核心組件
- **CategoryProcessor (server/services/categoryProcessor.js)**: 負責調度分類邏輯，讀取 DB 配置並處理標籤判定。
- **AiService (server/services/aiService.js)**: 明確回報 `HERMES_AGENT_REQUIRED`；不是 server 可呼叫的模型 provider。
- **BatchProcessor (server/services/batchProcessor.js)**: 批量處理未分類貼文。

## 3. 分類流程
1. **規則匹配**: 系統從 DB 抓取 `patterns` 欄位，利用正則表達式進行初篩。
2. **無規則命中**：保留 `other`，不會呼叫模型或偽造分類結果。
3. **需要 AI 判讀**：背景工作維持待處理狀態，由 Hermes Codex agent 依貼文來源與既有 workflow 輸入產生可覆核結果。

## 4. 資料庫結構 (collection_category_configs)
- `slug`: 標籤識別碼（如 `ai`, `tool`）
- `label`: 顯示標題
- `description`: 供 AI 參考的判定準則
- `patterns`: 關鍵字陣列
- `is_active`: 是否啟用該標籤

## 5. 環境變數要求
- `SUPABASE_SERVICE_KEY`: 供 server-side 資料庫操作使用；不可交給前端。
- 不需要 `MINIMAX_API_KEY` 或 `MINIMAX_GROUP_ID`。

---
*更新日期：2026-09-08*
