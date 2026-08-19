# issues.md

## Error Log
- 2026-08-19: Codex CLI用のローカルMCP `exa`(exa-mcp-server)と`firecrawl`
  (firecrawl-mcp)は`~/.codex/config.toml`に登録済みだが、`EXA_API_KEY`/
  `FIRECRAWL_API_KEY`が未設定のため未稼働。オーナー確認: 「なしでいいや」
  (今は取得しない)。取得後は各`[mcp_servers.*]`エントリに`--env
  KEY=value`または`env`テーブルで追記すれば有効化できる(取得先:
  dashboard.exa.ai/api-keys、firecrawl.dev/app/api-keys)。ClaudeのExaは
  `claude.ai Exa`コネクタ、FirecrawlはOAuth接続(`claude mcp login
  "claude.ai Firecrawl"`実行済み、オーナーのブラウザ承認待ち)でAPIキー不要。

## Escalation
（なし）
