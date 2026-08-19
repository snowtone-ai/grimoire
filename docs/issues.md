# issues.md

## Error Log
- 2026-08-19: T004で`windows.sandbox="unelevated"`へ変更後も、Codex Appが
  既定選択するMicrosoft Store版PowerShell 7 (`WindowsApps/.../pwsh.exe`)は
  private desktop上で`CreateProcessAsUserW`に失敗する。戻り値
  `-1073283067`はHRESULT `0xC0070005`、基底のWin32エラーは5
  (ERROR_ACCESS_DENIED)。sandboxログでは明示指定のWindows PowerShellは起動
  できる一方、Store版`pwsh.exe`だけが失敗している。オーナーが公式互換設定
  `[windows] sandbox_private_desktop=false`をグローバル設定へ追加して完全再起動
  した後も同じため、設定未反映ではなくStore版`WindowsApps`起動経路の問題として
  T006を継続する。T007はBlender MCP経由のローカルプロセス実行で回避中。
- 2026-08-19: Codex CLI用のローカルMCP `exa`(exa-mcp-server)と`firecrawl`
  (firecrawl-mcp)は`~/.codex/config.toml`に登録済みだが、`EXA_API_KEY`/
  `FIRECRAWL_API_KEY`が未設定のため未稼働。オーナー確認: 「なしでいいや」
  (今は取得しない)。取得後は各`[mcp_servers.*]`エントリに`--env
  KEY=value`または`env`テーブルで追記すれば有効化できる(取得先:
  dashboard.exa.ai/api-keys、firecrawl.dev/app/api-keys)。ClaudeのExaは
  `claude.ai Exa`コネクタ、FirecrawlはOAuth接続(`claude mcp login
  "claude.ai Firecrawl"`実行済み、オーナーのブラウザ承認待ち)でAPIキー不要。

## Escalation
- T006: 非Store版PowerShellを導入してCodexの既定シェルを切り替えるか、WSL実行へ
  移行する。`sandbox="unelevated"`と`sandbox_private_desktop=false`の再設定は不要。
