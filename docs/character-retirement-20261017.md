# 廃止キャラクター関連の除去 — 2026-10-17

Humanの明示依頼によりCarolを完全廃止し、再開対象から外した。対象repositoryはローカル名 `task-plant`、remote `https://github.com/snowtone-ai/grimoire.git`。`codex/product-system-map` の `84a759a666c5d2589685ff0aee3d098472ca1144` を基点に、専用branch `codex/retire-carol-20261017` で実施した。

## 知見の先行保存

削除開始前にGrimo側で恒久知見をcommit済み：`eca37a9c5cad76eb7b2f7a59edf5df7770581826`。

[キャラクター3D制作の恒久知見](https://github.com/snowtone-ai/Grimo/blob/eca37a9c5cad76eb7b2f7a59edf5df7770581826/docs/grimo/knowledge/character-production/GRIMO_CHARACTER_3D_LESSONS.md) は、デザインの3D適性、多視点入力、Tripo判断、Rig/変形/Motion、Human Gate、撤退条件、MVP、根拠分類を保存する。制作再開の指示ではない。

## 実行範囲

- 現branchの追跡済み専用残存物 `fsck-carol.txt` を削除。アプリ・seed・enum・task定義・共有docsには専用依存がなかった。
- ローカル `output/playwright` 等の棚卸し済み専用生成物を削除。他タスクの生成物には触れない。
- 専用ローカルbranch `codex/restore-carol-3d-check`、`feat/carol-3d`、`feat/carol-reference-rebuild`、remote `codex/restore-carol-3d-check` を削除。
- `codex/restore-carol-3d-check` は親のない独立履歴で、共通アプリ/Muu/複数キャラ画像も含んだ。無関係な履歴保護のため、元commit `15bfa8e4c3a8ba24c246fe806bd125b307d8f076` を履歴用tag `archive/grimoire-shared-provenance-20261017` としてremoteへ保存してからbranchを削除した。tag内の過去資料は現役production routingではない。
- 他の作業branchの追跡済み専用コピーはsparse checkoutでローカルから外した。既存branchのHEAD/履歴は変更していない。既に実体のなかった専用worktreeの古い登録をpruneした。
- Git履歴rewrite、reflog失効、広域gc/prune、IndexedDB/利用者データ/秘密/外部接続/公開設定の変更は実施していない。ローカルLFS objectは0件。

## 検証境界

元の `tasks.md` の製品台帳は保持し、今回の現在地だけ先頭に追加。変更は専用ログ削除とMarkdownのみ。対象差分、Carol参照と専用path、他タスク保持、`git diff --check` を確認する。フルテスト・buildは実施しない。

過去Git commit/tag、他branchの古い共有docsには廃止前の記載が残る。Tripo等の外部サービス側生成物と、用途不明ファイルは未削除。GitHubのmainへは本branchの取り込みが必要。

## 容量結果

棚卸し対象13 pathの論理サイズ 4,230,866 → 0 bytes、約4.03 MiB削減。専用生成物と専用ログのみ。LFSは前後0。既存棚卸しworktree全体は1,633,383,345 → 1,629,156,205 bytes（新しい今回記録の増分を含む、測定時点）。

## 最終清算の再確認 — 2026-10-17

- 再fetch後のmainは `6bca9b043196cce9941a8e4005c234938397e33b`。廃止差分は既にmainに保存済み。上記「取り込みが必要」は初回実行時の記録であり、再統合しない。
- SAFE_EDIT: 本記録とtasksの現在地のみ更新。専用名のmain追跡pathなし、既存棚卸し対象の専用生成物の復活なし。Carol資産の追加削減は0。
- SAFE_DELETE: 旧統合用 `codex/retire-carol-main-20261017` はmainと同一SHA、cleanかつignored/untrackedなし。不要なworktreeとlocal branchを削除（2,469ファイル、論理151,398,788 bytesの重複checkout）。remoteには同名branchなし。
- PROTECT: 旧 `codex/retire-carol-20261017` = `c9bdb67` にはmain未包含の別作業 `1a47f03`（移行）、`3101399`（台帳）、`84a759a`（product atlas）がある。削除条件を満たさないためlocal/remote branch・clean worktreeを保持。`docs/character-retirement-20261017.md` はmainと同一で、専用ログは両方から削除済み。製品作業branch、共有archive tag、利用者データ・sparse設定も保護。
- Grimoの同名旧廃止branchはmainと同一SHAであり、local/remote branch・clean専用worktreeを削除。恒久知見とJill/Pino/Shushuを維持。最終監査は[PR #6](https://github.com/snowtone-ai/Grimo/pull/6)でmerge済み、再fetch後mainは `4e52cd4080e1b1b5414caf90c74374ee311efd7b`。
- UNKNOWN/HOLD: 共有Git履歴、用途不明object・無名ファイル、GitHub remote LFS、Tripo等の外部資産。共有履歴rewriteなし。外部アカウントを確認できず、外部削除済みとは扱わない。[Grimo最終監査](https://github.com/snowtone-ai/Grimo/blob/main/docs/grimo/knowledge/character-production/CHARACTER_RETIREMENT_AUDIT_20261017.md)を参照。
- CI/保護設定は独立した別PRで扱う。既存audit失敗が必須verifyを止めているため、本記録のmain統合もチェック成功までHOLD。無断bypass、main巻き戻し、audit緩和なし。
