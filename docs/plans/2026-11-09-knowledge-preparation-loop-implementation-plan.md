# Knowledge Preparation Loop — 開工準則與實作規劃

> **狀態：** 已核准開工  
> **範圍：** Phase 0 + Phase 1  
> **主線：** 知識彙整與 Owner 判斷；內容創作僅為下游可選輸出。  
> **遠端基線：** `main` @ `3ad1bec`（editorial UI rebuild 合併後）

本文件是任何接手 Agent 的唯一開工入口。行為規範仍以
[`hermes/skills/owner-guided-media-workflow/SKILL.md`](../../hermes/skills/owner-guided-media-workflow/SKILL.md)
與根目錄 [`agents.md`](../../agents.md) 為準；本文件定義本輪可交付的 runtime 實作。

## 1. 要解決的問題

目前系統可擷取並保存來源，也有 Owner Review、Topic／Project 與搜尋的骨架；但「候選整理」尚不是實際的模型預處理流程。使用者仍需重新閱讀大量粗資料，且無法立即知道：

- 這篇新增了什麼、是否只是重複；
- 它和已保存內容是否矛盾、互補或條件不同；
- 現在是否值得投入時間；
- 要交給任一 Agent 討論時，應帶走哪些來源、脈絡與問題。

因此本輪建立可驗證的閉環：

```text
Capture → 素材卡（脫水）→ 比較 → 知識工作台 → Agent 交接包 → Owner 決定
```

「素材卡」是 AI 候選理解，不是 Owner 的正式知識；沒有明確接受不得提升為正式觀點。

## 2. 範圍與非範圍

### 本輪必做（Phase 0 + 1）

1. 將原始來源、AI 候選、Owner 已採納知識維持為三個不同狀態。
2. 完成可執行的預處理 Worker：
   - 來源完成後建立工作；
   - 透過可替換 LLM Adapter 產生結構化素材卡；
   - 失敗、重試、等待來源修復和執行版本可追蹤。
3. 對同一 Owner 的既有資料產生候選比較：
   - `duplicate`、`extends`、`conflicts`、`conditional_difference`、`related`；
   - 每筆關係要保留理由、證據定位、信心與 AI 候選狀態。
4. 建立知識工作台與來源詳情呈現：
   - 原始證據；
   - 素材卡；
   - 差異／重複／衝突；
   - 「現在討論／稍後／略過／建立交接包」。
5. 產生 Agent 平台無關的交接包；前端至少可複製 Markdown／JSON，後端可讀取其穩定 API。
6. 不破壞現有 capture、review、Topic、Project、搜尋與既有收藏。

### 本輪不做

- 自動採納、替 Owner 判斷可信度或投入價值。
- 自動發文、排程發布或以創作取代知識工作台。
- 對 Claude、ChatGPT、Grok 等每個平台做專屬串接；本輪只定義共同 handoff 格式。
- 強制向量資料庫或大型歷史資料回填；先以現有搜尋與結構化候選比較運作。
- 大規模改寫既有來源、刪除 legacy 表格或直接變更生產資料。
- 將 LLM API Key 放到前端。

## 3. 資料模型

沿用所有既有 `owner_*` 命名、`user_id` 隔離、RLS、`created_at`／`updated_at`、idempotency 與 audit 原則。每次 migration 必須可重複執行。

| 新資料 | 用途 | 不可混淆之處 |
|---|---|---|
| `owner_source_preparations` | 一個 source revision 的素材卡與執行狀態 | AI 候選；不能當正式知識 |
| `owner_source_relations` | 當前來源與既有來源／已接受知識的關係候選 | 需帶 evidence、confidence、candidate 狀態 |
| `owner_agent_handoffs` | 可跨 Agent 傳遞的受版本控制工作包 | 交接不是採納；回覆也不能自動升級 |
| 現有 `owner_review_proposals` | 只放需要 Owner 決定的正式提案 | 不要拿來當素材卡儲存桶 |

### 素材卡最小契約

```json
{
  "dehydrated_summary": "保留資訊密度，不用固定字數摘要",
  "claims": [
    {
      "statement": "可驗證主張",
      "conditions": ["成立條件"],
      "evidence_refs": ["來源區段或 URL anchor"],
      "uncertainty": "缺少何種證據"
    }
  ],
  "novelty": "相對既有內容可能新增什麼",
  "limits": ["限制、反例、來源不足"],
  "discussion_questions": ["供 Owner 反駁或回答的問題"],
  "suggested_topics": [],
  "suggested_projects": []
}
```

輸出必須以 schema 驗證；解析失敗不可靜默保存成「完成」。

## 4. 後端開工順序

### 4.1 先讀再改

接手者先讀取：

- `server/index.js`
- `server/routes/reviewRoutes.js`
- `server/routes/ownerKnowledgeRoutes.js`
- `server/services/ownerCandidateGenerationService.js`
- `server/services/captureProcessingService.js`
- `server/workers/captureWorker.js`
- `database/deployments/stage_x_owner_guided_review_domain.sql`
- `database/deployments/stage_y_owner_guided_candidate_queue_and_retrieval.sql`
- `src/store/rootSaga.js`
- `src/api/reviewApi.js`
- `src/api/ownerKnowledgeApi.js`

先確認 editorial UI rebuild 有沒有更動上述界面；不要按本文件猜測實際欄位。

### 4.2 Migration

建立單一新 deployment SQL，內容至少包括：

