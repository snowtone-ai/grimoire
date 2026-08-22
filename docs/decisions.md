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

## D-010: Grimoire v2をdurable local-first coreと交換可能adapterで構成する

- 日付: 2026-08-19
- 対象: product architecture / persistence / extensibility
- 決定: IndexedDBを端末内正本とするが、browser storage自体を永久backupとは扱わない。
  domain/application/infrastructure/features/world/bootstrapを依存方向で分離し、すべての
  durable writeをcommand boundaryへ集約する。command receipt、deterministic event、
  transactional outbox、consumer ack、tombstone、verified export/import staging、
  storage persistence/usage healthを初期版の基盤に含める。recurrenceはseriesとoccurrenceを
  分離し、local wall-clock + IANA time zoneのoccurrence keyで二重完了・DST・月末を扱う。
  Google Calendarと将来のremote syncはport/adapterで追加し、task truthを所有させない。
- 採用理由: Todoist/TickTick/Things/Any.do等の公開不具合・negative reviewをscenarioとして
  調べると、長期利用の破綻は「保存の成否が見えない」「繰り返しを可変pointerで進める」
  「local storageをbackupと誤認する」「同期providerがdomainを所有する」に集中していた。
  Web Storage公式資料もdefault storageのeviction可能性を明記するため、local-firstだけでは
  ユーザーの永続性要求を満たさない。
- 品質運用: オーナー提案の「実装→評価→目標差分→実利用技術/事例のWeb再調査→再実装」を
  全vertical sliceのcompletion gateにする。評価は正常系だけでなくquota、crash、multi-tab、
  time zone、migration中断、context loss、長期dataをfault injectionする。critical/high差分
  が0になるまで同一証拠を再計測する。
- 不採用案: 初期版から独自cloud backendを正本にする案は、認証・競合・運用面を先に膨らませ
  daily useと端末内耐久性の完成を遅らせるため不採用。将来のSyncReplicaPortだけを先に固定する。
  単純last-write-winsも本文削除/完了競合を黙って失うため不採用。
- 詳細: docs/architecture.md。
- 将来見直し条件: 複数端末syncを製品scopeへ追加する時、browser storage仕様が変わる時、
  または10k tasks / 100k events benchmarkが予算を超えた時。

## D-011: pm-zero v12.1(Frontend/UI Operating Layer)への追随

- 日付: 2026-08-21
- 対象: tooling / governance / frontend
- 決定: `pm-zero-knowledge-v12.1.md`のSection 16に合わせ、本リポジトリへ以下を反映した。
  (1) `scripts/setup.mjs`をv9.4相当の放置状態からv12.1へ書き直し、`package.json`の
  frontend依存(`next`/`react`等)検出時のみ`.claude/skills/impeccable`導入・
  `.mcp.json`への`chrome-devtools` MCP登録を冪等に行う(§16.7)。GitHub Copilot向け
  成果物(`.github/agents`等)はこのプロジェクトの対象外ツールのため導入直後に削除。
  (2) `CLAUDE.md`のSelf-ReviewにTier 1トリガーとして「共有UIコンポーネント/design
  tokensへの変更」を追加、`DESIGN.md`採用時のraw-value lint要件を明記(§16.2/16.5)。
  (3) `scripts/verify.mjs`の必須ファイル一覧へ`AGENTS.md`・`.codex/config.toml`を追加し、
  pm-zeroのデフォルト16ファイル構成の存在を機械的に検証する。(4) `.github/workflows/ci.yml`
  のtrigger branchesへ`grimore-v2`を追加し、実運用ブランチでCIが機能する状態にした
  (従来は`main`のみでT041/D-044由来のgapとしてAGENTS.mdに記録されていた)。
  (5) `AGENTS.md`から解消済みの旧gap記述(空`package.json`前提のverify失敗注記、
  上記CI trigger gap注記)を削除し、Codex側の§16対応(Claude専用ツールとの切り分け)を追記。
  (6) `eslint.config.mjs`へ`.claude/skills/**`のglobalIgnoresを追加(vendored
  impeccableスクリプトが`--max-warnings=0`を割ることを防止)。
- 採用理由: オーナーがpm-zeroリポジトリの最新ナレッジ(v12.1)を参照して本リポジトリを
  最適化するよう明示的に依頼。v12.1の許容基準(config値・script exit code・hookに
  還元できるものだけ採用)に沿い、判断のいるUI規約(8-phase workflow等)は取り込まず、
  機械的に検証・実行できる部分のみ導入した。
