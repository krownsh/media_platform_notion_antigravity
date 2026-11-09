# Agent 工作流唯一引導

所有來源擷取、脫水、跨來源比較、知識彙整、Topic／Project、Library 查找、POC 與可選內容創作，一律載入：
`hermes/skills/owner-guided-media-workflow/SKILL.md`

這是唯一正式行為規範；my-mediacrawl-skill 只做相容轉接。舊 Hermes、Cron、Vault、Knowledge Space、taxonomy 或 handoff 文件不得覆蓋此規範。Skill 的目標能力不代表已部署；實際 API、資料庫與環境能力須另外驗證。不可為了符合新版流程而略過既有後端限制。

## 核心方向

知識彙整、Owner 的可信度／投入／融合判斷為主線，內容創作為可選支線。收藏不是認同；AI 預處理可自動準備與保存為候選；正式理解需可追溯的 Owner 明確決定。自然語言明確接受可作為決策證據，不重複要求儀式性確認。AI 新增推論不能冒充 Owner 的觀點。

開始、接手、卡住或階段切換時交代目前階段、原因與下一步；一般討論不固定重複模板。支援單篇、多篇、Topic 與 Project 範圍。所有 Agent 使用共同紀錄。

## 模組責任

- Backend／Schema：共同狀態、使用者隔離、版本、idempotency、稽核、排程與失敗重試。使用者資料以 user_id 綁定 auth.users；表格包含 created_at／updated_at，JSONB 結構附註解。
- Capture／Parser：依平台使用現有 crawler，保存原始證據與來源版本，揭露缺漏及巢狀長文狀態。現況 crawler-only；不得宣稱官方 API-first、官方 API fallback 或未驗證的瀏覽器能力。
- Preprocessing Worker／LLM adapter：目標為脫水、主張與條件抽取、相關來源比較和分級。供應商可替換；不能用固定 100 字摘要與 hashtags 代替知識準備。背景自動化需真實 worker 支援。
- Discussion／Synthesis Agent：研究、反駁、融合候選，記錄 Owner 判斷及未解問題，透過支援的 API 保存；不自行採納模型結論。
- Frontend：來源／脫水／差異可對照，進度與等待原因可見，人工決策可接續；不保管服務密鑰或直接繞過審核寫入正式資料。
- Project／Verification：提出具體驗證與投入取捨；執行需要對應授權，結果回饋知識。
- Content Output：依要求重用來源與知識產出文章、Prompt、圖片或影片；創作與發布分開，不能阻塞知識主線。
- Local Projection：依已設定的 Vault 同步，保護手寫內容與歷史；同步狀態與知識完成狀態分開。

## 變更與驗證

對齊 Skill 時同步檢查入口 metadata、相容入口及相關契約測試。用真實情境驗證行為，不以文件關鍵字通過冒充 runtime 驗收。禁止把文件更新當成背景服務、資料遷移、模型接線或部署授權。實作時尊重既有工作樹、使用者資料與已確認的行為邊界。
