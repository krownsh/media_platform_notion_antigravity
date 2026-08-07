# POC 生成與沙盒執行

## 目前能力

此文件中的 `agent:analyze` 是 Stage G 前的 legacy 工作流。新流程從 `agent:next` 選取 workflow、完成 triage 並取得使用者對該貼文的明確 `poc_execute` action 後，才可執行 POC。

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
10. 資料夾的 `collection_topic_scopes` 僅提供專案背景，不是 POC 授權。POC 執行需要該貼文的使用者明確 action plan 與新的執行確認。
11. 貼文詳情頁的「POC 工作台」是日常入口：會顯示該資料夾目標、綁定的 GitHub 專案、目前提案與已驗證結果。按「產生提案」只執行安全的本機分析；按「執行 POC」會先要求瀏覽器確認，才會送出 `EXECUTE_POC` 並實際呼叫模型、Tavily 與 Docker。未按確認不會產生付費 API 或沙盒執行。

## 前端操作

打開已歸入具備 `poc_proposal` 主題範圍的貼文詳情，即可看到「POC 工作台」。該面板只在主題範圍的 `project_targets` 包含目前 checkout 的 GitHub remote（本機為 `github:krownsh/media_platform_notion_antigravity`）時開放操作，避免將一個專案的 POC 套到另一個專案。

1. 按「產生提案」：更新候選 POC 與理由，不會執行 Docker 或外部模型。
2. 確認提案後按「執行 POC」：瀏覽器跳出確認；確認後才真的執行。
3. 成功後，原本的「POC 驗證結果」面板會顯示 stdout、耗時與驗證結果。

只要提案、不生成也不執行：

```powershell
npm run agent:next -- --interactive
```

## 安全邊界

- Container 使用 `network_mode: none`、唯讀 root filesystem、唯讀 POC 掛載、`cap_drop: ALL` 與 `no-new-privileges`。
- 每次執行限制為 0.5 CPU、256 MB 記憶體、64 processes、64 MB `/tmp` 與最長約 20 秒。
- 生成碼只能使用 Node.js 20／Python 3.12 標準函式庫，且必須包含可執行 assertion。
- 不會把 `.env`、Supabase key、Tavily key 或 MiniMax key 傳入 container。
- `sandbox/runs/` 已被 `sandbox/.gitignore` 排除，不會污染 Git。
- 同一 `run_id` 寫回時會替換舊紀錄，避免重複結果。

純演算法 POC 仍刻意不允許第三方套件安裝、clone repo 或 container 對外連線，只用來驗證演算法、資料轉換與介面契約。若貼文主張涉及某個工具、服務或代理人的實際行為，必須先核准 `test_plan.kind=integration`，再由 disposable `integration-runner` 依序執行安裝、真實互動與結果觀察。這不會安裝到正式專案或主機環境。

整合測試不能用「程式碼可解析／manifest 合法／安裝腳本看起來安全」代替產品主張。成功結果至少包含：貼文主張、測試規劃、setup log、實際 request/action、raw response、可觀察結果、逐項 assertion 與限制。缺少 interaction 或 assertion 的計畫會在執行前被拒絕；工具自述成功但觀察結果不符時仍判定失敗。

提案 JSON 的核心格式如下：

```json
{
  "test_plan": {
    "schema_version": 1,
    "kind": "integration",
    "objective": "驗證貼文中的具體主張",
    "claims_under_test": ["工具收到真實 request 後會產生指定結果"],
    "environment": { "network_access": true, "required_secrets": [] },
    "steps": [
      { "id": "install", "phase": "setup", "label": "安裝", "argv": ["npm", "install", "--prefix", "/workspace/tool", "套件名稱"] },
      { "id": "request", "phase": "interaction", "label": "送出 request", "argv": ["/workspace/tool/node_modules/.bin/tool", "run"], "stdin": "實際輸入" },
      { "id": "observe", "phase": "observation", "label": "觀察結果", "argv": ["node", "verify-result.js"] }
    ],
    "assertions": [
      { "id": "install-ok", "description": "安裝成功", "step_id": "install", "field": "exit_code", "operator": "equals", "expected": 0 },
      { "id": "request-ok", "description": "request 成功", "step_id": "request", "field": "exit_code", "operator": "equals", "expected": 0 },
      { "id": "result-ok", "description": "產物符合預期", "step_id": "observe", "field": "stdout", "operator": "contains", "expected": "RESULT_OK" }
    ],
    "limitations": ["僅驗證此計畫內的案例"]
  }
}
```

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

整合型結果使用 `schema_version: 2`，另保存 `poc_kind: "integration"`、完整 `test_plan`，以及 `evidence.steps`、`evidence.interactions`、`evidence.observations`、`evidence.assertions`。其中 interaction 會同時保存 argv/stdin 與 raw stdout/stderr/exit code；環境變數只記錄 secret 名稱，值會在 container 輸出落盤前遮罩。

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
