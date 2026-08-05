# Claude-Obsidian note input

`agent:vault-note` accepts one JSON object through `--file`. The agent chooses
Traditional-Chinese names when the user has not supplied them.

```json
{
  "domain": "個人品牌",
  "note_title": "Wallpets 深度研究與複製規劃",
  "summary": "我們確認過的來源重點與判斷",
  "original_content": "可省略；省略時由 CLI 從資料庫貼文讀取完整內容",
  "discussion": "與使用者討論過的問題、取捨與決策",
  "research": "研究結果與仍待驗證的假設",
  "poc": "POC 提案或執行結果；未執行時明確寫明",
  "decision": "保留、研究、復刻或暫不處理的決定",
  "next_step": "下一步與負責的 agent",
  "tags": ["個人品牌"],
  "topics": ["內容產品"],
  "replication": {
    "enabled": true,
    "project_name": "Wallpets 復刻項目",
    "goal": "要解決的問題與引流目標",
    "mechanism": "核心機制與差異化",
    "mvp": "最小可行版本",
    "funnel": "引流、轉換與變現假設",
    "risks": "IP、TOS、成本與技術風險",
    "acceptance_criteria": ["可驗證的條件"],
    "evidence": "研究／POC 證據",
    "next_architecture_steps": "交給下一位架構 agent 的工作"
  }
}
```

The source note is written to:

```text
<Vault>/wiki/domains/<domain>/<note_title>.md
```

When `replication_plan` is approved, the isolated handoff is written to:

```text
<Vault>/domain/<domain>/<replication.project_name>/復刻規劃.md
```

Both files include the database `collection_posts.id`, workflow ID, and source
URL. A managed block is replaced idempotently on retry; text outside the block
is preserved. The write uses a temporary file plus rename, so a partial note is
never presented as successful.
