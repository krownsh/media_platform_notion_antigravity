# 速率限制解決方案

## 問題

OpenRouter 的免費模型有速率限制（Rate Limit）。當遇到 429 錯誤時：

```
OpenRouter API Error: 429 - google/gemini-2.0-flash-exp:free is temporarily rate-limited upstream
```

## 解決方案

### 1. 自動備用模型切換 ✅

系統現在會自動嘗試多個免費模型：

1. `google/gemini-2.0-flash-exp:free` （支援圖片分析）
2. `meta-llama/llama-3.2-3b-instruct:free`
3. `qwen/qwen-2-7b-instruct:free`
4. `microsoft/phi-3-mini-128k-instruct:free`

當一個模型遇到速率限制時，系統會自動切換到下一個模型。

### 2. 等待重試

如果所有免費模型都遇到速率限制，請：

- **等待 5-10 分鐘**後重試
- 免費模型的速率限制通常會在短時間內重置

### 3. 使用自己的 API Key（推薦）

在 OpenRouter 新增自己的 API Key 可以獲得更高的速率限制：

#### 步驟：

1. 前往 [OpenRouter Settings](https://openrouter.ai/settings/integrations)
2. 連接你的 Google AI Studio 或其他 LLM 提供商帳號
3. 新增 API Key
4. 系統會自動使用你的配額，避免公共速率限制

#### 支援的提供商：

- **Google AI Studio** - 提供免費的 Gemini API 配額
- **Anthropic** - Claude 模型
- **OpenAI** - GPT 模型
- 其他提供商

### 4. 查看當前模型狀態

訪問 [OpenRouter Models](https://openrouter.ai/models?order=newest&max_price=0) 查看：
- 哪些免費模型可用
- 當前速率限制狀態
- 模型性能比較

## 系統行為

### 成功時
```
[AiService] Attempt 1/4 using model: google/gemini-2.0-flash-exp:free
[AiService] Analysis completed
```

### 遇到速率限制時
```
[AiService] Attempt 1/4 using model: google/gemini-2.0-flash-exp:free
[AiService] Rate limit hit for google/gemini-2.0-flash-exp:free, trying next model...
[AiService] Switching to model: meta-llama/llama-3.2-3b-instruct:free
[AiService] Attempt 2/4 using model: meta-llama/llama-3.2-3b-instruct:free
[AiService] Analysis completed
```

### 所有模型都失敗時
```
[AiService] Attempt 4/4 failed
返回錯誤訊息：
"所有免費模型都遇到速率限制。請稍後再試..."
```

## 最佳實踐

1. **避免頻繁請求** - 免費模型有每分鐘請求限制
2. **使用自己的 Key** - 獲得更高配額和更穩定的服務
3. **錯峰使用** - 避開使用高峰時段
4. **快取結果** - 相同內容不需重複分析

## 技術細節

### 模型選擇邏輯

```javascript
// 系統會循環嘗試所有模型
models = [
    'google/gemini-2.0-flash-exp:free',  // 優先，支援圖片
    'meta-llama/llama-3.2-3b-instruct:free',
    'qwen/qwen-2-7b-instruct:free',
    'microsoft/phi-3-mini-128k-instruct:free'
]

// 遇到 429 錯誤時自動切換
if (response.status === 429) {
    switchToNextModel();
    continue;
}
```

### 圖片分析

- 只有 Gemini 模型支援圖片分析
- 其他模型會跳過圖片，只分析文字
- 系統會自動檢測模型能力

## 常見問題

### Q: 為什麼會遇到速率限制？
A: 免費模型是共享資源，有全域速率限制。使用人數多時容易達到限制。

### Q: 速率限制多久會重置？
A: 通常 5-10 分鐘內會重置，具體取決於提供商。

### Q: 如何完全避免速率限制？
A: 在 OpenRouter 新增自己的 API Key，使用個人配額。

### Q: 備用模型的品質如何？
A: 所有模型都能完成基本分析，但 Gemini 品質最好且支援圖片。

## 更新日誌

- **2025-11-23**: 新增自動備用模型切換功能
- **2025-11-23**: 新增 4 個免費模型支援
- **2025-11-23**: 改善錯誤訊息，提供明確指引
