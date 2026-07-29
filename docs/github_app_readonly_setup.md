# GitHub App：唯讀 repo 同步設定

這個設定讓產品端以 GitHub App 安裝權限讀取你選擇的 repo。它與 Codex 的 GitHub connector 分開：connector 是開發操作工具；GitHub App 才是產品 runtime 的憑證。

## 最小權限

- Repository metadata：Read-only。
- Contents：Read-only。
- Webhook：停用，第一版採手動同步。

不要要求 Issues、Pull requests、Actions 或任何 Write 權限。

## Windows

1. 在 GitHub App 設定頁按 **Generate a private key**。
2. 將下載的 `.pem` 重新命名為 `github-app-private-key.pem`，放到：
   `G:\media_platform_notion_antigravity\server\keys\github-app-private-key.pem`
3. 在 GitHub App 的 **Install App** 安裝到你的帳號，選擇 **All repositories**。
4. 在 `server/.env` 設定 `GITHUB_APP_ID` 與 `GITHUB_APP_INSTALLATION_ID`。私鑰路徑使用預設 `./keys/github-app-private-key.pem`。

## Mac

1. 在 GitHub App 設定頁按 **Generate a private key**。
2. 將下載的 `.pem` 重新命名為 `github-app-private-key.pem`，放到：
   `/volumes/DevSSD/<project>/server/keys/github-app-private-key.pem`
3. 在 GitHub App 的 **Install App** 安裝到你的帳號，選擇 **All repositories**。
4. 在 `server/.env` 設定 `GITHUB_APP_ID`、`GITHUB_APP_INSTALLATION_ID`，並將 `GITHUB_APP_PRIVATE_KEY_PATH` 改為該 `.pem` 的絕對路徑。

## 安全規則

- 不要把 `.pem`、App private key 或 installation access token 貼到聊天、commit 或前端環境變數。
- GitHub installation token 是短效憑證，產品端執行時產生、記憶體使用後即丟棄；不寫進 Supabase。
- 第一版只讀取 repo 目錄與必要檔案；POC 仍必須另經人工 `--execute-poc` 授權。
