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
