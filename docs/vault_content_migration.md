# Vault 舊路徑遷移

新寫入已使用 `wiki/collections/<Collection>/` 或 `wiki/inbox/`。本工具只處理既有
`wiki/domains/` 筆記；它先產生 manifest，再逐筆驗證檔案 hash 與 workflow 的
`updated_at`。套用時先複製、更新同一筆 workflow 的三個可能路徑紀錄，成功後才移除舊檔。
衝突、手動異動或缺檔會保留原狀並回報 failed，不覆寫。

在 Mac 的真實 Vault 執行：

```bash
cd "$MEDIA_PLATFORM_PROJECT_ROOT"
npm run vault:migrate-content-paths -- \
  --vault "$HERMES_CLAUDE_OBSIDIAN_PATH" \
  --user-id "50984520-69ad-4e64-b9c1-503f5c1b0e63" \
  --env-file server/.env \
  --output /Volumes/DevSSD/hermes/vault-migration-2026-09-07
```

檢查輸出的 `vault-content-migration-plan.json` 後，才套用：

```bash
npm run vault:migrate-content-paths -- \
  --vault "$HERMES_CLAUDE_OBSIDIAN_PATH" \
  --env-file server/.env \
  --manifest /Volumes/DevSSD/hermes/vault-migration-2026-09-07/vault-content-migration-plan.json \
  --apply
```

不可在沒有真實 Vault 的 Windows checkout 執行；它不會替你建立或猜測 Vault。