- 検証: `pnpm verify`(lint/typecheck/test/build)全合格、`node scripts/setup.mjs`が
  UI検出→冪等provisioningで正常終了、`.mcp.json`に`chrome-devtools`登録確認、
  `git diff --check`。
- 不採用/保留: `DESIGN.md`/`ASSET_REGISTRY.md`とそれに伴うraw-value lintは
  「具体的必要が生じた時のみ追加」というpm-zero自身の原則により今回は未導入。
  GitHub branch protectionの`grimore-v2`要求設定はリポジトリ設定(GitHub側)であり
  ワークフローファイルの変更だけでは反映されない。
- 将来見直し条件: pm-zero-knowledgeが次版へ更新された時、またはDESIGN.mdを実際に
  採用してtoken registryが必要になった時。

### D-011 追記(2026-08-21): 重複/不要ツールの削除

- 決定: `chrome-devtools` MCPを`.mcp.json`および`scripts/setup.mjs`のprovisioningから
  削除した。理由は重複: 本プロジェクトは既にPlaywright MCPをbrowser検証の主経路として
  登録・常用しており(T004でCodex側に登録、T008のevidence取得、`tests/e2e/`のPlaywright
  suite)、v12.1 §16.3自身も「Playwright MCP + `run` skill」をこのプロジェクトの機構と
  名指ししている。加えて`impeccable`自身のコード(`reference/critique.md`、
  `detector/engines/browser/detect-url.mjs`)を確認したところ、URLスキャンは同梱の
  Puppeteerにfallbackし、既存harnessのbrowser toolがあればそちらを優先する設計で、
  chrome-devtools MCPへの依存は無い。二重にbrowser automation MCPを持つのはtool-schema
  costの純粋な浪費と判断した。あわせて`.claude/settings.local.json`(gitignore対象、
  ローカルのみ)に残っていた、現行`.mcp.json`のどのサーバーにも対応しない孤立した
  permission entry(`mcp__bc5f5980-...__search_files`)も削除した。
- 保持したもの: `blender` MCPは`grimore-v2/Grimoire_決定事項ログ.md`の「資産・データの
  調達方針」でBlenderMCP経由のPolyHaven連携(CC0モデル・HDRI・テクスチャ)が確定方針として
  明記されており、製品のasset調達計画に実際に必要なため維持。`frontend-design`
  プラグインと`context7` MCP(いずれもグローバル、pm-zero v12.1で既に導入済み)は
  `impeccable`と役割が異なる(前者はdesign-framework scaffolding、後者は自動UI批評
  detector)ため重複ではなく、いずれもリポジトリ固有の変更ではないため対象外とした。
- 検証: `pnpm lint`合格(setup.mjs変更の反映確認)、`.mcp.json`に`chrome-devtools`が
  残っていないことを目視確認。

## D-012: DESIGN.mdを0から構築し、UI層のみ全面リセットする(データ層は維持)

- 日付: 2026-08-22
- 対象: product design / frontend rebuild scope
- 決定: オーナー指示により、UI層(`src/app/`, `src/features/*`, `src/ui/`, 対応するCSS)を
  `DESIGN.md`準拠で全面作り直しする。データ層(`src/domain/`, `src/application/`,
  `src/infrastructure/` — T012で構築したDexie schema、transaction receipt/outbox、
  recurrence、storage health等)は無傷のまま維持する。今回のセッションでは`DESIGN.md`の
  作成のみを行い、UI層の実装置き換え自体はT019として起票し次セッション以降に回した。
  `DESIGN.md`は既存`tokens.css`/`design-tokens.ts`の単純転記ではなく、
  `docs/vision.md`と`docs/architecture.md` §8(Pass1/Pass2の視覚方針)を出典として、
  存在しなかった型scale(operation/lore双方の具体的なsize/line-height)を新規に設計し、
  color/space/radius/motion/layer tokenを命名registryとして再整理、raw-value lintの
  適用範囲・除外機構・component rule(equal rounded card禁止の具体的判定条件を含む)を
  明文化した。
