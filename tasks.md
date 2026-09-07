# Obsidian 維持原狀：回復計畫

狀態：待執行。此文件取代根目錄既有任務清單；目前尚未修改程式、資料庫、Vault、部署或排程。

## 已確認決策

- 暫停所有 Obsidian Vault 重新分類、固定來源路徑、Collection 索引與舊檔搬移計畫。
- 不再要求提供遠端 Vault 根目錄；不掃描、不移動、不刪除、不重命名任何實體筆記。
- 保留資料庫既有 workflow `relative_path`，不執行已產生的 DB-only manifest，不更新遠端路徑。
- Vault writer 回復至內容分類調整前的行為：來源筆記仍依既有 platform 路徑寫入，不由 Collection／Topic／AI domain／Project 分類驅動。
- 前端 Collection 仍是內容分類資料夾；貼文移動或 Collection 改名只影響資料庫與前端，不應觸發 Vault 搬檔。
- 復刻方案的前端 badge／詳細頁呈現保留；方案仍放在同一篇來源筆記，不自動建立正式 Project。

## 系統影響判定

- 不影響已部署的 Collection／Topic 防自動建立治理、Stage P RLS、Stage Q、Stage S 與 AI 標題回補。
- 不回復貼文現有 Collection 歸屬，也不重新啟用自動建立 Collection／Topic／Project。
- 回復範圍只限 Vault projection：路徑生成、Collection 索引、內容草稿路徑、Vault migration／DB-only manifest 與相關文件測試。
- 真實 Vault 從未被本輪操作修改，因此不需要實體檔案 rollback。
- 遠端 DB path 從未被本輪 manifest 更新，因此不需要資料庫 rollback。
- 尚未 push／部署的本機程式需要回復；完成前不得把目前 `wiki/sources/<post-id>.md` 版本部署到 Hermes／Mac。

## 執行任務

- [ ] 建立隔離 worktree，確認沒有與其他 session 的修改重疊。
- [ ] 以內容分類改動前的 writer contract 為基準，恢復 `wiki/threads/<platform>/<日期>-<標題>--<post-id前8碼>.md`。
- [ ] 移除 `wiki/collections/<collection-id>.md`、`wiki/inbox.md` 自動索引寫入，以及 Collection 改名／移動時的 Vault index 更新。
- [ ] 恢復原本內容草稿路徑規則；不搬現有草稿。
- [ ] 停用並移除這次新增的 Vault 舊路徑 migration／DB-only manifest 執行入口，保留既有 DB 與檔案原狀。
- [ ] 保留 `replication_plan` 的前端 badge、詳細頁資訊，以及 workflow JSON 的 goal／MVP／acceptance criteria。
- [ ] 更新 Vault writer、workflow、skill、migration 文件，明確標示「Collection 分類不驅動 Vault 路徑」。
- [ ] 更新測試，鎖住 platform 路徑、無 Collection index、無自動搬檔，以及復刻方案前端仍存在。
- [ ] 執行相關 Node tests、`npm run lint`、`npm run build`；不跑 Docker。
- [ ] 完成後只提交隔離分支；未經明確指示不 push、不部署、不操作真實 Vault。

## 驗收條件

- 新來源筆記路徑只受既有 platform 規則控制，不受 Collection 改名或貼文移動影響。
- 工作流仍可在 DB／前端保存 Collection、Topic、建議分類與復刻方案，但這些欄位不造成 Vault 目錄變更。
- 沒有任何 Supabase workflow path、Vault 實體檔案、PM2／Hermes 設定或排程被修改。
- 前端復刻方案呈現、Collection／Topic 治理、RLS 與 AI 標題功能維持正常。
