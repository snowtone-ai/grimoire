# CIとmain保護の独立是正 — 2026-10-17

Carol廃止とは独立した運用・依存セキュリティ問題。アプリや依存バージョン、auditの閾値は本変更で変えない。

## 確認事実と保護設定

- 調査時main: `6bca9b043196cce9941a8e4005c234938397e33b`。CI [run 39006259124](https://github.com/snowtone-ai/grimoire/actions/runs/39006259124) は `pnpm audit --audit-level=low` で失敗。45件（Critical 4 / High 15 / Moderate 22 / Low 4）。後続lint/typecheck/test/buildは未実行。廃止前にもaudit失敗があったため廃止差分の回帰とは扱わない。
- 調査時のclassic protection: required check `verify`、GitHub Actions app ID `15368`、strict=false。PR必須設定なし、enforce_admins=false。rulesetsは空。commit作成者/committerは `snowtone-ai`、利用中の権限はadmin=true。
- [GitHub公式仕様](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)では、既定で管理者は保護の適用外。この設定は前回のチェック未完了pushを許した条件と整合する。ただし過去のpush主体・認証経路・当時設定の変更履歴を完全に証明する監査イベントは取得できておらず、特定操作の断定はしない。
- Human依頼の範囲でPR必須（承認人数0）とenforce_admins=trueをAPIで適用し、再読込で確認した。必須verifyのapp指定、strict=false、force-push禁止・削除禁止等は維持。既存の正当な管理者権限やActionsのread権限を削除せず、追加の人間レビューは要求しない。唯一のrepo workflowはCIで、contents: read。mainの直接pushを必要とする自動化は見つからなかった。
- 変更前後JSONはローカル `C:/Users/chidj/.codex/retire-carol-audit-20261017/final-protection-{before,after}.json`。管理者は設定変更権限を引き続き持つが、通常変更ではPRと必須チェックを経由する。過去mainの巻き戻し・今後のbypassは行わない。

## 最小CI変更

installにstep IDを付け、lint/typecheck/test/buildに「キャンセルされておらず、install成功」の条件を付ける。auditまたは別検査が失敗しても後続の検査を実行し、Actionsの各step結果で個別に確認できるようにする。install失敗時は実行せず、キャンセルは尊重する。

auditは同じコマンド・閾値で通常の失敗stepのまま保持。continue-on-errorや失敗の握りつぶしは使わず、どれかの検査が失敗すれば必須verifyは失敗する。job名は変えないため保護ルールのrequired checkと一致する。依存問題が解決するまでこのPR自体もmerge HOLDになり得る。

## 独立セキュリティタスクの対処方針

1. **P0調査・P1修正:** 最新audit JSONとDependabotを採取し、対象バージョン・prod/dev区分・アプリでの到達性を確認。45件は上記run時点のaudit集計。push時のDependabot表示32件（Critical 7 / High 8 / Moderate 14 / Low 3）とは集計元・時刻が異なるため同一視しない。
2. 既存[PR #56](https://github.com/snowtone-ai/grimoire/pull/56)（Next 16.3.8）、[PR #54](https://github.com/snowtone-ai/grimoire/pull/54)（sharp 0.35.4）を独立レビューする。既存auditにはNextのCriticalなWindows関連・画像最適化RCE等、shadcn経由のproxy-addrのCriticalがある。Nextとeslint-config-nextの整合、sharpの画像処理経路を確認。バージョン番号だけで全件解消と推定しない。
3. `shadcn > @modelcontextprotocol/sdk > express > proxy-addr`（当該ログの修正版 >=2.0.8）等は依存経路を確認し、上流更新または狭いoverrideを別PRで検討。残るHigh/Moderate/Lowも最新advisoryに照らして解消。不要なruntime依存の整理は実使用を調べてから独立提案する。
4. 修正PRでlockfileを更新し、auditの閾値lowを維持したままlint/typecheck/test/buildを確認。IndexedDB互換性と影響するアプリ経路を限定検証。グリーンになってから通常PR merge。本CI PR・最終監査PRも最新mainに追従し、成功したrequired checksでmergeする。

検証は差分チェックと実PRのGitHub Actions結果。新規依存導入やCarol名目の大規模更新はしない。参照先のpm-zero共通AGENTS.mdはローカル指定pathに存在せず、確認済みrepo規約とHuman指示を適用した。