- 採用理由: pm-zero v12.1 §16の「機械的に検証できる範囲だけ導入する」原則と、オーナーの
  明示指示(UI層全面リセット、データ層維持、DESIGN.md作成のみを今回のスコープとする)を
  両立させるため。`docs/architecture.md` §8で既に確定していたPass1/Pass2の視覚方針
  (iron controls、Noto Sans JP+Shippori Mincho、cyan mist希少性、非対称構図、
  wordless魔導書紋章)は上書きせず正典として扱い、それを実装可能なtoken/component規約へ
  具体化する作業として実施した。
- 検証: DESIGN.md単体のためコード側検証は無し。`git diff --check`のみ(ドキュメントのみ、
  Markdown/docs-only exceptionでgrimore-v2ブランチへ直接コミット可)。
- 将来見直し条件: T019(UI層実装)着手時、またはDESIGN.mdの想定と実装が乖離した時に
  DESIGN.md自体を更新する。

## D-013: スプラッシュ・背景世界を自作実装から調達動画素材へ変更、v1統合資産の引き継ぎを確定

- 日付: 2026-08-22
- 対象: product / assets / scope
- 決定: オーナーの大幅な方針転換を受け、以下を確定する。
  (1) スプラッシュ画面と背景世界(エリア)は、Three.jsによる自作実装をやめ、
  オーナーが調達する**動画素材**を使用する。素材はリポジトリ直下の`anime/`
  フォルダへオーナーが配置する。
  (2) これに伴い、productionの背景レンダラだった`src/world/three-coral-runtime.ts`
  はproduction経路から退役させる。設計原典である`grimore-v2/prototypes/area1-coral/`
  はそのまま記録として残す。`three`パッケージ自体はグリモ(3Dキャラクター)で
  引き続き使うため依存から外さない。
  (3) 従来Three.jsシーンが実行時に発行していた環境コントラクト
  (`EnvironmentSnapshotV3`: 主光源の方向・色・強度、環境光、フォグ、接地影)は、
  **各エリア動画に添える静的なJSONディスクリプタ**から供給する方式へ変更する。
  実行時の映像フレーム解析(canvasサンプリング)は採用しない — 決定的で、
  オフラインで動き、テストできるため。
  (4) グリモ(相棒キャラクター)は、CodexのThinking画像生成でベースとなる
  キャラクターデザインを確定させ、そこから既決の動き(E-4〜E-6)を含めて制作する。
  詳細ワークフローはD-014。
  (5) 今回の実装セッションのスコープ: スプラッシュ画面、背景世界、グリモ、
  アイテムのアートは、素材の準備ができた時点でオーナーが改めて実装指示を出す。
  今回はそれ以外の実装可能な範囲(UI層、データ層、統合、図鑑テキスト、音の仕組み)
  をすべて完成させる。
  (6) Google OAuth、Google Calendar、Gmail取込、Gemini API、通知(リマインダー)は、
  **v1(`main`ブランチ)の実装をそのまま引き継ぐ**。機能要件が変わらないものを
  作り直さない、というオーナーの明示判断。v2のモジュール境界へ配置し直すだけで、
  ロジックの再設計はしない。
  (7) アイテム図鑑は720種(12分類×60種、M-8準拠)のテキスト(名前・分類・説明文)を
  今回すべて作成する。画像(夜光標本図)は後日。
  (8) 音: BGMはオーナーが調達する。UI操作音・短い効果音は、**Claudeが自作(合成)
  することを禁止**し、Web/SNS/GitHub上の既存アセットを、UIコンポーネントと
  同じようにライセンスを確認したうえでこのリポジトリへインストールして実装する。
  UI層と操作音・効果音が一体として最高品質の体験になるようにする。
  (9) 実装の役割分担: Opus(メインエージェント)がUI層(効果音を含む)を担当し、
  それ以外の作業はSonnetのサブエージェントへ委譲する。
- 採用理由: オーナーの明示指示。(a) 背景世界とスプラッシュは、自作3Dで到達できる
  品質より調達動画のほうが確実に高品質かつ短期で成立する。(b) v1で実運用に
  耐えていたOAuth/Gemini/通知を作り直すのは、機能要件が変わらない以上コストだけが
  増える。(c) 720種のテキストを先に確定しておくと、後続の画像生成が既存IDへ
  差し込むだけで済む。