- `owner_source_preparations`
- `owner_source_relations`
- `owner_agent_handoffs`
- 必要 index、unique key、RLS、service-role policy、updated timestamp trigger
- 對 source revision／owner identity 的 FK
- 只讀或可控的 audit event

**禁止** 在 migration 中回填全部歷史資料或呼叫模型。

### 4.3 LLM Adapter 與 Worker

新增 provider-neutral adapter，例如：

```text
server/services/llm/
  providerAdapter.js
  openRouterProvider.js
  nimProvider.js
  schemas.js
  preparationPrompt.js
```

規則：

- Provider、model、prompt version、request fingerprint、token／成本資訊（若供應商提供）寫入 job/preparation metadata。
- 前端只看狀態與結果，不接觸 API key。
- 設定缺失時 job 要是可理解的 `waiting_configuration`／`failed`，不得假裝完成。
- 先接一種供應商進行實測；另一種保持可切換 Adapter。預設建議先用 OpenRouter。
- `ownerCandidateGenerationService` 可改為真正派發 preparation job，但不要破壞既有 review routes 契約。
- Capture 成功後入列；partial source 僅允許輸出帶明確缺口的有限素材卡。

### 4.4 API

維持 `/api/review` 的相容性，新增以 `/api/knowledge` 為主的路由：

| Method | Endpoint | 責任 |
|---|---|---|
| GET | `/api/knowledge/workspace` | 回傳值得處理項目與等待原因 |
| GET | `/api/knowledge/sources/:sourceRevisionId/preparation` | 取得素材卡與工作狀態 |
| POST | `/api/knowledge/sources/:sourceRevisionId/preparation` | 重新排入預處理（要有 idempotency） |
| GET | `/api/knowledge/sources/:sourceRevisionId/relations` | 取得比較候選與證據 |
| POST | `/api/knowledge/handoffs` | 建立 scoped handoff |
| GET | `/api/knowledge/handoffs/:handoffId` | 匯出 Markdown／JSON |
| POST | `/api/knowledge/handoffs/:handoffId/response` | 保存外部 Agent 回覆為候選材料 |

所有路由必須驗證 owner scope；禁止 client 直接寫 Supabase 來繞過正式知識流程。

## 5. 前端開工順序

### 5.1 API 與 state

新增 `src/api/knowledgeWorkspaceApi.js`，所有請求經既有 API 層。  
在 Redux Saga 接入 loading / success / failure，並讓狀態明確區分：

- 尚未準備；
- 擷取中；
- 等待 LLM 設定；
- 預處理中；
- 可檢視；
- 來源不完整；
- 失敗但可重試。

### 5.2 UI 範圍

1. **首頁工作台**
   - 「現在值得處理」而非單純收藏 inbox；
   - 顯示原因：有衝突、與 active Project 有關、被直接交給 Agent、尚未整理等；
   - 可操作：現在討論、稍後、略過、查看來源。

2. **來源詳情**
   - 原始證據；
   - 素材卡；
   - 比較關係；
   - 討論／交接。
   - AI 產物均標示「候選」，不可使用像正式結論的語氣。

3. **Agent 交接**
   - 範圍可選單一來源、數篇來源、Topic 或 Project；
   - 可複製 Markdown 與 JSON；
   - 顯示來源、未知處、待回答問題和 Owner 尚未決定的項目。

現有 editorial UI 為外觀基線。新功能必須延續其視覺語言，不得回退成舊 Collection UI。

## 6. 優先順序規則

這是處理排序，不是事實真偽或內容品質分數：

1. Owner 明確要求「現在討論」或直接交給 Agent 的來源。
2. 與 active Project／Topic 關聯，且存在新資訊或衝突。
3. 多篇來源可形成待驗證的融合問題。
4. 普通收藏：先完成素材卡，等待 Owner 挑選。

不因收藏而自動認定可信、值得投入或值得發布。

## 7. 驗收條件

### Runtime 驗收

使用至少四種資料驗證：

1. 完整單篇來源：有素材卡、問題與 evidence refs。
2. Partial 來源：卡片清楚說明缺失，不能生成超出證據的結論。
3. 與既有來源矛盾：顯示衝突與兩邊證據，而非判定誰是真的。
4. 直接交給 Agent：可匯出可讀的 handoff，並保存 Agent 回覆為候選，不自動採納。

### 工程驗收

- Migration 可執行、可重複執行、RLS 可驗證。
- API 有 request/response 契約測試。
- LLM JSON schema 驗證、失敗重試與 idempotency 有測試。
- `npm run lint`、`npm run build` 與現有 `node --test` 全數通過。
- 每個 UI loading／empty／partial／error 狀態可看見。
- 不以「文件已更新」代替 worker、API 或 schema 的實作證明。

## 8. 交付與交接規則

每一小段以獨立、可審查的 PR 交付，建議順序：

1. **PR 1：Schema + service contracts + tests**
2. **PR 2：Provider adapter + real preparation worker + tests**
3. **PR 3：Knowledge API + workspace state**
4. **PR 4：Editorial UI integration + end-to-end verification**

每張 PR 必須寫清楚：

- 已完成範圍、未完成範圍；
- migration 檔與部署順序；
- 需要的環境變數（不可貼出值）；
- 執行過的驗證指令與結果；
- 下一位 Agent 的唯一下一步；
- 未解風險或需要 Owner 決定的事項。

禁止直接 push 到 `main` 進行 runtime 開發；使用 feature branch 與 PR。此文件或 Issue 若與實際程式衝突，以遠端程式與 migration schema 為準，先在 PR 說明差異再調整計畫。
