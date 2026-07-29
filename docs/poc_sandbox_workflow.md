# POC 生成與沙盒執行

## 目前能力

`npm run agent:analyze -- <outbox-id>` 會依序執行：

### 2026-07-29 實測補充

- 模型產物違反靜態安全檢查時，流程只會帶著拒絕原因重生一次；第二次仍違規則使用可稽核的純標準函式庫 deterministic fallback。結果會記錄 `generation_method`、`generation_attempts` 與 `fallback_reason`。
- fallback 不會放寬網路、檔案、環境變數或子程序限制。
- 同一來源可有多條路由；`payload.agent_routes` 以 schema version 1 追蹤每條路由的狀態與 outcome，並以 `updated_at` 樂觀鎖避免覆蓋其他 worker 的更新。只有全部路由到達 terminal 狀態時，outbox 才會變為 `sent` 或 `failed`。

1. 讀取 `collection_capture_outbox` 與貼文分析資料。
2. Route Agent 分類，必要時由 Tavily 補充官方資料。
3. Project Auditor 與 Opportunity Matcher 找出應用案件。
4. 只針對最高分案件，由既有 MiniMax provider 產生一個 JavaScript 或 Python POC。
5. 靜態拒絕網路、環境變數、檔案、子程序、shell 與秘密字樣存取。
6. 將程式與 manifest 寫到 `sandbox/runs/<run-id>/`。
7. 在斷網、唯讀、受限資源的 Docker container 執行。
8. 將程式碼、雜湊、stdout、stderr、exit code、耗時與成功狀態追加至 `collection_post_analysis.insights` JSONB。
9. 貼文詳情頁會顯示最新成功 POC 的驗證目標、沙盒耗時、stdout 與安全 fallback 說明；衍生內容草稿不會取代原始貼文或自動發布。
10. POC 執行前須通過資料夾的 `collection_topic_scopes` 邊界：只有 `poc_proposal` 模式且明確列出目標專案的資料夾可提出 POC；CLI 預設只提案，必須加上 `--execute-poc` 才可真的呼叫模型、Tavily 與 Docker。

只要提案、不生成也不執行：

```powershell
npm run agent:analyze -- <outbox-id>
```

## 安全邊界

- Container 使用 `network_mode: none`、唯讀 root filesystem、唯讀 POC 掛載、`cap_drop: ALL` 與 `no-new-privileges`。
- 每次執行限制為 0.5 CPU、256 MB 記憶體、64 processes、64 MB `/tmp` 與最長約 20 秒。
- 生成碼只能使用 Node.js 20／Python 3.12 標準函式庫，且必須包含可執行 assertion。
- 不會把 `.env`、Supabase key、Tavily key 或 MiniMax key 傳入 container。
- `sandbox/runs/` 已被 `sandbox/.gitignore` 排除，不會污染 Git。
- 同一 `run_id` 寫回時會替換舊紀錄，避免重複結果。

這個 MVP 刻意不允許第三方套件安裝、clone repo 或 container 對外連線。它可驗證演算法、資料轉換與介面契約；真正需要外部套件的整合型 POC，必須另做套件 allowlist、版本鎖定、供應鏈掃描與分離式下載／斷網執行，不能偷渡回 `npm install`。

## JSONB 結果格式

`collection_post_analysis.insights` 會保留既有內容並追加：

```json
{
  "type": "poc_run",
  "schema_version": 1,
  "run_id": "uuid",
  "status": "success | error | timeout | output_limit",
  "stage": "generation | artifact_write | sandbox_execution | completed",
  "language": "javascript | python",
  "code": "完整 POC 程式碼",
  "code_sha256": "sha256",
  "artifact_path": "runs/<run-id>/main.js",
  "execution": {
    "success": true,
    "exit_code": 0,
    "stdout": "...",
    "stderr": "...",
    "duration_ms": 123
  }
}
```

生成、靜態檢查或 container 啟動失敗時也會寫入 `status=error` 與失敗階段。若資料庫寫回本身失敗，CLI 會以非零狀態結束，避免只留本機 log 的 silent failure。

## Windows 設定與驗證

需要 Docker Desktop；Node 流程會直接執行 `docker compose`，不依賴 WSL 或 Git Bash。

```powershell
winget install -e --id Docker.DockerDesktop
```

安裝後啟動 Docker Desktop，確認 daemon 可用：

```powershell
docker version
docker compose version
docker compose -f sandbox/docker-compose.yml config --quiet
npm run test:poc
npm run test:poc:docker
npm run agent:poc:check-storage
```

第一次執行 JavaScript／Python POC 時，Docker 可能需要從 Docker Hub 下載 `node:20-alpine` 或 `python:3.12-alpine` image。

## macOS 設定與驗證

```bash
brew install --cask docker
open -a Docker
docker version
docker compose version
docker compose -f sandbox/docker-compose.yml config --quiet
npm run test:poc
npm run test:poc:docker
npm run agent:poc:check-storage
```

macOS／Linux 執行路徑會使用 `sandbox/runner.sh`；Windows 則由 Node 直接呼叫 Docker Compose。兩條路徑套用相同的 Compose 安全限制。

## 已知限制

- 2026-07-29 已透過 Docker Desktop 官方 GUI 將 VHDX 搬至 `G:\DockerDesktopData\DockerDesktopWSL\disk\docker_data.vhdx`，並下載 `node:20-alpine`、`python:3.12-alpine`。JavaScript／Python 真實 container smoke test 均成功。
- 2026-07-29 第 5 筆 AI Code Review 來源已完成真實 E2E：run_id `66673c21-fd9f-423a-a8ad-d7bed8420d9a` 成功寫入 Supabase，Docker 輸出 `POC passed: detected 2 deterministic findings`。Tavily 因未設定 API Key 採降級處理，未完成來源查證。
- 後續已在 `server/.env` 設定並驗證 `TAVILY_API_KEY`；同一來源的 Tavily enrichment 查詢成功，快取只存於 `sandbox/.enrichment_cache.json`，不回寫正式資料。
- 2026-07-29 已拿真實 outbox item 完成 MiniMax／Tavily／Docker／Supabase E2E；後續重跑會重用既有成功 POC，不重複建立一筆 POC run。
- 2026-07-29 已實測 `payload.agent_routes`：第 5 筆的 `apply_poc` 完成後，`quick_rewrite` 與 `translate_localize` 仍保持 pending，因此 outbox 正確保持 `pending`。每次狀態更新都以 `updated_at` 樂觀鎖保護。
- 目前寫回沿用既有 `collection_post_analysis.insights` JSONB，沒有修改正式 Schema。
- JSONB 更新是單一互動式 runner 的 read-modify-write；未來若允許多 runner 併發，應改成 transaction RPC 或正式 `experiment_runs` table。
- Stage C SQL 的註解提到 `experiments`、`experiment_runs`、`integration_proposals`，但目前檔案尚未實際建立這三張表；本輪沒有擅自補 Schema。
- Docker 搬移前建立的可復原備份保留在 `G:\DockerDesktopBackup\2026-07-29\docker_data.vhdx`；確認數日正常運作前不要刪除。
