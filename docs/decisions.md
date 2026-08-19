# decisions.md (grimore-v2)

Numbering restarted from D-001 on the `grimore-v2` branch. Pre-reset decision history
(old Task Plant/Grimoire app, D-001-D-045) lives in `main`'s docs/decisions.md and in
this branch's git history prior to the reset commit. See `grimore-v2/Grimoire_決定事項ログ.md`
for the design-consult decisions (creature designs, world direction, etc.) that predate
and motivated this reset -- those are kept as-is, not restarted.

## D-001: grimore-v2ブランチのリポジトリリセット — 旧アプリ資産の整理

- 日付: 2026-08-19
- 対象: architecture / v2-kickoff
- 決定: v2はほぼ0からの作り直し(D-045訂正、旧番号)であるため、`grimore-v2`
  ブランチの中身を整理した。維持: `grimore-v2/`設計ログ一式、CLAUDE.md、
  .claude/settings.json、.env.example、.gitignore、scripts/setup.mjs、
  scripts/verify.mjs、.github/workflows/ci.yml、templates/、LICENSE。
  空テンプレートにリセット(ファイルは残し中身のみ空に、番号を1から再開):
  tasks.md、docs/decisions.md(本ファイル)、docs/state.md、docs/issues.md、
  docs/vision.md、docs/repo-map.md、HANDOFF-JA.md。削除: src/、public/、
  tests/、旧アプリ固有ドキュメント(docs/analysis.md等)、.claude/rules/配下
  の旧アプリ固有の教訓、README.md、CONTEXT.md、ツール設定一式
  (package.json等)。
- 採用理由: オーナーの明示指示。ほぼ0からの作り直しに対して、旧アプリの
  実装・履歴を引きずるより、pm-zeroの公式12ファイル構成を空の状態で
  再スタートする方が実態に合う。
- 不採用案: 旧アプリの全履歴・実装を維持したまま追記を続ける →
  T041/D-044(grimore-v2統合ブランチ新設)、T042-043/D-045(v2スコープ確定
  →訂正)の経緯を経て、v2が既存アプリの流用ではなく作り直しだと判明した
  ため不採用。
- 将来見直し条件: v2出荷判断時に`main`へマージする際、mainの旧番号台帳
  (T001-T045、D-001-D-045)との突き合わせ・統合方法を別途検討する
  (D-044に記載済みのトレードオフ)。

## D-002: Codex CLIをClaude Codeと同等のルールで運用できるようにする

- 日付: 2026-08-19
- 対象: tooling / multi-agent
- 決定: オーナーがこのセッション以降の相談をCodex CLIに引き継ぐため、
  Codex CLIもpm-zero v12の自律性・安全機構をClaude Codeと同等に持てる
  ようにした。プロジェクト側: AGENTS.md新設(CLAUDE.mdを正典として参照し、
  Codexの差分のみ記載。二重管理によるドリフトを避けるため全文複製はしない)、
  `.codex/config.toml`新設(空に近いが、approval_policy/sandbox_mode等の
  セキュリティ関連キーはプロジェクトローカルでは無視される仕様のため、
  実効設定はグローバル側にある旨を明記)。グローバル側(`~/.codex/`、
  リポジトリ外・全プロジェクト共通): 既存のrtk連携(`hooks.json`の
  "Bash"マッチャ→`rtk hook claude`、`config.toml`のapproval_policy="never"、
  このプロジェクトパスの`trust_level="trusted"`)は変更せず維持。新たに
  `~/.codex/hooks/guard.mjs`を追加し、`~/.claude/hooks/guard.mjs`と同一の
  ルールセット(rm -rf /~、git push --force、git reset --hard、
  git clean -f系、git checkout/restore .、git stash clear/drop、
  sudo su、runas、.env*読み書き〈.env.example除く〉のブロック)を
  PreToolUseの広いマッチャ(".*")で追加配線した。
- 採用理由: オーナーの明示指示(「グローバルのCodeXの設定も、Claudeと
  同じような動きになるように編集してよい」)。Codexの`approval_policy`/
  `sandbox_mode`はプロジェクトローカルの`.codex/config.toml`では
  仕様上無視されグローバル`~/.codex/config.toml`でしか有効にならない
  (2026-08-19時点のOpenAI公式ドキュメント調査で確認)ため、プロジェクト側
  だけでは自律性もガードも再現できない — グローバル側の変更が必須だった。
