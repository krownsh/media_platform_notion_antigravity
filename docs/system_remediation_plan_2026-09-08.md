# 系統盤點後修正計畫

狀態：待 Owner 確認。此文件只規劃，尚未修程式、撤銷金鑰、清理、提交、合併、push 或部署。

## 盤點結論與覆核

- Terra 已交付 system_audit_report_2026-09-08.md 與 worktree_disposition_2026-09-08.md。11 個 worktrees 的分支皆已納入 main 歷史，沒有已發現的獨有未合併 commit；不代表 ignored/untracked 產物已保存。
- main 基準為 223fe39；Terra 查得遠端 main 為 6dd66b2，本機領先 16 commits。部署版本仍未知。
- 覆核確認：Git 追蹤 server/archive/legacy-config/temp_env.txt 且含非空 MiniMax key 設定。不得在報告輸出金鑰。有效性、使用紀錄及是否遭濫用未確認，應以已暴露憑證處理；P0 是處置優先度，不是已證實正在遭攻擊。
- 覆核確認：vaultNoteService.js 每次以標題與日期重算路徑，vault-sync-workflow.js 將結果存回 context；標題或日期變更可造成第二份筆記。實際遠端影響量未知。
- 校正 Terra 的 MiniMax 結論：Owner 在本次對話已明確宣告 MiniMax 廢棄；現行 runtime 仍依賴它是決策落實缺口，並非缺少退役決策。替代 provider/執行機制尚需查既有部署；Codex Luna 回補不等於可供 server 呼叫的模型服務。
- 校正 worktree 描述：632d919 與 6dd66b2 的 writer 使用 Collection/inbox 目錄，不是 wiki/sources。文件字串命中不等於有效 runtime。修正矩陣時逐一讀取 writer 與 CLI，不依 rg 命中推定。
- 六個安全測試與 lint 通過不等於全系統驗收。Live DB/RLS、部署、瀏覽器 UI、完整重試與併發補償尚未完整確認。

## 分批修正

### 第一批：憑證處置與紀錄準確性

1. 經確認後先於供應商撤銷暴露金鑰（由具備帳號權限者執行）。MiniMax 已退役，不預設建立新金鑰。
2. 移除當前追蹤檔中的秘密，改無值範本；對追蹤檔、歷史與舊 worktrees 做不回顯值的秘密掃描。加入精準忽略規則，保留合法範本。
3. Git 歷史重寫列為獨立後續：提出受影響 refs、協作者重新同步方式與回復方案後另行確認，不能在本批 force push。
4. 校正上述報告與 worktree 矩陣；依 commit 更新 tasks.md 為「本機已實作／已合併；未推送／部署未確認」，保留任務原文並附證據。

驗收：新版本不含秘密；掃描輸出不洩漏值；撤銷成功與歷史清除各自記錄狀態，不能以刪檔宣稱憑證已失效。

### 第二批：Vault 重試與撤回計畫殘留

1. 新筆記維持 platform 路徑；同一 workflow 已有成功 relative_path 時，優先沿用。核對 context.vault、context.vault_sync、vault_note outcome，衝突時明確報錯，不任選一路徑。
2. 驗證路徑在 Vault 內（含符號連結越界）、post 身分與 managed block 所有權；共用 entity/manual note 不因 DB 指向它就覆寫。既有路徑缺檔或不可讀時回報具體錯誤，不默默改另一個位置。
3. 檢查草稿是否也有相同重試問題，僅在既有草稿識別可驗證時沿用；不引入新分類或搬移規則。
4. auto-container planner 停止產生 Vault 搬移目標／建議；保留 Collection/Topic 唯讀盤點。先查 CSV 下游讀取者，再移除 Vault 輸出或保留明確 disabled 的相容輸出。
5. 隔離 fixture 覆蓋：標題／日期改變、既有 platform/Collection/sources 路徑、缺檔、衝突、人工內容、越界、寫檔後 DB 失敗重試。只用測試目錄與 mock DB。

驗收：同一來源重試不另建筆記、不覆寫其他來源或人工筆記；分類移動不改路徑；沒有重新開啟搬遷。遠端 Vault 保持原狀，不要求提供本機路徑。

### 第三批：MiniMax 退役與文件契約

1. 追查分析、分類、改寫、POC 生成及 UI 模型選項的全部活躍呼叫者，確認既有可用替代機制與設定名稱（不輸出密鑰）。
2. 已有可驗證替代機制則提出逐入口對應；沒有則保留擷取與待分析狀態，明確顯示 provider 不可用，不把空結果標完成。替代模型與可能費用另交 Owner 確認，不擅自接入付費服務。
3. 以目前 crawler-only 實作與既有決策修正文檔；AGENTS.md 只 append 覆蓋舊角色說明，不刪原文。不要為符合舊文件重啟 API-first。

驗收：MiniMax 不再作活躍呼叫或可選 UI provider；無模型時可見且可恢復；原始擷取資料與 AI 標題保護不變。

### 第四批：保存、worktree 與正式版本補證

1. 盤點報告與修正紀錄提交至指定隔離分支；不一併提交 env、cache 或 manifest 私人內容。
2. agent-dev 的 5 個未追蹤 artifacts 先建立檔案清單、雜湊、用途及安全保存位置，記明舊 manifest 不可套用；其他 ignored 產物按唯一性分類。
3. 所有已整合 worktrees 先保留；清理需先確認無使用中的任務、無獨有未保存資料，再交 Owner 核定確切清單。不要把「分支已合併」當成可刪檔依據。
4. 從既有設定與可用 connector 核實 Supabase project 身分，只做 schema/RLS/status 的最小唯讀補證。無法存取則列未確認，不索取遠端 Vault 路徑。
5. 前端、server、Hermes/排程分別核對部署 revision；待修正完成再列待推送 commits，push/部署作獨立決定。

驗收：每個獨有產物有保存或待確認狀態；本機、遠端與執行版本分別可追溯。未確認项不得列正常。

## 建議核准範圍

先核准第一、二批的本機修正與隔離測試，以及第三、四批的唯讀補證。金鑰撤銷需供應商權限；歷史重寫、付費模型接線、實體清理、正式資料修復、push 和部署不包含在本次建議核准範圍。
