# Worktree 處置矩陣（2026-09-08）

盤點時間：2026-09-08（Asia/Taipei）。僅讀取；下列均為建議，未執行清理、合併、commit、push 或 stash。

基準：`main=223fe390780454e2fb17b4f8d5d3fdebd5d1e0b3`。所有分支以 `git merge-base --is-ancestor <branch> main` 驗證為 main 祖先（exit 0）；`git cherry -v main <branch>` 與 `git log main..<branch>` 都為 0 列。因此這是 commit 祖先整合，不是僅憑 `--merged`；但不代表舊 checkout 可安全執行或可刪除。

| 路徑 | HEAD／分支 | dirty/index/untracked/ignored | 相對 main／patch 證據 | 獨有內容與紀錄位置 | 建議 | 前置條件與理由 |
| --- | --- | --- | --- | --- | --- | --- |
| `G:\media_platform_notion_antigravity` | `223fe39` / `main` | staged 0；unstaged 0；untracked `.worktrees/`、`docs/system_audit_plan_2026-09-08.md`；ignored 18,854（`.env`、`server/.env`、`node_modules/`、`dist/`、`sandbox/` 等） | 基準 | 本輪計畫與 worktree 容器；敏感 env 不可入 Git | 保留 | 主工作目錄；本輪報告新增後再由協調者決定保存方式 |
| `.worktrees/agent-dev` | `0db1e8f` / `agent-dev` | staged 0；unstaged 0；untracked `artifacts/container-migration/2026-09-05-stage-o-stage-p-preflight/`（5 個 manifest）；ignored `dist/` 4 | ancestor；0 unique/cherry rows | `baseline.json`、collection/topic/vault plans、`unresolved.json` | 保留 | manifest 是 DB/Vault 唯讀計畫紀錄，無 owner 同意不得清理或套用 |
| `.worktrees/content-first-vault` | `632d919` / `codex/content-first-vault` | clean；ignored 0 | ancestor；0 unique/cherry rows | 仍含 `wiki/sources`／Collection index 舊實作 | 保留，禁止從此執行 | 舊路徑會重引已撤回方案；先確認 owner 與無未追蹤資料才可考慮移除 checkout |
| `.worktrees/content-org-phase0` | `492fee2` / `codex/content-org-phase0` | clean；ignored `dist/` 4 | ancestor；0 unique/cherry rows | 仍含 `wiki/sources` 舊實作 | 保留，禁止從此執行 | 同上 |
| `.worktrees/integrate-september` | `44d17aa` / `codex/integrate-september` | clean；ignored `dist/` 4 | ancestor；0 unique/cherry rows | 無 `wiki/sources` 命中；仍有 auto-container vault-plan 建議 | 保留 | 文件整合 checkout；勿把 dry-run 建議誤當已套用 |
| `.worktrees/library-ui-cleanup` | `7be4db3` / `codex/library-ui-cleanup` | clean；ignored `dist/` 4 | ancestor；0 unique/cherry rows | 含 `migrate-vault-content-paths.js`、`wiki/sources` 舊測試 | 保留，禁止從此執行 | 可重引舊 Vault migration |
| `.worktrees/restore-platform-vault-routing` | `af7013d` / `codex/restore-platform-vault-routing` | clean；ignored `dist/` 4 | ancestor；0 unique/cherry rows；已是 merge `b5bd090` 第一親 | 現行 platform routing 回復點；仍有歷史 manifest 文檔 | 保留 | 目前 main 的回復來源；刪除前需確認不再需要比對基準 |
| `.worktrees/stable-vault-sources` | `0bea35e` / `codex/stable-vault-sources` | clean；ignored `dist/` 4 | ancestor；0 unique/cherry rows | 含 `migrate-vault-content-paths.js`、`wiki/sources` 舊實作 | 保留，禁止從此執行 | 可重引已撤回 migration |
| `.worktrees/vault-content-finalization` | `6dd66b2` / `codex/vault-content-finalization` | clean；ignored `dist/` 4 | ancestor；0 unique/cherry rows；也是遠端 `origin/HEAD` | 含舊 sources/migration | 保留 | 遠端目前 HEAD 基準；不得視為現行安全入口 |
| `.worktrees/vault-db-manifest` | `7c00739` / `codex/vault-db-manifest` | clean；ignored 0 | ancestor；0 unique/cherry rows | 含 DB-only manifest／migration 舊實作與文件 | 保留，禁止從此執行 | 無 ignored 也不表示可清理；先完成撤回方案的保留政策 |
| `.worktrees/workflow-badges` | `c25c528` / `codex/workflow-badges` | clean；ignored `dist/` 4 | ancestor；0 unique/cherry rows；`b5bd090` 合併第二親 | 含 workflow badge 與舊 sources/migration | 保留 | badge 已整合，但 checkout 含已撤回 Vault 內容 |

其他本機分支（無 worktree）：`_main`、`codex/ui-topic-governance`、`docs/agent-codex-action-vault-v2-20260724` 同樣是 main 祖先、0 unique/cherry rows；建議保留至 owner 確認分支保存政策。stash：`git stash list` 為空。

遠端：`git ls-remote --symref origin HEAD` 於本輪唯讀成功，HEAD 是 `refs/heads/main` 的 `6dd66b2863f2a108cbac3a5d20b3bcd78e727289`。本機 tracking ref 也為該 commit；`git rev-list --left-right --count origin/main...main` 為 `0 16`。未證實部署端 revision。