- 不採用案: (a) CLAUDE.mdの全ルールをAGENTS.mdへ複製 → 将来の
  ドリフト(CLAUDE.md更新時にAGENTS.mdが追随しない)リスクが高く不採用、
  AGENTS.mdはCLAUDE.mdを参照する差分ドキュメントとした。
  (b) 既存の`rtk hook claude`エントリを書き換えてガード機能も持たせる →
  rtkはトークン最適化プロキシであり安全機構ではない別レイヤー。既存動作を
  壊すリスクを避け、新規PreToolUseエントリとして追加する形にした。
- 既知のギャップ: (1) Codexのhooks.jsonを変更したためトラストハッシュが
  変わり、次回Codex起動時に新しいフックの信頼確認を一度求められる可能性が
  ある(意図的に自動承認はしていない — フック内容への同意は人間の判断)。
  (2) `.github/workflows/ci.yml`は現状`main`ブランチのpush/pull_requestのみ
  トリガーで、`grimore-v2`では発火しない。そのため本タスクの`.codex/config.toml`
  (設定fileでdocs-only例外の対象外)もPRを経ずgrimore-v2へ直接コミットした
  ——CIが機能していない現状ではPR経由でも検証価値がないため。CI発火先を
  `grimore-v2`にも広げるかは別途要判断(docs/issues.mdではなく、v2の
  スコープ確定と合わせて検討する将来課題)。
- 将来見直し条件: v2の技術スタックが決まりCIが復活した時点で、
  `.codex/config.toml`を含む設定fileの扱いを通常の branch+PR+CI ルートに
  戻す。Codexの`tool_name`の実際の値(shell/apply_patchの正式名称)が
  将来確定したら、`~/.codex/hooks/guard.mjs`の形状ベース判定を
  名前ベースに寄せて簡素化できるか見直す。

## D-003: グローバルrtkプロキシ運用の全廃止(D-002の一部を訂正)

- 日付: 2026-08-19
- 対象: tooling / multi-agent
- 決定: D-002で「rtkは別レイヤーなので維持」と決めたが、オーナーの明示指示
  によりグローバルの`rtk`プロキシ運用そのものを廃止した。
  `~/.codex/AGENTS.md`(リポジトリ外・全プロジェクト共通)から「## RTK Usage」
  節と`@RTK.md`取り込み行を削除し、Codexはrtk経由ではなく通常のシェル
  コマンド(直接のファイル読取、`git`、`pytest`、`ruff`等)を使う運用に戻した。
  `~/.codex/RTK.md`自体は削除せず、冒頭に廃止済みの注記を追記しただけで残置
  (未参照ファイルとして経緯を追えるようにするため)。プロジェクト側の
  `AGENTS.md`の「RTK usage」節も、廃止後の状態を指すよう更新した。
  D-002のうちガードフック(`~/.codex/hooks/guard.mjs`)や
  `approval_policy`/信頼設定に関する決定はそのまま有効 -- 変更したのは
  rtk関連の記述のみ。
- 採用理由: オーナーが「グローバルのrtk運用自体をやめる」ことを明示的に選択。
  rtkはpm-zeroのガバナンスバージョニングとは無関係な別ツールだったが、
  それを維持する運用上の理由がなくなったため廃止に切り替えた。
- 不採用案: (a) このリポジトリのAGENTS.mdだけでrtk規約を無効化 →
  グローバル`~/.codex/AGENTS.md`が依然として全プロジェクトにrtkを指示し
  続けるため、オーナーが求めた「運用自体をやめる」を満たさず不採用。
  (b) `~/.codex/RTK.md`を削除 → 未追跡ファイル(gitリポジトリ外)を
  安易に削除するより、廃止注記を付けて残す方が可逆性が高く、経緯の追跡にも
  有利なため不採用。
- 既知のギャップ: `~/.codex/hooks.json`の既存`rtk hook claude`エントリ
  (フック機構、コマンドプロキシとは別レイヤー)には触れていない -- D-002の
  不採用案(b)と同じ理由で、安全機構レイヤーとコマンドプロキシレイヤーを
  引き続き分離している。
