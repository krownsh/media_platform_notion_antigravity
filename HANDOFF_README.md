# media_platform_notion_antigravity 本機交付說明

這份交付來自 `agent/async-capture-pipeline` 工作樹，包含：

- 非同步 URL capture queue（Stage E）
- private Supabase Storage 圖片上傳（Stage F）
- 作者名稱第一個 grapheme 的文字頭像
- Hermes 圖片安全取用與分析結果寫回
- 對應文件與自動測試

交付時的驗證結果：

- `npm run lint`：通過
- `npm run build`：通過
- `node --test test/server/*.test.js test/script/*.test.js`：87/87 通過
- `git diff --check`：通過

## 建議使用方式

### 方法一：使用 Git patch（最安全）

先在你自己的電腦 clone 原專案，確認基準分支與這次開發前一致：

```bash
git clone <你的 GitHub repo URL>
cd media_platform_notion_antigravity
git switch -c agent/async-capture-pipeline
git apply --check ../media_platform_notion_antigravity_async_capture.patch
git apply ../media_platform_notion_antigravity_async_capture.patch
npm install
npm run lint
npm run build
node --test test/server/*.test.js test/script/*.test.js
git add -A
git commit -m "feat: add async image capture and Hermes analysis handoff"
git push -u origin agent/async-capture-pipeline
```

若 `git apply --check` 失敗，先不要強制套用；改用完整 ZIP 與你的 clone 做檔案差異比對。

### 方法二：使用完整專案 ZIP

ZIP 已排除 `.git`、`node_modules`、`dist`、真正的 `.env`、logs 與 coverage。
解壓後可以直接用 VS Code 閱讀。若要推回 GitHub，建議先另行 clone GitHub repo，
再把 ZIP 內容複製進 clone，而不是在 ZIP 目錄重新建立不相干的 Git 歷史。

## 尚未執行

- 沒有修改遠端 Supabase。
- Stage E／Stage F SQL 尚未部署。
- 沒有建立 Git commit、push 或 PR。
- `~/.my-main-agent` 與 Hermes 主機上的正式 Skill／Cron 尚未接線。

因 Supabase 與 vo-stock 共用，請先審查
`database/deployments/stage_e_async_capture_requests.sql` 與
`database/deployments/stage_f_private_image_captures.sql`，再依序部署。
