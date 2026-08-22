# issues.md

## Error Log
- 2026-08-19: production PWAのoffline reloadはChromiumでconsole error/request failure 0まで
  検証済み。Playwright WebKit 1.58.2 on Windowsは`context.setOffline(true)`後の`page.reload()`で
  browser内部エラーになるため、その1 caseのみ明示skip。通常のWebKit mobile flow 2件は合格。
  Safari/iOSのoffline reloadは物理端末またはmacOS WebKitで再検証が必要。
- 2026-08-19: T010でCodexだけのworker subagent上限を4へ変更しようとしたが、
  managed filesystemがglobal `~/.codex/config.toml`とproject `.codex/config.toml`の
  両方への`apply_patch`を拒否した。Codex専用の運用差分は`AGENTS.md`へ反映済み。
  実行時上限には公式の`[agents] max_concurrent_threads_per_session = 4`をglobalへ
  追加して再起動する必要がある。`CLAUDE.md`およびClaude設定は変更しない。
- 2026-08-19: T009でCodexの無確認実行を現行公式構文へ統一しようとしたが、
  managed filesystemが`~/.codex/config.toml`をread-onlyとしており、
  `apply_patch`はworkspace外書込として拒否された。現状は
  `approval_policy="never"`のみ設定済みで、`default_permissions`は
  `":workspace"`、apps/MCPの全体既定`default_tools_approval_mode`は未設定。
  ChatGPT pluginのグローバル権限は`full_access`がfeature gateで利用不可のため、
  許可要求を出さず低リスク操作を自動承認する`review_important_actions`まで反映。
  完全な無確認実行にはD-007のグローバル差分と再起動が必要。
- 2026-08-19: T004で`windows.sandbox="unelevated"`へ変更後も、Codex Appが
  既定選択するMicrosoft Store版PowerShell 7 (`WindowsApps/.../pwsh.exe`)は
  private desktop上で`CreateProcessAsUserW`に失敗する。戻り値
  `-1073283067`はHRESULT `0xC0070005`、基底のWin32エラーは5
  (ERROR_ACCESS_DENIED)。sandboxログでは明示指定のWindows PowerShellは起動
  できる一方、Store版`pwsh.exe`だけが失敗している。オーナーが公式互換設定
  `[windows] sandbox_private_desktop=false`をグローバル設定へ追加して完全再起動
  した後も同じため、設定未反映ではなくStore版`WindowsApps`起動経路の問題として
  T006を継続する。T007はBlender MCP経由のローカルプロセス実行で回避中。
## Escalation
- T010: `~/.codex/config.toml`へ`[agents]`と
  `max_concurrent_threads_per_session = 4`を追加してCodexを再起動する。
  Claudeの設定・`CLAUDE.md`は変更しない。
- T009: `~/.codex/config.toml`へD-007記載の最小差分を反映してCodexを再起動する。
  既存の破壊的コマンドguardは承認ではなく拒否として維持する。
- T006: 非Store版PowerShellを導入してCodexの既定シェルを切り替えるか、WSL実行へ
  移行する。`sandbox="unelevated"`と`sandbox_private_desktop=false`の再設定は不要。
- budget wall hit; session ended by rate limit
- budget wall hit; session ended by rate limit
- budget wall hit; session ended by rate limit
- budget wall hit; session ended by rate limit
- budget wall hit; session ended by rate limit
- budget wall hit; session ended by rate limit
- budget wall hit; session ended by rate limit