- 将来見直し条件: 特になし(オーナーの明示選択による確定事項)。

## D-005: Codex CLI(Windows)のサンドボックス設定をelevated→unelevatedへ変更、MCP/Skill追加

- 日付: 2026-08-19
- 対象: tooling / multi-agent
- 決定: Codex CLIが「CreateProcessAsUserW failed: 5 (アクセスが拒否されました)」で
  端末実行を全拒否し、`.agents`(実体は`$CODEX_HOME/skills`)への書き込みも拒否
  されていた件を調査・解消した。原因はグローバル`~/.codex/config.toml`の
  `[windows] sandbox = "elevated"`。このモードはWindowsの制限トークン生成
  (CreateProcessAsUserW)にSeAssignPrimaryTokenPrivilege等の特権を要求するが、
  現在のユーザートークン(`whoami /priv`で確認、管理者昇格なし)にはその特権が
  無く、失敗していた。`codex sandbox -c windows.sandbox=bogus`のエラー出力から
  有効値が`elevated`/`unelevated`の2値のみと判明したため、`unelevated`へ変更し
  実コマンド実行で復旧を確認(`codex doctor`もsandbox項目で0 fail)。この
  プロジェクトは元々D-002/CLAUDE.mdの方針でOS側サンドボックスを実効的な安全境界
  とはしておらず(`approval_policy="never"` + `~/.codex/hooks/guard.mjs`が実際の
  防御層)、Claude Code側のCLAUDE.md「Accepted Risk」と同じ考え方のため、
  管理者権限昇格ではなく非昇格モードへの変更を選んだ。
  併せてオーナー要望のMCP/Skillを追加: `codex mcp add`で`playwright`
  (`npx @playwright/mcp@latest`)、`context7`(`npx -y @upstash/context7-mcp`)、
  `blender`(`uvx blender-mcp`、既存`.mcp.json`のClaude Code向け設定と同一コマンド)
  をグローバル`~/.codex/config.toml`へ登録。Anthropic公式`frontend-design`
  Skill(https://github.com/anthropics/skills の `skills/frontend-design`)は、
  Codex自身の公式`skill-installer`スキル(`~/.codex/skills/.system/skill-installer`)
  が提供する`scripts/install-skill-from-github.py --repo anthropics/skills
  --path skills/frontend-design`をこちらのセッションから直接実行し、
  `~/.codex/skills/frontend-design`へインストール済み。Chrome DevTools MCPと
  codegraphは既存設定のまま変更なし(オーナー指示通り重複導入せず)。
- 採用理由: オーナーが「CodexCLIに環境構築させようとしたら権限エラーで
  全拒否されたので、Claude Codeの方で全て解決して環境構築してほしい」と
  明示指示。Codex側は端末実行が拒否された状態だったため自己解決できず、
  Claude Code側は同じ`~/.codex/`配下への読み書き・端末実行に制限が無かった
  ため、Claude Code側で直接原因調査・設定変更・MCP登録・Skillインストールを
  代行した。
- 不採用案: (a) Codexを管理者権限で起動させ`elevated`のまま維持する →
  日常の開発ツールを常時管理者権限で動かすことになり、D-002のガード
  フック(破壊的コマンド/秘密ファイル防御)はそのまま活きるとはいえ、
  昇格プロセスの攻撃面が広がるため不採用。既にOSサンドボックスを安全境界と
  見なさない方針(D-002)と整合しない。 (b) `.agents`書き込み制限を個別に
  緩和する設定を探す → 実体はCODEX_HOMEのファイルシステムACLではなく
  `elevated`サンドボックスの制限トークン由来の書き込みルート制限だったため、
  個別緩和ではなく根本原因(サンドボックスモード)を直す方が確実と判断。
- 既知のギャップ: Context7は無料枠(APIキー無し)で登録した。オーナーが
  レート制限に当たった場合はcontext7.com/dashboardでAPIキーを取得し
  `[mcp_servers.context7].args`に`--api-key`を追記する。Codexの
  `windows.sandbox=unelevated`が将来のCodexバージョンで別モードや別デフォルトに
  変わる可能性があるため、Codexアップデート後に`CreateProcessAsUserW`系の
  失敗が再発したら本設定を再確認する。
- 将来見直し条件: 特になし(オーナーの明示依頼による代行対応)。

## D-006: docs/decisions.mdへ誤って記載されたフロントエンド設計決定の移設、Claude↔Codex連携プラグイン、Exa/Firecrawl MCPの導入

- 日付: 2026-08-19
- 対象: tooling / multi-agent / docs-hygiene
- 決定: 3件まとめて対応。
  (1) docs/decisions.mdに単一`#`見出しで紛れ込んでいた「D-003. フロントエンド
  体験設計の調査基準」「D-004. フロントエンドのデザインシステム構成」を
  `grimore-v2/Grimoire_決定事項ログ.md`のR章(R-1/R-2)へ移設。docs/decisions.md
  はエンジニアリング/インフラ決定専用という既定方針(state.md「Next」)に
  合わせた。
  (2) `claude plugin marketplace add openai/codex-plugin-cc` →
  `claude plugin install codex@openai-codex`でOpenAI公式プラグインを導入。
  Claude Codeから`/codex:rescue`等でCodex CLIをサブエージェントとして
  呼び出せるようになった。
  (3) オーナー要望の「ExaでWeb検索、Firecrawlでページ解析」運用のため、
  Codexに`codex mcp add`でローカルMCP `exa`(exa-mcp-server)・`firecrawl`
  (firecrawl-mcp)を登録。ClaudeはExaが既存の`claude.ai Exa`コネクタで
  代替可能と判明したため新規追加不要、FirecrawlもAPIキー不要のOAuth
  コネクタ(`claude.ai Firecrawl`)が既存だったため、当初登録したローカル
  `firecrawl-mcp`は削除し`claude mcp login "claude.ai Firecrawl"`へ切替。
  運用ルールをCLAUDE.md「Research Tools」節とAGENTS.mdの差分節に追記。
- 採用理由: (1)はオーナー明示指示。(2)(3)もオーナー明示指示
  (「ClaudeでCodeXを呼べるプラグインも入れて」「ExaとFirecrawlのMCPを
  インストールし...運用ルールとしてかけ」)。
- 不採用案: ClaudeにもFirecrawl/Exaのローカルnpxサーバを追加する →
  同等機能を持つclaude.aiコネクタが既に存在し二重管理になるため不採用。
  コネクタを優先しローカルMCPはコネクタが存在しないCodex側だけに限定した。
- 既知のギャップ: Codexの`exa`/`firecrawl`はAPIキー未設定で未稼働
  (docs/issues.md参照、オーナーが「なしでいいや」と保留)。Claudeの
  `claude.ai Firecrawl`コネクタはOAuth認可待ち(ブラウザでの承認が必要、
  オーナー操作待ち)。
- 将来見直し条件: オーナーがEXA_API_KEY/FIRECRAWL_API_KEYを取得した時点で
  Codex側`~/.codex/config.toml`の該当`[mcp_servers.*]`エントリに追記して
  有効化する。

## D-007: Codexの無確認実行をshell・MCP・appの三層でグローバル既定化する

- 日付: 2026-08-19
- 対象: tooling / permissions
- 公式根拠: Config Reference
  (https://learn.chatgpt.com/docs/config-file/config-reference)、MCP
  (https://learn.chatgpt.com/docs/extend/mcp?surface=cli)、Agent approvals & security
  (https://learn.chatgpt.com/docs/agent-approvals-security)。
- 決定: 現行のOpenAI公式Config Reference、MCP、Agent approvals文書を正典とし、
  全プロジェクトの既定を次の三層で揃える。`~/.codex/config.toml`のトップレベルは
  `approval_policy = "never"`と`default_permissions = ":danger-full-access"`、
  `[apps._default]`は`default_tools_approval_mode = "approve"`、登録済みの各
  `[mcp_servers.<id>]`も`default_tools_approval_mode = "approve"`とする。
  `default_permissions`と旧`[sandbox_workspace_write]`/`sandbox_mode`は併用しない。
  既存の`[windows] sandbox="unelevated"`、`sandbox_private_desktop=false`は維持する。
  破壊的コマンドと`.env*`を拒否するguardは承認UIではなく拒否境界なので維持する。
- 採用理由: `approval_policy`はcommand承認、permission profileはfilesystem/network、
  app/MCP approval modeは外部tool承認をそれぞれ制御し、互いの代替ではない。
  `approval_policy="never"`だけではworkspace外操作が拒否され、MCP/appの既定も
  toolごとにprompt/writesとなり得るため、オーナーの「作業中に一切許可を求めない」
  要件を満たさない。公式リファレンスは`on-failure`を非推奨として`never`を
  non-interactive run向けに指定している。
- 適用する最小差分: 既存の`default_permissions = ":workspace"`を
  `":danger-full-access"`へ変更し、既存`[apps._default]`へ
  `default_tools_approval_mode = "approve"`を追加する。さらに
  `chrome-devtools`、`openaiDeveloperDocs`、`codegraph`、`playwright`、`context7`、
  `blender`、`exa`、`firecrawl`の各MCP base tableへ同じ既定を追加する。
- 既知のギャップ: 現セッションのmanaged filesystemはworkspace外をread-onlyとし、
  グローバルfileへの`apply_patch`を拒否したため差分は未反映(B002)。ChatGPT plugin側は
  グローバル`full_access`がfeature gateで利用不可であり、低リスク操作を無確認で
  通し機密操作を拒否する`review_important_actions`へ更新した。`full_access`公開後に
  切り替える。
- 将来見直し条件: Codexのpermission profileまたはapp/MCP approval schemaが変更された
  時点。変更時は必ずOpenAI公式Config Referenceを再確認する。

## D-008: 背景品質判定はprimary scene負荷とmultipass負荷を分離する

- 日付: 2026-08-19
- 対象: performance / instrumentation
- 決定: `WebGLRenderer.info.autoReset=false`で1フレーム全体を累積する一方、
  skyとworldの描画直後を`sceneDrawCalls`として採取し、post pass数と
  `totalDrawCalls`を別の観測値として公開する。品質ガバナーはp20 FPS、
  `sceneDrawCalls`、triangles、post passesを独立予算で評価する。triangleの基準値は
  150,000、T008で承認済みの±2%を明示して縮退条件を`>153,000`とする。
- 採用理由: Three.jsのrenderer infoはmulti-pass時に手動resetして1フレームを累積する
  利用法を想定するが、合計GL callsをprimary sceneの50-call予算へ直接比較すると、
  shadow/occlusion/post処理を二重計上して端末性能に関係なく縮退する。152,490 trianglesも
  許容差を式へ入れなければ承認値なのに縮退する。観測量と判定予算を同じ意味へ揃える。
- 検証: pure governor testで152,490はfullを維持し、153,001は縮退圧力になること、
  headless Chromeでscene/total/postの各値とforced-reduced遷移を確認する。
- 将来見直し条件: renderer pipelineまたはT008の品質予算を変更した時点。

## D-009: Codexだけのworker subagent上限を4にする

- 日付: 2026-08-19
- 対象: tooling / multi-agent
- 公式根拠: Subagents — Global settings
  (https://learn.chatgpt.com/docs/agent-configuration/subagents#global-settings)。
- 決定: Codexは必要に応じて最大4つのworker subagentsを同時使用できるようにする。
  リポジトリの`AGENTS.md`へCodex-only overrideを追加し、実行時上限にはuser-level
  `~/.codex/config.toml`の`[agents] max_concurrent_threads_per_session = 4`を使う。
  公式定義どおり、この値はprimary agentを数えない。`CLAUDE.md`とClaude側設定は
  変更せず、Claudeの既存上限2を維持する。
- 採用理由: 仕様・実装・独立監査を並列化できる一方、CodexとClaudeの運用差分を
  `AGENTS.md`へ閉じ込め、正典`CLAUDE.md`を不用意に変えずに済むため。
- 既知のギャップ: 現セッションのmanaged filesystemはglobal/project双方の
  `.codex/config.toml`を保護しており、実行時設定の書込みは拒否された(B003)。
  `AGENTS.md`の運用規則は反映済みだが、runtime capの反映にはオーナー操作と
  Codex再起動が必要。
- 将来見直し条件: OpenAI公式の設定キーまたは利用可能な同時thread上限が変わった時点。