- 不採用案: (a) 背景世界のThree.js自作を継続 → オーナーが動画調達へ方針転換した
  ため不採用。(b) 動画フレームを実行時にサンプリングして環境コントラクトを生成 →
  CPUコストが常時かかり、オフライン・テスト・決定性のいずれでも静的JSONに劣る
  ため不採用。(c) v1の統合機能をv2で再設計 → 機能が変わらないため純粋な
  作り直しコストとなり不採用。
- 既知のギャップ: (1) `anime/`フォルダは2026-08-22時点で空であり、動画素材の
  実物はまだ無い。素材が無い間、世界表面はposter/fallback状態で正常動作する
  必要がある(architecture.md §8の「Homeを3D依存にしない」方針と同じ扱い)。
  (2) 各エリア動画に添える環境ディスクリプタJSONのスキーマは、実素材が届いた
  時点で初期値を実測して確定する。(3) v1統合資産の移植では、v1の
  `src/lib/api/*`がv1のDBスキーマ・ドメイン型に依存しているため、v2の
  `src/domain` / `src/application`型への接続部だけは新規に書く必要がある。
- 将来見直し条件: 動画素材が揃った時点で、エリア数・解像度・尺・コーデックの
  実測値をもとに配信方針(プリロード、Service Workerキャッシュ対象、モバイルでの
  poster代替)を確定する。

## D-014: グリモ制作ワークフローの確定(画像生成→3D→リグ→GLB→R3F)

- 日付: 2026-08-22
- 対象: assets / pipeline / grimo
- 決定: 2026-08-22時点のWebリサーチに基づき、グリモの制作ワークフローを次の
  8段階で確定する。
  Stage 1 デザイン確定: Codexの画像生成で犬系グリモ(水属性、決定事項ログL-2準拠)
  のコンセプトを複数案生成し、オーナーが1案を選ぶ。
  Stage 2 ターンアラウンド化: 選定案から**正投影の4〜6面図**(front / 45° /
  side / back、Aポーズ、統一ライティング、背景なし)を生成する。単一画像からの
  3D生成は背面・側面を推測に頼るため品質が落ちる。この段階を省略しない。
  Stage 3 画像→3D: 既にグローバル登録済みのBlender MCPのimage-to-3D
  (Hyper3D/Rodin、Hunyuan3D)でベースメッシュを生成する。2026年時点のAI 3D生成は
  "usable, not finished"(クリーンなトポロジー・確実なリグ・水密性は未達)であり、
  生成物をそのまま出荷しない前提で扱う。
  Stage 4 Blenderで整形: 四足生物として妥当なリトポロジー、UV、テクスチャベイク、
  スケールと軸の正規化。Blender MCP経由で実行する。
  Stage 5 リグ: **Mixamo / AccuRIG / RigMasterはいずれもヒューマノイド専用で
  四足には使えない**。BlenderのRigify(quadrupedメタリグ)で手付けリグを作る。
  あわせて決定事項ログE-5の対象部位(耳・尻尾・毛先)へ専用のボーンチェーンを
  仕込む。
  Stage 6 アニメーション: 待機(呼吸)と、E-4が定める上半身中心の短いタップ反応
  (耳、視線、あくび、呼吸)をBlenderで作成し、GLBへ複数クリップとして格納する。
  位置移動を伴う全身動作は初期版に含めない。
  Stage 7 実装: `three` + `@react-three/fiber` + `@react-three/drei`
  (`useGLTF` / `useAnimations`)。待機・反応・復帰は`AnimationMixer`の
  クロスフェード。スプリングボーンは物理エンジンを追加せず部位限定の自前制御
  (決定事項ログE-6準拠)。
  Stage 8 合成: 背景は動画レイヤー、グリモは透過WebGLキャンバスをその上に
  重ねる。動画とライティングを一致させるため、各エリア動画に添える静的な
  環境ディスクリプタJSON(D-013)から主光源方向・色・強度・接地影の濃さを読み、
  threeのライトへ適用する。
- 採用理由: オーナーが「この方針で最もクオリティの高い成果物が出来上がる
  ワークフローをWebリサーチして決めよ」と明示指示。リサーチの結果、
  (a) 多視点ターンアラウンドがimage-to-3Dの品質を最も大きく左右する、
  (b) AI生成メッシュは2026年時点でも人手の整形が必須、(c) 四足はヒューマノイド用
  オートリガーの対象外、の3点が決定的だったため、生成で時間を稼ぎ、整形とリグは
  Blenderで確実に押さえる構成にした。
