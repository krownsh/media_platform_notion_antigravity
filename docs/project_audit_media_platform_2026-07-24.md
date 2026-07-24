# Project Auditor（Dry Run）— 2026-07-24

## 範圍與快照

- **Allowlisted root**：`/mnt/d/others/sideproject/media_platform_notion_antigravity`
- **檢視範圍**：Express API、React 呼叫端、Supabase 存取、爬蟲與現有測試；未讀取 `.env` 或 `node_modules`。審計發現追蹤中的 `server/env.template` 含憑證，已立即改為 placeholder。
- **技術輪廓**：React/Vite + Express + Supabase + crawler + MiniMax。
- **工作樹狀態**：本次審計在尚有 108 個既存未提交變更的工作樹上進行；以下結論以目前檔案為準，沒有把既存變更當成可回復的基線。

## 結論

本輪已先收斂公開且有副作用的 API，才適合把 crawler 與 Agent 流程擴大。`/api/process` 的 capture key 僅能用於擷取；發布、AI、批次分類與互動資料路由皆需 Supabase JWT。剩餘重點是部署端的憑證輪替、註冊策略與 Stage B 的原子 finalization/outbox。

## Project Needs Ledger

| 標題 | 證據位置 | 影響 | 嚴重度 | 建議驗收 | 信心 | 狀態 |
| --- | --- | --- | --- | --- | --- | --- |
| 發布 API 無驗證 | `server/index.js:722-760` | 過去任意外部呼叫可使用伺服器的 Instagram、Threads、X 權杖發布內容。 | P0 | 未帶憑證為 401；帶 JWT 的使用者可正常發布；每次發布保留 audit log。 | 高 | JWT 已修正；audit log 待補 |
| 圖片工作流未驗證且信任 body `userId` | 舊 `server/index.js`、`src/pages/ImageWorkflowPage.jsx` | 過去任意呼叫可消耗模型額度與寫入他人 workflow log。 | P0 | 全部 Step 需 JWT，或在沒有替代供應商時完全停用。 | 高 | 已停用（JWT + 410） |
| 批次分類公開且跨 tenant 執行 | `server/index.js:849-859`、`server/services/batchProcessor.js:18-84` | 過去可由外部反覆觸發整庫 LLM 分類與寫入。 | P0 | 未授權為 401；只處理當前使用者的資料，或移到受控排程 worker。 | 高 | 本地已修正（JWT + user scope） |
| 可計費 AI 端點未驗證 | `server/index.js:405-471` | 過去 `/analyze-post`、`/rewrite`、`/remix`、`/generate-image` 可被公開濫用。 | P0 / P1 | 無憑證為 401；每個 UI 呼叫附 JWT；不存在的功能明確退役或補齊實作。 | 高 | 本地已修正（JWT；影像 route 410） |
| 公開 image proxy 可成為 SSRF 通道 | `server/index.js:100-166,478-529` | 過去伺服器可被誘導抓取任意 URL。 | P1 | 只允許 HTTPS 公網圖片來源；拒絕私有/loopback IP、redirect、非 image MIME；加大小與 timeout 限制。 | 高 | 本地已收斂；仍需 staging 測試 CDN 相容性 |
| 註冊端點用 admin API 直接確認 email | `server/index.js:433-458` | 公開端點可建立已驗證帳號，且無 rate limit/CAPTCHA；是否開放註冊尚未有產品策略。 | P1 | 決定 invite-only 或使用 Supabase 標準 signup；加入 rate limit，禁止未經驗證的 admin auto-confirm。 | 高 | 需產品決策 |
| Supabase 設定檢查與 client 初始化不一致 | `server/index.js:623-627`、`server/supabaseClient.js:11-34` | 過去路由可能認定資料庫可用，但實際 client 是 mock，形成成功回應或錯誤行為不一致。 | P1 | 唯一設定來源；缺 Service Role 時需明確 503，不可進入 mock 資料路徑。 | 高 | 本地已收斂（缺 Service Role 回 503） |
| X crawler 可能記錄或內嵌認證材料 | `server/services/crawlerService/twitterCrawler.js` | guest token 被寫入 log，且程式內含 X app bearer token；外洩後難以輪替與追蹤。 | P1 | 金鑰移至環境變數/secret store；log 僅保留遮罩後識別；完成輪替。 | 高 | 本地已修正；部署端須設定並輪替 |
| 追蹤中的 env template 含實際 Supabase 憑證 | `server/env.template`（審計前） | 取得 repository 的人可存取資料庫；應視為已洩漏的高權限密鑰。 | P0 | template 僅保留 placeholder；在 Supabase Dashboard 輪替 service-role／相關 JWT secret 後，server 使用新值正常啟動。 | 高 | 本地已移除，**待部署端輪替** |
| `/api/process` 尚未具跨表交易或 outbox | `server/index.js:80-155`、`docs/knowledge_action_vault_master_plan.md` | 跨 table 寫入失敗仍只能個別補償，無法提供可靠的副作用投遞。 | P1 | Stage B migration 建立 `agent_jobs`/`agent_job_events`/`outbox_events`，以 RPC transaction + outbox 驗證。 | 高 | 已規劃 |
| 建置環境不相容 | `package.json`、本機 `npm run build` | Node 18.19.1 不符合 Vite 所需 Node 20.19+，且缺少 Rollup optional native package，無法作為 release 驗證。 | P1 | CI/部署固定 Node 20.19+ 或 22.12+，乾淨安裝後 `npm run build` 成功。 | 高 | 待修正 |
| 端對端測試覆蓋不足 | `test/server/index.security.test.js`、`test/script/*.test.js` | 現有測試主要是 middleware/靜態契約；尚未驗證 HTTP、RLS、DB migration、n8n payload 或 crawler fixture。 | P2 | 增加 isolated Supabase + HTTP integration tests，至少覆蓋 tenant 隔離與失敗回滾。 | 高 | 待修正 |

## 修復順序

1. 為所有會消耗外部資源或發布內容的 API 加入身分驗證，並讓前端統一附 Supabase JWT。
2. 移除圖片工作流 body `userId`，所有 log 的讀寫加入 `user_id` owner 條件；批次分類改為 tenant-scoped 或 worker-only。
3. 明確停用尚未有 MiniMax 實作的 image/model endpoints，避免表面可用、實際在執行期失敗。
4. 收斂 proxy、註冊與 crawler 的密鑰處理。
5. 在 staging 套用 tenant unique constraint，接著做 Stage B RPC/outbox migration。

## 本輪交接

- n8n 正確設定見 [n8n_capture_setup.md](n8n_capture_setup.md)：它以 `x-api-key` 對應伺服器設定的固定 Supabase user，request body 只有 `url`。
- 本審計不曾套用 Supabase migration 或呼叫社群發布 API；未讀取 `.env`，但發現 repository 追蹤的 template 含舊憑證，已自本機版本移除。