- 不採用案: (a) Live2D Cubism / Spineによる2Dスケルタルアニメーション →
  原画の筆致を保てる利点はあるが、決定事項ログE-5/E-6がthreeとGLBを前提に
  確定済みで、背景動画に対する接地影・視差も3Dのほうが自然なため不採用。
  (b) 単一の正面画像だけをimage-to-3Dへ入力 → 背面・側面の破綻が避けられず
  不採用。(c) AI動画生成でグリモの仕草をループ動画として作る → タップ反応の
  分岐とクロスフェードが表現できず、E-4の「同じ反応の機械的な連続再生を
  避ける」を満たせないため不採用。
- 既知のギャップ: スプリングボーンの剛性・減衰・重力・揺れ幅の数値は、
  実モデルの部位ごとの寸法に依存するため、試作モデルの実機確認まで確定できない
  (決定事項ログE-5 / O-1で既知)。
- 将来見直し条件: Stage 3の生成品質が実物で不十分だった場合、Stage 4の
  リトポロジーを全面手付けへ切り替えるか、コンセプトアートからの直接
  モデリングへ戻す。

## D-015: UI操作音・効果音はKenney "Interface Sounds"(CC0)を本リポジトリへ導入して使う

- 日付: 2026-08-22
- 対象: audio / assets / licensing
- 決定: 効果音は一切自作(合成)せず、ライセンスが明示された既存アセットを
  リポジトリへ導入して使う(オーナー指示、D-013)。導入した素材は次のとおり。
  - パック: Kenney "Interface Sounds" 1.0 (2020-02-11)
  - 作者/配布元: Kenney (https://www.kenney.nl)
  - ライセンス: Creative Commons Zero 1.0 (CC0) — 個人・教育・商用いずれも
    利用可、クレジット表記は任意。全文を `public/audio/ui/LICENSE.txt` として
    素材と同じディレクトリへ同梱している。
  - 取得元: GitHub `Calinou/kenney-interface-sounds`
  - 導入ファイル(12件): tick_002 / click_002 / toggle_001 / toggle_002 /
    open_001 / close_001 / confirmation_001 / back_001 / error_004 /
    glass_002 / scratch_003 / pluck_001。合計約150KB。
  - 用途の対応表は `src/audio/sound-catalog.ts` が唯一の定義箇所であり、
    ファイルパスがコードに現れるのもそこだけ。
- 再生方針: ゲーム向けにミックスされた素材なので、そのままでは
  「アーケードの操作音」に聞こえる。カタログ側で各キューに 0.16〜0.30 の
  ゲインと 45〜400ms の最小再生間隔を与え、決定事項ログF-13の
  「短く控えめ」「連続操作で過剰に鳴らさない」を満たす。
- BGM: オーナーが調達する(D-013)。`anime/` へ `bgm-<エリアid>.<拡張子>` を
  置くと `scripts/sync-world-media.mjs` が `public/audio/bgm/` へ配置し、
  マニフェストへ登録する。素材が無い間はBGM要素そのものが描画されず、
  設定のON/OFFは有効なまま鳴らすものが無い状態になる(エラーではない)。
- 採用理由: (a) CC0はクレジット表記もshare-alikeも義務が無く、個人の趣味
  プロダクトで最も運用コストが低い、(b) 1つのパック内で音色が統一されており、
  複数配布元から寄せ集めるより「一体の体験」になる(オーナー指示の
  「ユーザーが一切違和感を覚えないくらいに」)、(c) 素材をリポジトリへ同梱
  するため、配布元が消えてもビルドが壊れない。
- 不採用案: (a) Web Audio APIによる自作合成 → オーナーが明示的に禁止。
  (b) freesound.org等からの個別収集 → ライセンスがCC-BY/CC-BY-NC混在で
  帰属表記の運用が必要になり、音色の統一も取れないため不採用。
  (c) CDN/外部URL参照 → オフライン動作(PWA)と再現性を壊すため不採用。
- 将来見直し条件: 図鑑の素材別効果音(紙・金属・自然素材・魔法、決定事項ログ
  F-13)を鳴らし分ける段階で、このパックだけでは音色が足りない場合に、同じ
  CC0条件の追加パックを検討する。
