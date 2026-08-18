# decisions.md

## D-001: CLAUDE.md構造 — @AGENTS.md import方式
- 日付: 2026-05-09
- 対象: architecture
- 決定: CLAUDE.mdは@AGENTS.mdを冒頭でインポートし、プロジェクト固有ルールのみ記載
- 採用理由: v9.1の二重記載禁止ルール
- 不採用案: AGENTS.mdに全ルールを統合 → プロジェクト固有の地雷回避ルールが汎用指示と混在
- 将来見直し条件: Claude Codeが@importを正式サポートした場合

## D-002: vision.md の配置 — docs/ ディレクトリへ移動
- 日付: 2026-05-09
- 対象: architecture
- 決定: vision.md をルートから docs/vision.md に移動
- 採用理由: v9.1 Memory Layer仕様。state/decisions/issuesと同一ディレクトリに統一
- 不採用案: ルートに残す → 一貫性が崩れる
- 将来見直し条件: なし

## D-003: Service Worker — cache.addAll 禁止
- 日付: 2026-05-09（既存判断の記録）
- 対象: architecture
- 決定: install イベントで cache.addAll を使わず、fetch イベントで cache.put
- 採用理由: addAll は1URLでも失敗すると全体が失敗し、古いSWが永続化する
- 参照例: CLAUDE.md 自己改善セクション
- 将来見直し条件: なし

## D-004: データストア — IndexedDB (Dexie.js) + 遅延初期化
- 日付: 2026-05-09（既存判断の記録）
- 対象: architecture
- 決定: Dexieインスタンスを getDb() + Proxy で遅延初期化
- 採用理由: SSR環境でのモジュールトップレベル評価を防止
- 将来見直し条件: Next.js の SSR 仕様が変わった場合

## D-005: Observability — MVP段階では後回し
- 日付: 2026-05-09
- 対象: architecture
- 決定: MVP段階では構造化ログ・APMは導入しない。console.error/warn/info の使い分けのみ
- 採用理由: 個人利用PWAのため。本番運用で問題が出たら導入
- 将来見直し条件: ユーザー数が増えた場合、本番障害が追跡困難になった場合

## D-006: ディレクトリ構造 — domain/api/hooks に責務分離
- 日付: 2026-05-09
- 対象: architecture
- 決定: pure domain logic を `src/lib/domain/`、外部API補助を `src/lib/api/`、React副作用を `src/hooks/` に分ける
- 採用理由: 300行超ファイルを分割し、UI / domain / data の責務混在を減らすため
- 不採用案: PRODUCT-OPTIMIZATION.md の全構成を一括導入 → diffが大きくなり既存機能の回帰リスクが高い
- 将来見直し条件: テスト基盤導入後に `taskDb.ts` を query/mutation 単位へ追加分割する場合

## D-007: Service Worker管理 — 今回は既存ファイルを維持
- 日付: 2026-05-09
- 対象: architecture
- 決定: `src/components/pwa-register.tsx` は64行でゲート内のため、今回は抽出しない
- 採用理由: Service Workerは既存の地雷回避ルールが多く、不要な移動は回帰リスクになるため
- 不採用案: `lib/services/sw-manager.ts` へ即時抽出 → 動作差分の検証コストが高い
- 将来見直し条件: SW更新UIや複数登録パスが増えた場合

## D-008: テスト基盤 — Node built-in test を先行採用
- 日付: 2026-05-09
- 対象: process
- 決定: pure domain helper は Node.js built-in test runner で検証し、Playwright/Vitest導入は別タスクで実施
- 採用理由: 追加依存なしで最低限の再現テストを導入し、品質改善リファクタと依存追加を分離するため
- 不採用案: 依存を即時追加してE2E/Unitを実装 → ロックファイル変更とテスト設定変更が大きくなる
- 将来見直し条件: 次の機能追加またはバグ修正に着手する前

## D-009: Google Auth — GIS OAuth2 参照を事前確定
- 日付: 2026-05-09
- 対象: api
- 決定: `requestGoogleToken` は `google.accounts.oauth2` をローカル変数へ確定してから `initTokenClient` を呼ぶ
- 採用理由: TypeScript narrowing を Promise 内でも維持し、GIS未ロード時は明示的に拒否するため
- 実在例:
  - 初回ロード直後で GIS script が未完了の場合、`window.google` が存在しない
  - script は読み込まれたが accounts API 初期化前の場合、`google.accounts` が存在しない
  - OAuth2 API が利用不能な場合、`google.accounts.oauth2` が存在しない
- 不採用案: non-null assertion の追加のみ → 実行時の欠落検出が弱くなる
- 将来見直し条件: GIS loader を明示導入し、読み込み状態を UI で管理する場合

## D-010: Task Plant Phase1-7 実装方針（UI/API/DB/Workflow）
- 日付: 2026-05-09
- 対象: ui/api/db/workflow
- 決定: `docs/implementation-plan.md` の Phase 1→7 を順守し、追加依存なしで実装する
- 実在例:
  - UI例1: 下部ナビを「ホーム / カレンダー / 植物」の3タブに拡張し、`/plant` への導線を統一
  - UI例2: ホームのタスクカード右端に展開トグルを追加し、既存の「カードタップで編集」導線は維持
  - UI例3: `/all` のリスト表示に「今日以降のみ表示」トグルを追加し、既定値をONにする
  - API例1: Gmail APIで直近7日/最大20件を取得し、Geminiでタスク候補抽出後にユーザー選択で反映
  - API例2: Google Calendar APIで将来イベント最大30件を取得し、タスク形式へ変換して取り込む
  - API例3: Google Identity Servicesを`layout.tsx`へ読み込み、`use-google-auth.ts`経由でOAuth接続する
  - DB例1: Dexie `version(2)` で `plantState` テーブルを追加し、`version(1)` は維持する
  - DB例2: `plantState(id=1)` に週次完了数/累計完了数/週開始日を保存し、週跨ぎで `weeklyCompleted` をリセット
  - DB例3: 植物成長段階を `weeklyCompleted` から算出し、タスク完了/取消で増減を同期する
  - Workflow例1: 各Phase完了ごとに `npx tsc --noEmit && pnpm lint` を実行して次Phaseへ進む
  - Workflow例2: IndexedDBを使う画面は `dynamic(..., { ssr: false, loading })` で遅延描画する
  - Workflow例3: 最終検証で `npx tsc --noEmit` / `pnpm lint` / `pnpm build` をすべて通す
- 不採用案: PixiJS導入（依存追加が必要でコストゼロ制約に反する）
- 将来見直し条件: OAuthスコープ追加や月次植物ロジック変更が発生した場合

## D-011: 12か月植物デザイン — 実物の成長差をSVGに反映
- 日付: 2026-05-09
- 対象: ui
- 決定: 4アーキタイプの内部構成は維持しつつ、`PlantSpecies.nameEn` ごとに12種類の蕾・葉・花形を描き分ける
- 採用理由: 月替わり植物が同一テンプレートに見えると、1年周期の報酬体験が弱くなるため
- 実在例:
  - 樹木系: 桜は蕾から開花へ段階があり、梅は丸い5弁と目立つ雄しべ、蝋梅は葉の少ない枝に黄色い蝋質花を咲かせる
  - 蔓/低木系: 藤は垂れる総状花序、紫陽花は低木の葉と球状の装飾花房として表現する
  - 草花/球根系: 朝顔は双葉・蔓・漏斗状花、コスモスは細い分枝と舌状花、金木犀は葉腋の小花群、シクラメンは斑入り葉と反り返る花弁として表現する
- 不採用案: 4アーキタイプのみの色違い継続 → 12か月分の差が弱く、実物モデルの要求に合わない
- 将来見直し条件: 写真素材やCanvas/bitmap表現を採用して、より写実寄りにする場合

## D-012: Task.description フィールド — vision.md 未記載の拡張
- 日付: 2026-05-09
- 対象: db
- 決定: `Task` に `description?: string` を追加（vision.md のデータモデルには記載なし）
- 採用理由: タスクカードの展開表示で「詳細メモ」を入力・表示するため実装時に追加
- 将来見直し条件: vision.md のデータモデルセクションに正式追記する
- 影響ファイル: `src/lib/db.ts`, `src/components/home/task-add-modal.tsx`, `src/components/home/task-edit-modal.tsx`, `src/components/home/task-card.tsx`

## Future Changes
- Codex CLI を本格導入した場合、state.md の Write Lock 運用を厳格化
- ユーザー数増加時に Observability Gate の本格対応

## D-014: pm-zero v9.3移行 — tasks.md と repo-map.md を一次構造に追加
- 日付: 2026-05-15
- 対象: process
- 決定: 実行タスクは `tasks.md`、現在ポインタは `docs/state.md`、リポジトリナビゲーションは `docs/repo-map.md` に分離する
- 採用理由: pm-zero v9.3 の Task Ledger Gate / Repo Map Gate に合わせ、タスク状態と現在状態の重複を防ぐため
- 不採用案: `docs/state.md` にタスク一覧を残す → `tasks.md` と責務が重複し、更新漏れが起きやすい
- 将来見直し条件: pm-zero の次版で台帳責務が変更された場合

## D-015: 検証コマンド — package.json と scripts/verify.mjs を一致させる
- 日付: 2026-05-15
- 対象: process
- 決定: `pnpm typecheck`, `pnpm test`, `pnpm verify` を package.json に追加し、`scripts/verify.mjs` はそれらを呼ぶ
- 採用理由: AGENTS.md / OS-KERNEL.md が要求するコマンドと実在する npm scripts がズレていたため
- 不採用案: `npx tsc --noEmit` などを文書側に残す → v9.3標準コマンドと異なり、次セッションで迷う
- 将来見直し条件: テストランナーをVitest/Playwrightへ移行した場合

## D-016: パッケージ管理 — pnpmへ単一化
- 日付: 2026-05-15
- 対象: process
- 決定: `pnpm-lock.yaml` を唯一のロックファイルとし、旧 `package-lock.json` は削除する
- 採用理由: AGENTS.md / README.md / docs/repo-map.md がpnpmを一次パッケージマネージャーとして定義しており、npmロックが残ると依存更新経路が分岐するため
- 不採用案: `package-lock.json` を残して注意書きだけ追加 → 次回の自動実行でnpm/pnpmの混在が再発しやすい
- 将来見直し条件: プロジェクト標準をnpmへ戻す場合

## D-013: 植物画面復旧 — plantState + 共通下部ナビ
- 日付: 2026-05-15
- 対象: UI / domain
- 決定: 植物状態は既存の `plantState` 永続化を使い、下部ナビは `src/components/navigation/bottom-nav.tsx` に共通化する
- 実例1: `/` の下部ナビに「ホーム / カレンダー / 植物」を表示し、植物タブから `/plant` へ遷移する
- 実例2: `/all` の下部ナビも同じ3タブを使い、ページごとの複製差分で植物タブが消えないようにする
- 実例3: `/plant` は今月の植物名、今週の完了数、成長段階、SVG植物を表示し、IndexedDB読み込み失敗時も画面全体を空にしない
- 採用理由: リモート側で導入済みの `plantState` と同期しつつ、ナビ重複をなくすことで同種の表示欠落を防げるため
- 不採用案: 各画面に下部ナビを個別実装し続ける → ページ追加時にタブ欠落が再発しやすい
- 将来見直し条件: 月跨ぎ履歴、植物図鑑、手動育成状態など永続化が必要になった場合
## D-017: pm-zero v9.4 Lean Task Ledger alignment

- Date: 2026-05-16
- Decision: Keep Task Plant project memory in AGENTS.md, tasks.md, docs/state.md, docs/repo-map.md, docs/decisions.md, and docs/issues.md.
- Rationale: pm-zero v9.4 assigns reusable behavior, model defaults, and generic hooks to global config. The repo should keep only product facts, task state, and verification commands.
- Consequence: Project-local Codex/MCP/hook scaffolds are removed unless a future task records a concrete deterministic need.

## D-018: 植物報酬画像 — 写実的な生成写真アセットへ移行
- 日付: 2026-05-17
- 対象: ui / reward
- 決定: 植物画面の報酬表現は、既存SVGイラストから、事前生成した超写実的な自然写真風アセットへ移行する方針とする。
- 採用理由: タスク完了のインセンティブとして、自然で美しい花の写真体験がイラストより強く、月ごとの季節感も表現しやすいため。
- 実例1: 花を主役にしつつ、梅は冬の枝、紫陽花は梅雨、コスモスは秋風など周囲の季節感を少し含める。
- 実例2: 過度な幻想表現、非現実的な発光、作り物のような完全対称、花弁の破綻、余計な文字や人物は避ける。
- 実例3: 各月の花ごとに5案生成し、選定後にアプリ同梱の固定アセットとして使う。実行時生成は報酬表示の即時性を損なうため避ける。
- 将来見直し条件: API課金・生成運用を避けるため、D-019で無料写真素材へ方針変更済み。

## D-019: 植物報酬画像 — 無料写真素材を事前同梱する
- 日付: 2026-05-17
- 対象: ui / reward / assets
- 決定: 植物報酬画像は、GPT画像生成ではなく、無料利用可能なWeb写真素材をダウンロードしてアプリ用に編集・同梱する。
- 採用理由: ユーザー専用アプリでAPI課金を避けたいこと、実写真の自然さを優先したいこと、既存写真を画面比率に合わせて編集すれば目的を満たせること。
- 実例1: Unsplash等の写真ページで無料利用ライセンスを確認し、元URLを `docs/plant-reward-image-sources.md` に記録する。
- 実例2: 人物・ブランド・ロゴ・文字が主役になる写真は避ける。
- 実例3: 選定後に `public/plant-rewards/` 配下で画面用サイズへトリミング・圧縮する。
- 将来見直し条件: 無料素材で花種や季節感の品質が不足する場合、ユーザー提供写真または有料素材を検討する。

## D-020: pm-zero v9.4 -> v11 governance migration
- Date: 2026-07-19
- Target: OS/governance files (non-source)
- Decision: Migrate all non-source governance files to pm-zero v11: CLAUDE.md becomes the
  self-contained always-on ruleset; AGENTS.md and the Codex model-routing are removed
  (v11 is Claude Code only); .claude/settings.json adopts the v11 project template
  (bypassPermissions + guard-hook deny mirrors + autocompact 50); self-review is tiered
  (Tier 1 fresh Sonnet default, Tier 2 Opus for top-risk classes).
- Rationale: v11 is the Budget-Bound Autonomous Solo-Dev OS. It reasons from a hard Pro-plan
  budget and a single Claude Code agent, so the dual-agent (Codex) split, the AGENTS.md
  adapter layer, and the mandatory-Opus review gate are dropped. Behavior lives in a lean
  CLAUDE.md that reloads every turn; project facts stay in the git ledger.
- Consequence: Removed AGENTS.md (folded into CLAUDE.md), docs/codex-prompt.md (Codex-only),
  and the deprecated tombstones OS-KERNEL.md and MEMORY.md (v11 auto-memory is user-level,
  not a project stub). scripts/verify.mjs no longer requires AGENTS.md. Historical tasks.md
  rows keep their "Codex CLI" owner for evidence integrity; docs/implementation-plan.md is
  retained unchanged as a historical planning artifact.
- Future review: if Codex or another second agent is reintroduced, re-add a thin adapter and
  record the concrete need here.

## D-021: 2026デザイン刷新 — メディア駆動ダークファースト + ネイティブView Transitions
- 日付: 2026-07-19
- 対象: ui / design-system / accessibility
- 決定: ダークモードは prefers-color-scheme メディアクエリ駆動（クラストグルなし・JSゼロ・FOUCなし）。
  全画面の色は globals.css のセマンティックトークン（primary/brand/category/success/destructive）
  経由に統一し、ライト専用のパレット直書きを廃止。リストの並び替えアニメーションは依存追加なしの
  ネイティブ View Transitions API + flushSync（`src/lib/view-transition.ts`）で実装。
- 採用理由: 単一ユーザーのAndroid Chrome PWAではOS設定追従が最小実装で最大効果。orange-500直書きは
  ダーク非対応かつ白文字コントラスト2.8:1でWCAG AA不合格のため、AA準拠ペア（橙地+濃茶文字、
  テキスト用は--brand）へ置換。WCAG 2.2対応として userScalable:false 撤廃、24px以上のタッチ
  ターゲット、progressbarロール、prefers-reduced-motion 全面対応を同時に実施。
- 実在例:
  - ホームのヒーローカード: SVG進捗リング + ストリークチップ + 植物ステータスチップ（/plant導線）
  - タスクカード: pathLength=1 のSVGチェック描画、background-size遷移の取り消し線、
    grid-template-rows 0fr→1fr の展開、期限超過シグナル
  - チェック色は text-background / text-primary-foreground で両スキームの可読性を自動維持
- 不採用案: Biome移行（eslint-config-next 16のNext/react-hooksルール喪失リスク > 速度益）、
  Motion/Framer Motion導入（View Transitions APIで代替、バンドル増を回避）、
  クラスベースdarkトグル（状態管理とFOUC対策が不要に増える）、
  Server Actions/PPR適用（サーバーレスのローカルファーストPWAには適用対象外）
- 将来見直し条件: 手動テーマ切替の要望が出た場合、またはブラウザのView Transitions挙動差が
  問題化した場合

## D-022: 報酬システムv2 — アイスボーン風「素材ドロップ×調査記録」+ 月次累積成長
- 日付: 2026-07-19
- 対象: reward / db / ui / audio / concept
- 決定: 報酬系を「クエスト達成→素材ドロップ（変動報酬）→調査記録（コレクション）」の
  モンスターハンター：アイスボーン風ループに刷新する。植物成長は週次リセットを廃止し
  月内累積制（月替わりで新種到来=物語的リフレッシュ）へ変更。Dexie version(3) で
  `drops` テーブルを追加し、`plantState` は upgrade 内でタスクから月間完了数を再計算して
  移行（既存データ喪失なし）。
- 採用理由（外部調査の裏付け）: ADHDは遅延報酬を急峻に割り引くが努力量は割り引かない
  （完了の瞬間に報酬を置くのが正解）。変動比率強化+コレクションは最も消去されにくい
  動機構造で、天井（PITY_LIMIT=12）と初回保証（1日の最初のドロップはRARE4以上）で
  挫折と着手障壁を同時に手当てする。週次リセットは「毎週進捗を没収される」無自覚の罰
  だったため廃止。
- IP境界: Capcomの固有名詞・アセットは一切埋め込まない。移植したのは構造（受注→達成→
  剥ぎ取り/ドロップ→図鑑）、語彙の一般語部分（クエスト/素材/RARE/調査）、および
  雪原×炉の火のトーンのみ。素材名は全てオリジナル。
- 実装詳細:
  - 効果音は音声アセットゼロのWeb Audio合成。全音Cメジャーペンタトニックの単一
    パレットで、レアリティは同一上昇モチーフの延長（認知一貫性・ランダム疲れ防止）。
    1アクション=最大「音1+動き1+振動1」。localStorageでミュート永続化、振動も連動。
  - 押下エフェクトは全ボタン共通の `btn-squish`（スプリング戻り）1種のみ。
  - ページ遷移は `next-view-transitions`（追加依存・約2kB）でハンターノート風の
    ページめくり。方向は `html[data-page-turn]` 属性でCSS制御。
  - パレットはフロスト（寒色ニュートラル+氷シアン`--frost`+レア金`--gold`）へ
    色相シフト。炉の火のオレンジ（primary/brand）は継続。
- 不採用案: 実IPアセットの同梱（権利リスク・公開リポジトリ）、ドロップの取り消し
  （無罰原則に反する）、完了毎の固定演出のみ（変動性がなく飽きる）。
- 将来見直し条件: T018（バウンティボード+出発ボタン+ストリーク保険）実装時に
  ドロップ率・天井値を実使用データで再調整する。

## D-023: プロダクト名変更 — Grimoire（旧 Task Plant）+ アイコン刷新
- 日付: 2026-07-19
- 対象: branding / assets / infra
- 決定: プロダクト名を「Grimoire」へ変更。適用範囲は package.json name、PWA表示名
  （manifest name/short_name、layout metadata title/applicationName/appleWebApp.title —
  スマホのホーム画面に表示される名前）、README、CLAUDE.md/CONTEXT.md ヘッダ、
  verify バナー、GitHubリポジトリ名（snowtone-ai/task-plant → snowtone-ai/grimoire、
  旧URLはGitHubが自動リダイレクト）。歴史的記録（decisions の過去エントリ、tasks.md の
  過去行、docs/implementation-plan.md）は証跡保全のため書き換えない。
- アイコン: 手描きSVG（public/icon.svg）を新規作成 — 凍夜の紺グラデーション地に、
  フロストシアンの雪ルーン円環と炉の火の宝珠を戴く魔導書、金の留め具、エンバーの栞。
  既存の sharp パイプライン（scripts/gen-icons.mjs）で 192/512 + maskable 2種を再生成。
  Canva生成ではなくSVG手描きを選択（リポジトリ内で再現可能・依存最小・ベクター原本）。
  sharp は require されていたのに未宣言だったため devDependency として明示追加。
- 併せて修正: gen-icons.mjs の maskable 変換が背景rectごと0.8倍縮小して外周10%が
  透過になる潜在バグを、背景フルブリード+コンテンツのみ縮小に修正。
- ローカルフォルダ名（プロダクト/task-plant）はセッション稼働中のためリネーム不可。
  ユーザーがセッション終了後に手動でリネームする（HANDOFF-JA.md 参照）。
- Vercelプロジェクト名は変更しない（ユーザー決定 2026-07-19）: 名称変更は本番URL
  =IndexedDBのオリジンを変え、スマホ内の全データが到達不能になるため現状維持。
- 将来見直し条件: なし

## D-024: アイスボーン・ビスタ — フロントエンドのアートディレクション
- 日付: 2026-07-19
- 対象: ui / art-direction
- 決定: 調査（渡りの凍て地=雪原・氷窟・温泉の共存 / セリエナ=雪夜に灯る地熱と炉の
  琥珀光 / MHW UI=暗色パネル+金琥珀ハイライト+儀礼的欧文）に基づき、以下を実装:
  - 大気レイヤー: body::before の固定背景1枚に「オーロラ(frost)+紫のフリンジ+
    地平線下の炉火(brand)+夜藍グラデ」を集約。ライトは「陽光の雪原」バリアント。
    各画面ルートは透過にしてカードが空に浮かぶ構成。
  - 金の飾りヘアライン: ヒーローカード上辺・下部ナビ上辺・図鑑セクション見出し下。
  - 欧文ディスプレイ書体: Cinzel（next/font、latin 600/700のみ）をオーバーライン
    （GRIMOIRE / FIELD MAP / BOTANICAL LAB / SURVEY NOTES）と QUEST CLEAR バナー
    限定で使用。和文は従来のシステムサンセリフ（可読性優先）。
  - 主要CTA: エンバーグラデ+インセットハイライトで「炉の火」の質感。進捗リングは
    金→琥珀のグラデストローク。
  - 雪: 研究所画面のみ、8粒の低速CSS降雪（開花写真中と reduced-motion では非表示）。
- 抑制ルール: 環境演出は「背景1枚+ヘアライン+書体+雪(1画面)」に限定し、
  カード・リスト・フォームは無装飾を維持（ランダム刺激疲れの防止）。
- 不採用案: 全画面パーティクル常時表示（過剰刺激）、和文へのディスプレイ書体適用
  （JPグリフ非対応・可読性低下）、backdrop-blurのカード全面適用（低価格帯Android
  でのスクロール性能劣化）。
- 将来見直し条件: 実機で降雪・大気レイヤーの体感性能に問題が出た場合

## D-025: 報酬ステージ2 — 調査依頼（バウンティ）+ 出発ボタン + ストリーク保険
- 日付: 2026-07-20
- 対象: reward / domain / ui
- 決定: 段階導入プランのステージ2として以下を実装:
  - 日替わり調査依頼3件（出発1件 / 達成N件 / 追加1件）。N は日付キーの決定的ハッシュで
    1-3を選択（同じ日は何度開いても同じ依頼=信頼性、日ごとの変動=新奇性）。達成した
    依頼は既存の grantDropForTask 経路で**自動受給**し、受給ボタンを置かない
    （ADHDに「受け取り操作の記憶」を要求しない）。
  - 受給台帳は新テーブルを作らず、drops の一意インデックス &[taskId+dateKey] に
    `bounty:<id>` を taskId として記録して兼用。**DB v4 不要**（マイグレーション
    リスクゼロ）。ドロップは没収しない無罰原則をそのまま継承。
  - 出発ボタン（Footprints）: 未完了カードに配置。タップ=着手宣言のみで、完了もタイマーも
    要求しない。ADHDの遅延割引研究が示す「着手そのものが最大の障壁」への直接介入。
    記録は当日限りの localStorage（`departed-<date>`）— 失っても永続価値が
    無いデータをIndexedDBに入れない。
  - ストリーク保険: calcStreakCount を pure domain 関数へ抽出。今日の未完了は猶予
    （フリーズ非消費）、連鎖ごとに1日のフリーズが欠落日/未達成日を吸収、2連続ギャップで
    停止。Duolingo の streak freeze に倣った無罰設計で「1日の失敗=全損」を廃止。
- 不採用案: バウンティ専用テーブル+DB v4（一意インデックス兼用で十分・移行リスク回避）、
  受給ボタン式（操作記憶の要求は着手障壁の再生産）、出発状態のIndexedDB永続化
  （翌日に意味を持たないデータの永続化はノイズ）。
- 将来見直し条件: 依頼の種類を増やす場合（カテゴリ別依頼など）は claimId 名前空間を
  `bounty:` 配下で拡張する。

## D-026: JSONバックアップ — オリジン移行を安全化するエクスポート/インポート
- 日付: 2026-07-20
- 対象: data-integrity / ui
- 決定: /book 画面末尾に ARCHIVE カードを追加し、tasks/streaks/plantState/drops の
  4テーブルを versioned JSON（app:"grimoire", version:3）でエクスポート/インポート
  できるようにする。インポートは形状検証（日本語エラー）→ 件数を明示した確認UI →
  単一トランザクション内 bulkPut upsert。既存データは削除せず、drops は
  [taskId+dateKey] で重複排除し auto-increment id を剥がして取り込む。
- 採用理由: Vercelプロジェクト名変更を見送った根本理由が「オリジン変更=IndexedDB
  全損」だったため（D-023）。バックアップがあれば将来の独自ドメイン移行・端末変更・
  ブラウザデータ消去のいずれにも耐えられる。ローカルファーストPWAの唯一の
  データ保全手段。
- 不採用案: クラウド同期（サーバーレス方針に反する・認証が必要）、自動定期
  バックアップ（ファイルシステムアクセスが必要でPWA制約が大きい。手動導線で十分）。
- 将来見直し条件: DBスキーマが v4 になった場合は parseBackup の版数許容範囲を更新する。

## D-027: カレンダー刷新 — 調査記録ヒートマップ（残り火の狩猟記録）
- 日付: 2026-07-21
- 対象: ui / calendar / reward-concept
- 背景: カテゴリ分類（生活/大学/就活）を撤廃（b31d66e）した結果、カレンダーの各マスから
  カテゴリ色ドットが消え、タスクがある日でも日付の数字しか出ず「タスクの有無すら分からない
  空白」になっていた。FIELD MAP 画面が受動的な未来タスク閲覧専用に退化していた。
- 第一原理: カレンダーの本質的価値は「時間軸」であり、永続利用アプリで最も長生きする
  データ構造。ここを既存のアイスボーン風「調査記録」テーマ（D-022）の時間軸ビューに使えば、
  使うほど価値が増す資産になる。
- 3スケルトン比較の結論（採用: 残り火ヒートマップ）:
  - A 残り火ヒートマップ（GitHub貢献グラフ×MHW狩猟記録×Apple Fitness）＝採用
  - B 単純なドット復活 → 「有効活用」「永続価値」を満たさず不採用
  - C ドロップ宝の地図 → /book と重複し、ドロップ日以外は空白のまま不採用
  Aのみがユーザーの4要件（空白解消/画面の有効活用/永続利用のクリエイティブ/調査記録テーマ）
  を同時に満たし、既存トークンのみでDBマイグレーション不要。
- 決定:
  - 過去/今日のマスを、その日に「完了したクエスト数」（＝努力の日 completedAt スライス）に
    応じた残り火（--brand）濃度で塗る。tier 0-3（0/1/2-3/4+）を color-mix で 0/18/30/42% に
    マップ。上限を 42% に固定し、両スキームで日付数字(--foreground)のコントラストを維持
    （D-024 の環境演出抑制ルールにも整合）。tier3 のみ内側に残り火リング。
  - 予定/未完クエストのある日は霜シアン(--frost)の小ドット＝「ここにクエストがある」affordance
    復活（過去・未来問わず）。カテゴリドット撤廃で失われた「タスクの存在表示」を意味を変えて再建。
  - グリッド下に「SURVEY LOG」統計ストリップ（討伐/活動日/予定 + 通算件数）を追加し、
    タップ前でも画面単体で物語を語る（有効活用）。通算は tasks の completedAt から導出（plantState
    の lifetimeCompleted はドリフトが既知のため不使用 = T017 レビュー指摘の回避）。
  - ドメインは純粋関数（buildCalendarSummary / summarizeCalendarMonth / completionHeatLevel）
    に切り出し node:test で検証。dead code だった buildCategoryDotMap と空の all-constants.ts を撤去。
- 罰則なし原則の遵守(D-022/D-025): 過去の未完了を赤で咎めない。過去は達成の記録として温かく
  光るだけ（期限切れの警告は従来どおりリスト表示側に限定）。
- IP境界: 構造（記録の蓄積可視化）と一般語彙（討伐/調査記録）のみ。固有名詞・アセットは不使用。
- 将来見直し条件: 反復タスクの過去完了履歴を残す設計（現在は completedAt が最終完了日のみ）を
  導入する場合、ヒートマップの完了カウント源を drops 履歴等へ拡張する。

## D-028: 調査記録の永続化 — 季節で更新される「年代記」
- 日付: 2026-07-21
- 対象: reward / book / concept
- 背景: ユーザーの本質的懸念 =「報酬が短期前提で、いずれ飽きて着手インセンティブとして
  死ぬのでは」。第一原理: 有限カタログはコンプで終わり、固定報酬は快楽適応で必ず飽きる。
  習慣化に最も強いのは「新規性の定期投入」+「無限に積み上がる記録」。ユーザーは4案
  （自己ベスト/季節更新/人生目標接続/様子見）から「季節で新規性を補給」を選択。
- 決定: /book 調査記録の先頭に「CHRONICLE / 年代記」を追加。既存の12ヶ月植物テーマを
  時間軸に展開し、(1) 今月の調査対象（当月の花）を「調査中」ライブページとして提示＝
  毎月新しい対象が届く新規性、(2) 過去の月を討伐/希少/活動日つきの年代記カードとして
  新しい順に無限追記＝コンプの無い蓄積。全て drops（剥奪なしの永久記録）の dateKey/rarity
  から純関数 buildChronicle で導出し、DBマイグレーション不要。
- 実装: src/lib/domain/chronicle.ts（buildChronicle）、rewardDb.getChronicle、
  book-screen の ChronicleSection。当月ページの花は RARE4 絵文字で表現し、未発見の
  RARE8 写真をネタバレしない。
- 不採用: 自己ベスト主義（動く参照点／将来の拡張余地として保留）、人生目標接続
  （設計が重く抽象度が高い）、専用テーブル追加（drops から導出でき移行リスク回避）。
- 将来見直し条件: 年代記が長くなった場合の折り畳み／年区切り、または自己ベスト軸の追加。

## D-029: レアリティを正直な RARE 1-8 ラダーへ（歯抜け解消）
- 日付: 2026-07-21
- 対象: reward / drops / ui
- 背景: ユーザー指摘「RARE が 8 まであるのに 8 種類分ない（1/4/8 の飛び番）はおかしい」。
  実在ゲーム調査(MHW=本作アート元)で裏付け: MHのレアリティは連続ラダーで全ランクに実物が
  あり歯抜けなし。ガチャ調査では高レアほど指数的に低下＋天井が定石。
- 決定: レアリティを 1/4/8 の3段階から RARE 1-8 の全8段階へ拡張。後方互換のため既存の
  保存済みドロップ(rarity 1/4/8, id c-*/r-*/s-*)はランク据え置きで温存し、空いていた
  2/3/5/6/7 に新規の凍て地素材プールを追加（良質素材/結晶/特殊素材/貴重標本/秘蔵の遺物、
  計29種）。DropRarity 型を 1-8 に、DROP_CATALOG は 36→63 種。
- 確率設計（ガチャのカーブ準拠・単調減少・合計1）: 8:2.5% 7:3.5% 6:6% 5:9% 4:12%
  3:17% 2:22% 1:28%。天井(PITY_LIMIT=12→RARE8)と初回保証(1日最初はRARE4以上)は継続。
  pickDrop は POOL_BY_RARITY で全ランク対応、当月4倍重みは季節プール(4/8)のみに作用。
- 演出は「1動作1音・認識性」原則(D-022)を守り、8段階を3バケットに束ねる:
  playClear/fireDropConfetti/drop-reveal を低(1-3)/中(4-6)/高(7-8)で強度分け。
  バッジ配色は MHW のレアリティ色（低=白/緑→中=青/紫→高=琥珀/金）を本アプリの
  frost/gold/ember トークンへ翻訳し昇順化。図鑑は8セクションを config 駆動で描画。
- IP境界: 借用したのは構造（全ランク実装）と一般語（RARE/討伐/素材）のみ。素材名は全て
  オリジナル。Capcom の固有名詞・アセットは不使用。
- 将来見直し条件: 実使用データでレート/天井を再調整、または各ランクの素材数を拡充する場合。

## D-030: 家族マルチユーザー対応 — アーキテクチャは無変更、Geminiキーのみサーバー移設
- 日付: 2026-08-15
- 対象: architecture / api / security / deploy
- 背景: 開発者以外に家族2名がこのPWAを使いたいと申し出た。事前調査でユーザーに3問確認:
  (1) 各自が自分のスマホにインストール、(2) データはローカルのみ維持（クラウド同期は導入
  しない）、(3) Google連携も各自が自分のGoogleアカウントで使う——のいずれも「推奨」を選択。
- 発見: tasks/streaks/plantState/drops は Dexie(IndexedDB) でブラウザ単位に既に分離されて
  おり、Google OAuth(GIS)もトークンをメモリ保持するだけの端末単位フローだった。つまり
  「各自が別端末で使う」運用ならユーザー分離のためのコード変更は一切不要だった。
- 発見(Vercel MCP経由): SSO Protection が deploymentType=all で有効化されており、かつ
  本プロジェクトはカスタムドメイン未設定のため本番URL(task-plant.vercel.app)を含む
  全デプロイがVercelチームログインでガードされていた。家族は今のままでは開けない。
- 決定: Vercel の ssoProtection を deploymentType=preview に変更（本番のみ解除、Preview
  は保護継続）。これにより本番URLが公開状態になる副作用として、クライアントJSに直埋め
  されていた `NEXT_PUBLIC_GEMINI_API_KEY`(音声タスク解析・Gmail取り込みで使用)が誰でも
  抜き取れる状態になるため、新設の `src/app/api/gemini/generate` ルートへ両呼び出し口を
  移設し、キーをサーバー専用の `GEMINI_API_KEY` に変更(PR #19, T025)。
- 不採用案: クラウド同期(Supabase等)導入によるマルチユーザー化 → ユーザーが明示的に
  ローカルのみ維持を選択したため不採用。同一端末プロフィール切替UI → 各自が別端末を使う
  運用のため不要と判断。
- 未実施(人間の手動対応が必要、エージェントは非対応):
  1. Vercel の環境変数に `GEMINI_API_KEY`(現行キーと同じ値、`NEXT_PUBLIC_`なし)を
     Production/Preview両方に追加して再デプロイ — .env*の値はエージェントが読み書き禁止。
  2. Google Cloud OAuth同意画面の公開ステータス確認 — 「テスト中」の場合、家族のGoogle
     アカウントをテストユーザーとして追加しないとGmail/Calendar連携でログインできない。
- 将来見直し条件: 将来的に端末を跨いだデータ同期や引き継ぎが必要になった場合、クラウド
  同期(認証+DBスキーマ)の導入を再検討する。

## D-031: 素材カタログ5倍拡充(63→308種)と報酬ホットパスの脱フルスキャン
- 日付: 2026-08-15
- 対象: reward / drops / performance
- 背景: 日常的な長期使用でドロップの反復が目立つというユーザー要望。加えて家族2名が新規に使い
  始めるため、数年単位の使用に耐える設計かを事前に検証する必要があった。
- 決定(カタログ): 汎用ランクを全て拡充(RARE1 12→60, RARE2/3 6→44, RARE5 6→40, RARE6 5→34,
  RARE7 4→26)。合計 63→308種(約4.9倍)。名称・フレーバーは既存の凍て地調査ボイスを踏襲した
  オリジナルのみ(Capcom固有名詞は不使用)。
- 決定(RARE4の構造): RARE4は「初回保証(1日最初の完了はRARE4以上)」により最も目にするランクだが
  12種しかなく反復が最も強かった。`RARE_DROPS`(12種の正典)は不変のまま維持し(book-screenが
  月→絵文字マップをこれから導出しており、月あたり1件でなければ順序依存になるため)、採取形態違いの
  `RARE4_VARIANT_DROPS`(各月3種=36件)を追加、`RARE4_POOL`を新設して`POOL_BY_RARITY[4]`と
  図鑑のRARE4節に接続。当月4倍重みの比率(27%)は拡充前後で不変。
- 決定(RARE8): 写真実体が12枚しかないため12種のまま据え置き。季節の絶景=年間を通じた収集目標
  というD-028/D-029の設計意図を維持する。
- 決定(後方互換): 既存63件の id/name/emoji/color/flavor/rarity は1バイトも変更しない。これらは
  ユーザーのIndexedDB `drops` 台帳の外部キーであり、`getCollection`は解決できないidのレコードを
  黙って読み飛ばす=収集履歴の一部が消える。旧63 id全件をテストに固定し孤児化を防いだ。
- 決定(性能): `grantDropForTask`はタスク完了のたびに`db.drops.toArray()`で台帳全件を読み3回走査して
  いた。`drops`は追記専用でinstallの寿命だけ増え続けるため、使用年数に比例して完了操作が重くなる
  (実測: 8000件時点でスキャン部分だけで約45ms、インデックス版は約9ms、差は件数に比例して拡大)。
  天井カウンタ=rarityインデックス、初回判定=dateKeyインデックス、isNew=rarity絞り込みfilterに置換し、
  ホットパスから全件ロードを撤廃。カタログが5倍になったため`getDropById`もMap化
  (`getCollection`がレコード1件ごとに呼ぶためO(件数×カタログ)になっていた)。
- 決定(テスト): Dexieのクエリ記法はtypecheckで検証できないため、`fake-indexeddb`をdevDependencyに
  追加し報酬書き込みパスを実際に実行するテストを新設(付与/重複防止/天井/初回保証/isNew/
  全件ロードしないことの保証)。併せて3年分の使用シミュレーション(天井違反なし・全ランク出現・
  出現率・多様性・全アイテム到達可能性)を追加。
- 不採用案: `dropId`インデックスを追加するDexie v4マイグレーション → isNewを完全にO(log n)に
  できるが、実データに対するスキーマ変更のリスクに対し、rarity絞り込みで得られる改善で当面十分と判断。
- 副作用(意図的): 図鑑の収集率分母が63→308になるため、既存ユーザーの表示上の達成率は一時的に
  大きく下がる。収集目標が増えたことの正直な反映であり、隠さない。
- 将来見直し条件: RARE8の写真素材を追加できる場合、または実使用データで特定ランクの反復が
  再び目立つ場合。

## D-032: 報酬素材の世界観を単一モチーフから8地域の世界アトラス構造へ全面刷新(308→436種)
- 日付: 2026-08-15
- 対象: reward / drops / ui
- 背景: ユーザー指摘「今の報酬はランダムなアイテムに見える。地域・文化・文明・時代・歴史等の
  モチーフに沿って戦略的・構造的に構築すれば、アイテム同士に一貫性やストーリー性が生まれる」。
  ビジュアル面も「最新技術/UIを活かしたデザイン」への刷新を要望。事前確認でユーザーに3問確認し、
  「全面刷新して良い(既存308種のIDは維持不要)」「400-500種の最適な数は本エージェントが戦略的に
  策定」「上位レアリティ(RARE6-8)はAI生成イラストを追加」「設計から実装まで一気に今セッションで
  通す(予算超過リスクは許容)」のいずれも回答を得た。
- 決定(世界観): 単一の「凍て地調査」モチーフを、研究本部(引き続き凍て地)が世界8地域へ調査隊を
  派遣するという世界アトラス構造に拡張。8地域はいずれも実在の地域・文明・神話・歴史をモチーフに
  ファンタジー要素を統合したオリジナル設定(商標・固有名詞は不使用、D-029のIP境界方針を継続):
  frost(極北氷雪圏、既存モチーフを本拠地として温存)、aegis(陽光の地中海遺跡群)、
  caravan(大砂漠の隊商路)、canopy(密林の古代神殿)、lantern(東方古都の四季庭園)、
  grove(北方霧林の大樹)、savanna(大草原の王国跡)、tide(南海群島の潮流路)。
  新設 `src/lib/domain/regions.ts` が `RegionDef`(id/name/subtitle/blurb/accent)を保持。
- 決定(RARE4/RARE8は意図的に対象外): RARE4(月替わりの希少植物)とRARE8(季節の絶景写真)は、
  本部の「季節庭園(garden)」という別軸として温存し、id・名称・写真は1バイトも変更しない。
  理由は技術的制約: RARE8は実写真ファイル(`public/plant-rewards/`)に1:1で紐づき、RARE4/8は
  book-screenの月→絵文字マップや年代記(D-028)の土台であり、「作り直す」対象になり得ない。
  全面刷新の承認はランク1/2/3/5/6/7(地域素材)に適用した。
  訂正(2026-08-15 Tier2レビュー指摘): RARE4の12種canonicalとRARE8の12種(計24件、
  `rareFromSpecies`/`ssrFromSpecies`が生成)のflavor文のみ、世界アトラス化に合わせて
  「研究所で」→「本部で」「一面の」→「本部の庭に広がる一面の」と地の文を調整した。
  RARE4_VARIANT_DROPS(36件)のflavorは本当に無変更。id・名称・写真・月・色はこの24件も含め
  全60件が完全不変。
- 決定(規模): 400-500種の指示に対し436種(8地域×47種+季節庭園60種)を採用。地域ごとの内訳は
  RARE1:11 RARE2:10 RARE3:9 RARE5:7 RARE6:6 RARE7:4(地域あたり計47、8地域で376) +
  RARE4:48 RARE8:12(季節庭園、既存据え置き)。ランクが上がるほど地域あたりの点数が減る設計は
  「レアなランクほど選択肢を絞って特別感を保つ」というD-031の考え方を踏襲。frost地域の
  47種は、既存の308種から評価の高いものを選び再録した(flavor文はそのまま、id/regionのみ新規)。
- 決定(後方互換): 明示的に破棄。旧308件のidは1件も温存していない(D-031の「既存idは1バイトも
  変えない」方針からの意図的な転換)。ユーザーの承認理由: (1) 世界観そのものを変える規模の依頼、
  (2) 家族はまだ使い始めたばかりで蓄積が薄い。影響は把握済み: 旧idを参照する`drops`台帳の
  レコードは`getDropById`が解決できず`getCollection`が黙って読み飛ばす(既存の設計通りの
  縮退動作、クラッシュしない)。テスト`drop-catalog.test.mjs`の旧63id固定テストは削除し、
  代わりに構造的な不変条件(地域の実在性、ランクとgarden/expedition地域の対応、地域ごとの
  全ランク充足)を検証するテストに置き換えた。
- 決定(データ構造): `src/lib/domain/reward-catalog/{frost,aegis,caravan,canopy,lantern,
  grove,savanna,tide}.ts` に地域ごとのランク別配列(`FROST_RARE1`等)を分離し、`drops.ts`が
  importして結合。1ファイル400+件の一枚岩を避け、将来の地域追加・個別編集を容易にする狙い。
  `DropDef`に`region: string`を追加(garden/8地域のいずれか)。確率カーブ・天井・初回保証の
  ロジック(`decideRarity`/`pickDrop`)は完全に不変。
- 決定(ビジュアル): 画像アセットを増やさず、CSSのみで「現在の技術を活かした」デザインへ刷新。
  発見済みアイテムのカードに、アイテム固有色と地域アクセントカラーを`color-mix`で重ねた
  放射状グラデーション背景を適用し、フラットな単色丸アイコンから脱却。RARE6-8は地域色の
  発光ボーダー(box-shadow)を追加し箔押し風の質感を付与。カード左上に地域を示す小さなドット
  (スクリーンリーダー向けに地域名をsr-only/titleで併記)。図鑑冒頭に新設「EXPEDITIONS 遠征記録」
  セクション(8地域の横スクロールカード、地域ごとの発見数/総数)を追加し、ランク別セクションに
  地域という新しい閲覧軸を与えた。
- 不採用/未実施(AI生成イラスト、RARE6-8向け): ユーザーは上位レアリティへのAI生成イラスト追加を
  希望したが、本エージェントには画像生成ツール/APIキーへのアクセスがなく(`GEMINI_API_KEY`は
  `.env*`にあり読み取り禁止、画像生成モデルの呼び出しも今回の実行環境には未接続)、その場で
  生成することは不可能だった。`DropDef`に将来`illustration?: string`のような差し込み枠を
  追加することは可能だが、実データ生成は別途、ユーザー自身のキーで動かすスクリプトとして
  切り出すのが現実的(未着手・将来タスク候補)。当面はCSSベースの箔カードで代替。
- 将来見直し条件: 実際にAI生成イラストを追加する場合(別スクリプト+ユーザーのAPIキーが必要)、
  9番目以降の地域を追加する場合、または地域ごとのアイテム数バランスを実使用データで見直す場合。

## D-033: GitHub Dependabotアラート62件(High25/Medium33/Low4)を全件解消

- 日付: 2026-08-15
- 対象: dependencies / build / deploy
- 背景: PR #20マージ後、GitHubから default branch に62件のDependabotアラートが検出された旨の
  通知(push時のremote message)。全件がpnpm-lock.yaml上の間接依存で、直接依存としてはどれも
  package.jsonに現れない。ユーザーから全件対応の指示。
- 決定(shadcn CLIの依存ツリーを縮小): アラート最大の発生源は `shadcn`(shadcn/ui CLI、
  dependencies直下)経由の`@modelcontextprotocol/sdk`→`@hono/node-server`→`hono`鎖で、
  hono関連だけで約25件、加えてip-address/qs/body-parser/`brace-expansion`の1系統もこの鎖。
  `shadcn`パッケージ自体はCLIコード(コンポーネント追加コマンド)だが、`src/app/globals.css`が
  `@import "shadcn/tailwind.css";`でこのパッケージ同梱のプリセットCSS(デザイントークンの土台)を
  読み込んでおり、ビルドに必須と判明(削除して`next build`が壊れることを実地で確認、後述の
  トラブルシュートを参照)。パッケージ自体は削除できないため、`pnpm.overrides`でhono/
  @hono/node-server/ip-address/qs/body-parserの脆弱バージョンのみを個別にピン留めした。
- 決定(Next.js 16.2.11→16.3.1、eslint-config-next 16.2.2→16.3.1): postcss(8.4.31)と
  nanoid(3.3.16経由)、sharp(0.34.5)がいずれもNext.js自身が内部で要求するバージョンで、
  Next側が新しいパッチをリリース済みなら追従するのが本来の直し方だと判断。実際に16.3.1は
  postcss@8.5.23・sharp@^0.35.3を自ら要求しており、overrideなしでこの3件が解消した。
  eslint-config-nextはNextのメジャー/マイナーと揃えるのが通例のため同時に16.3.1へ。
- 決定(残りはpnpm.overridesでピン留め): 上記以外はすべてdev/build時のみ使われるツール
  (eslint本体・typescript-eslint・next-pwaのworkbox-buildビルドステップ)の間接依存で、
  実行時にブラウザへ配信されることはない。brace-expansionは呼び出し元のminimatchメジャー
  バージョンが3系/2系/5系の3系統に分かれており、一括overrideだと非対応バージョンを強制
  する恐れがあったため、`親パッケージ@バージョン>brace-expansion`の親スコープ付き
  override構文で系統ごとに個別ピン留め。fast-uri/js-yaml/serialize-javascript/
  @babel/core/@babel/plugin-transform-modules-systemjsも同様に親スコープを指定し、
  意図しない他パッケージへの波及を防いだ。
- トラブルシュート(記録価値あり): `shadcn`を一旦削除してから`^4.1.2`で入れ直したところ、
  semverの範囲一致で最新の`4.18.0`が解決され、そちらのパッケージには`dist/tailwind.css`が
  同梱されておらずビルドが壊れた(shadcn CLIが4.x系の途中でテンプレート配布方式を変更した
  とみられる)。教訓: 元のロックファイルが解決していた具体バージョンが暗黙の前提になって
  いる依存は、削除→再追加ではなく`package.json`側で完全一致バージョン(caret無し)に
  固定してから触るべき。`shadcn`は`"4.1.2"`(caretなし)に固定した。また`next`を16.3.1へ
  上げた直後、`.next`の古いTurbopackキャッシュが残っていたことが原因の別のビルド失敗
  (`shadcn/tailwind.css`解決エラー)も一度発生した。`.next`削除で解消し、パッケージの
  バージョンとは無関係な事象だったため、対応不要だった`tailwindcss`の追加バージョンアップは
  取り消し、元の`^4`のまま維持した。
- 検証: `pnpm audit`が0件になったことを確認(修正前は62件)。`pnpm verify`
  (lint/typecheck/58テスト/build)全緑。sharpの実動作は`next build && next start`後に
  `/_next/image?url=...`エンドポイントへ実リクエストし、200 + image/jpegでリサイズ画像が
  返ることを確認済み(next/imageの最適化パイプラインがsharp@0.35.3で実際に機能することの
  実地検証)。
- 将来見直し条件: 次にDependabotアラートが出た際、同じ`pnpm.overrides`ブロックへの追記で
  対応するか、根本パッケージ(shadcn/next-pwa等)のメジャーアップデートで自然解消するかを
  都度判断する。`shadcn`のバージョンを次に上げるときは、事前に`dist/tailwind.css`が
  同梱されているか(またはCSSの入手方法が変わっていないか)を必ず確認すること。

## D-034: カレンダー・調査記録のリセット機能 — /book ARCHIVEカードに追加
- 日付: 2026-08-15
- 対象: data-integrity / ui
- 背景: カレンダー（FIELD MAP）と調査記録（SURVEY NOTES/図鑑）はいずれも独自の永続状態を
  持たず、`tasks`+`streaks`（カレンダー）と`drops`（調査記録）から導出される表示のみ
  （D-027/D-032確認済み）。ユーザーからリセット機能の実装依頼があったが、範囲（何を消すか）
  が本質的に曖昧だったため、実装前にAskUserQuestionで4点を確認した。
- 決定(削除範囲): カレンダーのリセット = `tasks`+`streaks`を全削除（未完了の予定タスクも
  含む）。調査記録のリセット = `drops`のみ全削除。`plantState`（/plant画面の今月の植物成長）
  はどちらのリセットも対象外——ユーザーが明示的に選択しなかった範囲であり、拡大解釈しない。
- 既知の副作用（意図的に対応せず）: カレンダーのリセットで`tasks`を全削除しても
  `plantState.monthlyCompleted`は自動追随しない（`syncPlantStateFromTasks`は完了操作の
  たびに呼ばれる関数で、リセット操作からは呼んでいない）。したがって直後は「今月の完了数」が
  リセット前の値のまま残る。範囲外の変更として許容——次にタスクを1件完了すればその時点の
  `syncPlantStateFromTasks`呼び出しで実際のタスク数から再計算され、乖離は自己修復する。
- 決定(UI): 新規画面は作らず、/book の既存ARCHIVEカードの下に新設した「RESET」カードへ
  2ボタンを追加。安全策はユーザー選択どおり「件数確認+二重確認ダイアログのみ」（自動
  バックアップDLの強制はしない）——`task-edit-modal.tsx`のクエスト削除確認と同じ、
  ワンタップで警告パネルを開き二段目のタップで実行する2タップパターンを踏襲し、
  件数（例:「クエスト14件・ストリーク記録0件を完全に削除します」）を実行前に表示する。
- 決定(実装): `src/lib/taskDb.ts`に`getCalendarResetCounts`/`resetCalendar`
  （`db.transaction("rw", db.tasks, db.streaks, ...)`で両テーブルを`clear()`）、
  `src/lib/rewardDb.ts`に`getSurveyResetCount`/`resetSurveyNotes`（`db.drops.clear()`）を
  追加。両方とも`fake-indexeddb`で実際のDexie書き込みパスを検証するテストを追加
  （他方のテーブルに影響しないことも確認）。
- トラブルシュート(記録価値あり): `taskDb.ts`は自身の相対importに`.ts`拡張子を付けておらず
  （`from "./db"`等、`db.ts`/`rewardDb.ts`は`.ts`付きで統一済み）、Node組み込みテスト
  ランナーの型ストリッピングでは拡張子なし相対importが解決できず`ERR_MODULE_NOT_FOUND`に
  なることが、`taskDb.ts`を初めてfake-indexeddbテストからimportした際に発覚した
  （Next.js/webpackバンドルでは解決できていたため、テストが無い間は潜在バグとして
  気づかれなかった）。`taskDb.ts`の相対import4件に`.ts`拡張子を追加して解消。
- 不採用案: 自動バックアップDL強制（ユーザーが明示的に不要と回答）、専用設定画面の新設
  （工数増に見合う理由なし、ARCHIVEカードで十分）、native `window.confirm()`の追加
  （コードベースに前例がなく、既存の2タップ・インパネル確認パターンで十分と判断）。
- Tier 1 fresh-context Sonnetレビューで実バグを1件検出・修正: 削除が失敗した場合、
  `handleConfirm`のcatchでエラーメッセージをstateにセットしていたが、そのメッセージは
  折りたたみ後（`!confirming`）のDOM分岐でしか描画しておらず、失敗時は`confirming`を
  falseに戻していなかったため、ユーザーには何も表示されないまま確認パネルだけが
  静かに再操作可能に戻っていた（データは失われない=Dexieトランザクションのロールバックは
  正常だが、失敗が実質不可視だった）。開いたままの確認パネル側にも`aria-live`の
  メッセージ枠を追加して解消。
- 将来見直し条件: `plantState`もリセット対象に含めたい要望が出た場合、または
  リセット操作の頻度が実使用で見えてきた場合に、より強い安全策（自動バックアップDL等）を
  再検討する。
- 訂正(2026-08-15 Tier2レビュー指摘、マージ前に修正済み): 初版の`pnpm.overrides`に4件の
  堅牢性の問題があった。(1) `brace-expansion`の親スコープを`minimatch@3.1.5>`のように
  完全一致バージョンで書いていたため、次にminimatchがパッチリリースされて解決バージョンが
  ずれた瞬間、override が静かに無効化され脆弱版に戻る恐れがあった → `minimatch@3>`
  のようにメジャー範囲指定に修正。(2) `body-parser`と`ip-address`をbare(親スコープなし)
  overrideにしていたため、現時点では唯一のconsumer(それぞれexpress@5, express-rate-limit)
  にしか影響しないが、将来別のconsumer(express4系はbody-parser 1.x必須、socks系は
  ip-address 9系必須)が入った場合に非互換バージョンを強制する恐れがあった →
  `express@5>body-parser`、`express-rate-limit>ip-address`にスコープ。(3) `nanoid`の
  bare overrideはpostcss以外に将来consumerが増えた際に古い3系へ引き戻すリスクがあった →
  `postcss>nanoid`にスコープ。(4) 逆に`@babel/core`と`js-yaml`は本来木の中で単一メジアー
  系統しかない(それぞれdedupeで1バージョンに収束することを確認済み)のに複数の親スコープ
  overrideに分割していて冗長だった → それぞれ単一のbare overrideに統一。
  使い分けの基準(以後の追記もこれに従う): 対象パッケージが**同一ツリー内で複数の
  非互換メジャー系統**を持つ場合は親スコープ(かつメジャー範囲指定、完全一致バージョンは
  避ける)、**単一メジャー系統のみ**であることを`pnpm why`で確認できた場合はbareの
  グローバルoverrideでよい。

## D-035: pm-zero v11.1.1へのガバナンス移行 — グローバル(~/.claude)+プロジェクト双方を完全更新
- 日付: 2026-08-15
- 対象: process / security / governance（プロダクトコードは変更なし）
- 背景: `プロダクト/pm-zero` リポジトリに v11.1.1 と v11.2 の2版が存在し、どちらを本
  リポジトリの運用基盤とすべきか、ユーザーから選定+完全適用の指示があった。適用範囲を
  「プロジェクトのみ」か「グローバル(~/.claude、他の全プロダクトに影響)も含めて完全移行」か
  AskUserQuestionで確認し、ユーザーは「グローバルも含めて完全移行(推奨)」を選択した。
- 決定(版選定): v11.1.1を採用。v11.2はグラフ再構築(`graph.mjs`/`loop.mjs`等の新規
  メンテナンス対象スクリプト)を伴う設計変更であるのに対し、v11.1.1は既存ランタイムに対する
  「設定のみの真正化パッチ」で新規保守コードがゼロ。本リポジトリおよびユーザーの他プロダクトは
  いずれも個人利用規模であり、v11.2のグラフ機構が要求する規模に見合わないと判断した。
- 決定(グローバル ~/.claude、v11.1.1のP1-P7/A1-A6修正を適用):
  - P1: `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=1`(サブエージェントの再帰スポーンを禁止)。
  - P2: RTK(Rust Token Killer)を完全撤去。60-90%圧縮という主張がペア計測ベンチマークで
    否定されたため、CLAUDE.md/settings.jsonの両方から関連記述を削除。
  - P3: `CLAUDE_CODE_AUTO_COMPACT_WINDOW=188000`(絶対トークン数)を採用し、旧来の
    パーセンテージ指定オーバーライドを置き換え。
  - P4: モデル呼称をOpus 4.8→Opus 5に更新。Proプランでは200Kコンテキスト制約がある旨を
    明記。
  - P5: `permissions.allow: ["*"]`をbypassPermissions下でも明示。acceptEditsモードで
    動くサブエージェントは、たとえメインがbypassPermissionsでも個別に確認を要求し得るため。
  - P7(最重要のセキュリティ修正): `guard.mjs`にEdit/Write/MultiEdit/NotebookEditの
    経路を新設し、`.env`/`.env.*`への書き込みも読み取りと同じ正規表現でブロックするように
    した。従来はReadの二重ガードのみで書き込み経路が無防備だった——エージェントが`.env`を
    新規作成してステージする方が、実際に秘密情報を漏えいさせる失敗モードに近い。
  - A2: `PreCompact`フック追加。コンパクション前に`tasks.md`/`docs/state.md`/
    `docs/issues.md`を`--no-verify`でチェックポイントコミット。
  - A3: `StopFailure(rate_limit|overloaded)`フック追加。予算上限ヒット時も同様に
    チェックポイントコミットし、`docs/issues.md`に一行記録。
  - A4: `.claude/rules/*.md`(frontmatterの`paths:`グロブでマッチしたファイルを
    Claudeが読んだ時のみロードされる)を、パス限定のSelf-Evolutionルールの新しい置き場として
    導入。
  - A5: バージョン再確認のタイミングをSession Start/Version Policy相当のセクションに明記。
  - A6:「ペア計測での実測」原則をTooling節に明文化し、RTKのような未検証の圧縮率主張を
    根拠なく採用しない方針を残す。
  - fallbackModel: `["claude-sonnet-5"]`。ルーティング先モデル(Opusレビュー等)が
    overloadedのときのみ代替に入り、Proプランのレート制限では発火しない。
- 決定(プロジェクト側、task-plant): `CLAUDE.md`をv11.1.1へ全面書き換え(ヘッダ改版、
  Continuity/Autonomy/Self-Review/Self-Evolution/Shell/Version Policy各節を更新、RTKの
  行を完全削除)。`.claude/settings.json`は不正な`"Bash(rm -rf:*)"`(コロン構文の誤り、
  一度もマッチしないデッドルールだった)を`"Bash(rm -rf *)"`に修正し、Edit/Write版の
  `.env*`拒否ルールを追加、`CLAUDE_AUTOCOMPACT_PCT_OVERRIDE`を
  `CLAUDE_CODE_AUTO_COMPACT_WINDOW`に置換。
- 決定(メモリ層境界の即時適用): 両CLAUDE.mdが定める「ファイルパスに紐づく事実は
  プロジェクト横断のauto-memoryではなく、そのプロジェクトの`.claude/rules/*.md`に置く」
  というルール自体をこの移行で新設したため、既存のクロスプロジェクトauto-memoryに
  混入していたtask-plant固有の教訓(node:testの相対import拡張子問題)を新設した
  `.claude/rules/tests.md`へ移設し、`MEMORY.md`の対応行と旧メモリファイルを削除した。
- 不採用案: v11.2の採用(グラフ再構築コストに見合う規模がない)、プロジェクト限定の
  適用(ユーザーが明示的にグローバル込みの完全移行を選択したため不採用)。
- 情報共有(修正はせず、範囲外として記録のみ): `~/.claude/settings.local.json`に
  スキーマ上無効な`permissionMode`トップレベルキーが残存している。ユーザーレベルの
  `settings.local.json`は読み込み階層に含まれない(仕様上、無効化されている可能性が高い)ため、
  実害は乏しいと判断し、今回の明示的なファイルセット(グローバル/プロジェクトのcore
  governanceファイル)には含めず修正しなかった。
- 将来見直し条件: Codex等の第二エージェントを再導入する場合、または将来pm-zeroの
  次版が出て台帳/フック責務がさらに変わった場合に再度この節を更新する。

## D-036: VoC分析に基づく演出方針 — 不具合は直し、好みだけを設定にする
- 日付: 2026-08-16
- 対象: ux / ui / notifications
- 背景: ユーザーから6件のVoC（「通知機能が欲しい」「もっと頻繁に何か見たい」「操作のたび
  一瞬キラッと」「タスクしないと花火上がらないんでは、ちと寂しい」「ラインスタンプの動くやつは
  押したら何回でも動く」「紙吹雪が短くて、絵の下の説明を読む前に画面が消える」）が提出された。
  PdM/UXとして分類したところ、6件のうち2件は要望ではなく**不具合**だった。
- 判定1（不具合）: 締切通知はコード上存在する（notifications.ts / sw.js / F-7）が、
  構造的に発火しない。(a) `sw.js`の`setTimeout`はService Workerが数十秒のアイドルで
  停止した時点でタイマーごと破棄されるため、数時間後の9:00まで生存しない。
  (b) `notifications.ts`の`if (todayAt9 > now)`により、朝9時を過ぎてから開いた日は
  **翌日分も含めて一切スケジュールされない**。ユーザーの「通知機能が欲しい」という
  事実認識のほうが正しかった。vision.mdのASSUMPTION（影響度MEDIUM）は「ブラウザが
  閉じていたら届かない可能性」と書いていたが、実際は**開いていても届かない**——前提が
  過小評価されていた。
- 判定2（不具合）: `drop-reveal.tsx`の自動消滅は2000-3400msだが、その間に
  QUEST CLEAR/画像/レア度バッジ/NEW/名前/flavor text/記録メッセージの7要素を
  読ませる設計になっている。加えてオーバーレイ全体の`onClick={onDismiss}`がカード本体を
  含むため「読もうとして触ると消える」。ユーザーの報告は感想ではなく仕様欠陥の正確な記述。
- 判定3（本質課題）: 残るVoCはすべて同一の課題の言い換え——**「達成の報酬」は作ったが
  「接触の報酬」を作っていない**。演出の発火点は事実上`handleToggle`の1箇所だけで、
  同一タスクは1日1ドロップのため、1日の快感の総量がタスク件数で上限になる。
  「タスクしないと花火上がらないんでは、ちと寂しい」はこの構造の正確な指摘であり、
  求められているのは報酬の**豪華さではなく頻度**。
- 決定（設定にするものの判別基準）: ユーザーから「演出を個別にON/OFFできる設定画面」の
  提案があったが、そのままは採らない。基準を2つ置く。(1)「OFFにした人が損をするか？」
  Yesなら設定にしない（直す）。(2)「2人のユーザーが正反対の正解を持つか？」Noなら
  設計者がデフォルトを決める。→ ドロップカードの尺と通知の発火は**設定にせず直す**
  （T031）。効果音・バイブ・演出強度・朝の環境演出は**設定にする**（T032/T033）。
  設定画面は壊れたものを隠す場所ではない。
- 決定（設定のかたち）: 個別トグルを並べる案は却下。理由は2つ——(a) N個のトグルで2^N状態、
  さらに`prefers-reduced-motion`との優先順位を全組合せで決める必要があり現実的に
  テストできない。(b) より本質的に、コアペルソナはADHDであり、選択肢を10個並べた設定画面は
  このアプリのターゲットに対してだけは特に逆効果（F-2 Must NOT「登録に3タップ以上」と
  同じ精神）。→ 演出強度を**セグメント1本の3段（しずか/ふつう/にぎやか）**に集約し、
  質の異なる独立トグル（効果音・バイブ）だけを別に置く。
- 決定（設定画面は演出と無関係に単独で正当化される）: ホームには既に`FxToggle`がヘッダに
  常駐し、`NotificationPanel`の「🔔 通知が有効です + テスト通知を送る」が閉じるまで
  今日のクエスト一覧の上に居座っている。これは演出の議論とは無関係に、今この瞬間、毎日
  F-1「開いた瞬間に今日やることを把握」を阻害している。/settings はこれ単独で正当化される。
- 決定（図鑑リプレイが本命）: 「ラインスタンプは押したら動く」がVoC中で最も価値の高い示唆。
  /book の記録済みエントリをタップすると`DropReveal`が再生される。**報酬を新規に増やさずに
  接触頻度を上げられる唯一の道**であり、レア度インフレを起こさず（D-032の436種の希少性設計と
  衝突しない）、ユーザーが能動的にタップした結果なので割り込みではなくF-1にも非干渉。
  したがって演出強度に含めず「しずか」でも常時有効とする。
- 不採用/変形: 「開くたびに必ず何か飛び出す」は**変形採用**——F-1 Must NOTに正面衝突する
  ため割り込みモーダルは作らず、割り込まない「朝の環境演出」に落として「にぎやか」に入れる。
  トグルにしても却下のまま（ONにした人にとってもF-1を壊すため）。**トグルは実装の質を
  救わない**。「ランダムに新規報酬が飛び出す」は保留——変動比率強化は有効だが報酬の新規供給を
  増やすとRARE価値が薄まる。まず図鑑リプレイで頻度欲求が満たされるか観測する。
- デフォルト値の責任: 設定画面を作っても大多数はデフォルトのまま使う。したがって
  「ふつう」の中身が今回のVoCへの本当の回答であり、設定画面はその逃げ道であって代替では
  ない。既定は「ふつう」——マイクロインタラクションと図鑑リプレイは入れ、朝の環境演出は
  入れない。
- 副作用対処: `NotificationPanel`をホームから撤去すると通知許可を求める導線が消える。
  F-7 Must NOT「初回起動時に即表示してはいけない（価値を体感した後に許可を求める）」を
  守るため、初回の全クエスト達成直後に1度だけホームで提示し、以降は/settingsからのみとする。
- 設定値の永続化: 既存の`isFxEnabled`と同じlocalStorage層。IndexedDBマイグレーション不要。
  T021のJSONバックアップには**含めない**——端末固有の好みであり、移行先で選び直すほうが自然。
- VoCの限界（明記）: n=1、かつvision.mdが定義するコアペルソナ（ADHD就活中の大学生本人）
  ではない第三者の声である。コアペルソナ本人からのVoCはまだ1件も取れていない。
- 将来見直し条件: 図鑑リプレイ出荷後に同じ発話者へ再ヒアリングし、「もっと見たい」が
  満たされたかを確認する。満たされない場合にのみ、保留したランダム新規報酬を再検討する。
  通知は起動時キャッチアップ（サーバ不要）で1週間運用し、実際に使われるかを見てから
  Web Push + VAPID + Cron + 購読保存バックエンドという純増インフラ投資の是非を判断する。

## D-037: pm-zero v11.1.1 -> v12へのガバナンス移行 — プロジェクト側完全適用
- 日付: 2026-08-16
- 対象: process / governance（プロダクトコードは変更なし）
- 背景: `プロダクト/pm-zero`リポジトリの`pm-zero-knowledge-v12.md`がv12をリリース済みで、
  ~/.claude配下(グローバル)は既にv12へ移行済みだった(env二値化、deny再編、
  `effortLevel`撤去、hooks三本、`~/.claude/CLAUDE.md`書き換え——本セッション開始前に
  完了済みで、このタスクの対象外)。ユーザーから「pm-zero-knowledge-v12.mdに従い、この
  リポジトリの該当箇所を全て更新せよ、余計な変更は禁止」との指示があり、v12文書
  Section 14「Migration from v11.1.1」の残項目(6-8, いずれもプロジェクト側)を本
  リポジトリに適用した。
- 決定(v12憲法の適用): 「configの値・scriptのexit code・hookのいずれかでない限り
  ルールとして採用しない」というv12の唯一の制約に従い、CLAUDE.mdからprose-onlyの
  ルールを実行可能な形へ置換した:
  - Startup Readにdocs/issues.mdを追加(Section 14項目7)。現在ブロック中のものだけを
    残す運用に変更したため、解決済みだったI-001(Service Worker cache.addAll問題、
    根本原因はD-003で既に恒久記録済み)をdocs/issues.mdから削除。
  - Budget/Continuity: 「1セッション1タスク」を撤廃(v12 Section 5: 長時間セッションは
    キャッシュ課金上むしろ安い)。auto-compactの機構を
    `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=70`から絶対トークン数`CLAUDE_CODE_AUTO_COMPACT_WINDOW`
    (グローバルで400000済み)へ全面移行——v12文書はPCT_OVERRIDEを「閾値を上げられず、
    モデル上限前にコンパクションするセッションにしか効かない」既知の欠陥として記録して
    いる。
  - Self-Review: Tier 2を完全撤去(v12 Section 8: auth/billing/DB schema/production data
    クラスは本プロジェクト規模では実質発生しないため、4か月・18プロジェクトの実績で
    一度も発火の痕跡がないTierを維持するコストが正当化できない)。
  - Self-Evolution: 4つの昇格先(このファイル/`.claude/rules/*.md`/`docs/lessons.md`/
    auto-memory)を1つの機械判定ループへ集約(v12 Section 9: 「機械で検出できるか」
    →YESならscripts/verify.mjsへチェックを追加、NOなら`.claude/rules/<zone>.md`に
    `paths:`と`由来:`付きで記録)。`docs/lessons.md`は本リポジトリに元々存在せず
    (Section 14項目8は本リポジトリでは対象なし)、`AGENTS.md`も同様に存在しない。
  - Git: マージゲートの文言を「final verify green + self-review passed」から
    「CI green」へ変更(v12 Section 7/12: 自己申告のローカルverifyはマージ根拠になり
    得ない。GitHub上のCIだけが偽装不可能)。
- 決定(.github/workflows/ci.yml新設、Section 14項目6・本リポジトリが名指しされた項目):
  scripts/verify.mjsと同じ4チェック(lint/typecheck/test/build)をGitHub Actions上で
  実行するワークフローを追加し、branch protectionで必須化した。pnpm/action-setup +
  actions/setup-node(Node 24、ローカル環境と合わせる)+ `pnpm install --frozen-lockfile`。
- 決定(.claude/settings.json、v12文書には明記されていないが直接起因する不具合修正):
  プロジェクト側の`permissions.deny`が`Read(**/.env.*)`のような包括パターンで
  `.env.example`まで巻き込んでブロックしていた——v12文書Section 4/11が明記する
  「`.env.example`除外はdeny構文では表現できないため、`.env.*`ファミリーはhook
  (guard.mjs)側に一任し、deny側は個別ファイル名で狭く書く」という設計と正面から矛盾
  する実装ミスだった。グローバル側は既にこの設計でv12移行済み(狭いdeny + guard.mjsの
  例外処理)のため、プロジェクト側の重複かつ矛盾するdeny/envブロックを撤去し、
  `{"permissions":{"defaultMode":"bypassPermissions"}}`のみに縮小してグローバルの
  deny+hookへ完全に委譲した。同時に、既にPCT_OVERRIDEの機構的欠陥を理由に撤去対象だった
  `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE`の`env`キーも削除。
- 決定(バージョンラベルのみの更新): docs/repo-map.mdとtasks.mdの見出しにあった
  「pm-zero v11」表記をv12に更新。tasks.mdの過去行(T001-T033)は証跡としてそのまま
  保持し、書き換えない。
- 決定(範囲外だが必須だったtest修正、CIが初回実行で発見): 新設したci.ymlの初回実行で
  `tests/lib/domain/plant.test.mjs`の`toLocalDateString is timezone-safe`テストが
  GitHub ActionsのUTCランナー上で失敗した(80件中1件)。原因はテスト側がJSTホスト前提の
  期待値をハードコードしていながらプロセスのtimezoneを固定していなかったこと——
  オーナーのローカル機がJSTだったため今まで一度も顕在化しなかった、まさにv12
  Section 7が「自己申告のローカルverifyはCIの代替にならない」と述べる典型例。
  ガバナンス移行タスクの範囲(「余計な変更は禁止」)を厳密に超えるが、このタスク自身が
  新設した「CI green」マージゲートを満たせなければセッションを完了状態にできないため、
  最小の修正(`process.env.TZ = "Asia/Tokyo"`をそのテストファイル冒頭に固定)のみ実施。
  `toLocalDateString`本体はクライアントPWAの「今日」をホストのローカルタイムゾーンで
  判定する設計として正しく、変更していない。`TZ=UTC node --test`で80/80通過を確認。
- 不採用案: プロジェクト側`.claude/settings.json`にグローバルと同一のdeny一覧を
  再度複製すること(グローバルのdenyは`bypassPermissions`下でも全モードで発火する
  ため、プロジェクト側での複製は保守対象が二重化するだけで実効的な追加保護にならない
  と判断)。
- 将来見直し条件: pm-zeroの次版が出て台帳/hook責務がさらに変わった場合、または
  auth/billing/DB schemaクラスの変更が実際に発生してTier 2相当のレビューが必要になった
  場合に再度この節を更新する。

## D-038: 背景の光の粒子演出 — D-024の「全画面パーティクル不採用」を条件付きで再解禁
- 日付: 2026-08-17
- 対象: ui / art-direction / fx
- 背景: T036（エフェクト全面刷新）でユーザーから「研究所以外のページの背景に、
  エルデンリングの祝福の導きのような光の粒子エフェクトを出したい」との依頼があった。
  D-024（2026-07-19）の抑制ルールは「環境演出は背景1枚+ヘアライン+書体+雪(1画面)に
  限定」し、不採用案として明示的に「全画面パーティクル常時表示（過剰刺激）」を挙げていた。
  今回の依頼は文面上その不採用案そのものに見えるため、単に上書きするのではなく何が
  違うのかをここに記録する。
- 決定: `src/components/fx/grace-particles-gate.tsx`を`layout.tsx`に追加し、
  `/plant`以外の全ルートに疎らな金色の粒子（12-16粒、20-27秒サイクル、上昇+緩い
  横揺れ）を背景レイヤー（`body::before`/`.morning-light`と同じ`z-[-1]`層）として
  表示できるようにした。D-024の不採用案との違いは4点: (1) 常時ON/デフォルトではなく
  「背景の光の粒子」トグル（既定OFF、D-039参照）による完全なオプトイン。(2) `/plant`は
  対象外——同ページには既に下降・冷色（白/霜）の雪が8粒あり、今回の粒子は上昇・暖色
  （金）にすることで方向と色温度を意図的に対比させた（単なる「ごちゃつき回避」ではなく
  主題的な対比: 研究所は静かな観測の場、それ以外は導きの光に満ちた道）。(3) 粒子数は
  既存の雪と同水準の疎らさ（8-16粒）に抑え、confetti的な密度にはしない。(4)
  `transform`/`opacity`のみのCSSキーフレームアニメーション（雪と同じ技法）で、
  D-024が明示的に禁じた`backdrop-blur`の広域アニメーションには該当しない——粒子1つ
  あたりの静的（非アニメーション）`blur(0.5px)`のみで、低価格帯Androidでの負荷は
  雪と同等と判断した。
- 不採用のまま残る部分: D-024の抑制ルール本体（背景1枚+ヘアライン+書体+雪1画面という
  デフォルト構成）は変更しない。今回追加したのはデフォルトに含まれない、ユーザーが
  明示的に選び取る第5の環境演出であり、既定の見た目には一切影響しない。
- 将来見直し条件: 「背景の光の粒子」のON率が実際の利用で著しく低い場合、実装コストに
  見合うか再検討する。逆に高い場合は`/plant`にも別テーマ（例: 静止した淡い光）を
  検討する余地がある。

## D-039: 演出強度ダイヤルを廃止し、効果ごとの独立トグルへ — D-036の一部を上書き
- 日付: 2026-08-17
- 対象: ux / ui / fx / settings
- 背景: D-036（2026-08-16）は「しずか/ふつう/にぎやか」の3段階ダイヤル1本に集約する
  設計を採用し、個別トグルを並べる案を明示的に却下していた。理由は2つ: (a) N個の
  トグルで2^N状態爆発、(b) コアペルソナ（ADHD）にとって選択肢の多い設定画面自体が
  逆効果。T036でユーザーから「大規模刷新でエフェクト構成自体が大きく変わるため、
  設定画面を0から再構築してよい。しずか/にぎやかという分類は廃止し、それぞれON/OFFで
  選べるようにしてほしい。デフォルトはADHDのタスク管理に最適化し、演出を楽しみたい人は
  全部ONにすればよい」との明示的な指示があった。
- 決定: `src/lib/domain/fx.ts`を全面書き換えし、`FxIntensity`(3段階)を
  `EffectKey`(6キー: タップの光/完了エフェクト/朝のあいさつ演出/起動時の演出/
  背景の光の粒子/ページごとの遷移演出)の独立ON/OFFへ置き換えた。効果音・バイブレーション
  は既存どおり`sound.ts`の独立トグル（`fx-enabled`）のまま——今回のQ&Aでも
  reduced-motionに連動させない設計は明示的に維持されている。
- D-036の却下理由への応答: (a) の2^N状態爆発は、トグル数を「効果の種類ごとに1つ」
  ではなく「アプリ内の意味のある瞬間ごとに1つ」に絞ることで実質的な組合せは
  ユーザーにとって意味を持つ範囲に収まる（6キー、うち新規の重い4つは既定OFFなので
  実際に大多数のユーザーが触れる状態はデフォルトの1状態のみ）。reduced-motionとの
  優先順位は全キー共通で「reduced-motion時は常に強制OFF」という単一ルールに統一した
  ため、全組合せを個別にテストする必要はない（`resolveEffect`のテストが全キー×
  reduced-motion true/falseの2値を機械的に検証）。(b) の決定疲れへの懸念は、
  設定画面を「基本のフィードバック」（デフォルトON寄り、3行）と「追加の演出」
  （デフォルトOFF、"演出をもっと楽しみたい方はこちら"という一言リードで導入、4行）の
  2セクションに分けることで対処した——デフォルトのまま使う人は何もスキャンする必要が
  ない設計は維持している。
- 図鑑リプレイの扱いは不変: D-036の「ユーザーが能動的にタップした結果なので割り込み
  ではなくF-1にも非干渉、よって常時有効」という理由は今回のQ&Aでも覆っておらず、
  どのトグルにも属さず常時有効のまま。
- 起動時の演出（当初「スプラッシュ画面」と呼んでいたもの）について: ユーザーは当初
  D-036のF-1保護原則（開くたびに何か飛び出す演出は割り込みモーダルとして不採用、
  非ブロッキングの朝の環境演出に変形採用）との関係を尋ねられ、「起動時の演出を出すのは
  にぎやか（今回はトグルON）を選んでいるユーザー自身なので、豪華にしてよい」と明示的に
  F-1保護をこの機能に限り緩和する判断を下した。したがって`open-flourish.tsx`は
  タップ/Escでスキップ可能だが、コンテンツの読み込みをブロックしない設計（オーバーレイ
  のみ、`{children}`は裏で即座に読み込み継続）にとどめ、待たせる設計にはしていない。
  また、当初「アイコンを使ったスプラッシュ画面」を想定していたが、ユーザーからの訂正
  「アイコンとは無関係でよい、豪華な演出を出したいだけ」を受けて、ロゴ/アイコン中心の
  reveal演出ではなく金の装飾フレーム+光の粒子+一言メッセージという構成に変更した。
- 不採用のまま残る部分: D-036の「(1) OFFにした人が損をするか、(2) 2人のユーザーが
  正反対の正解を持つか」という設定化の判別基準そのものは今回も適用している——ドロップ
  カードの尺や通知の発火のような「不具合」は今回も設定にしていない。今回変わったのは
  「好み」に分類される演出をどう提示するか（1本のダイヤル→複数の独立トグル）だけで、
  判別基準自体は継続。
- 将来見直し条件: 実際の利用で「追加の演出」セクションのONトグル数が著しく多い/少ない
  場合、デフォルトの妥当性を再検討する。トグル数がさらに増える見込みが出た場合は、
  再びダイヤル化やプリセット化（「まとめてON」ボタンなど）を検討する。

## D-040: T036 Tier 1レビュー指摘への対応 — 5件の修正 + 2件の受容済みトレードオフ
- 日付: 2026-08-17
- 対象: ux / a11y / fx
- 背景: T036のTier 1フレッシュコンテキストレビュー（Opus 5）が、reduced-motion時に
  RARE6-8のドロップカードへ白い光の帯が焼き付いたまま残る不具合（FAIL判定）と、
  4件のshould-fix指摘を検出した。オーナーからは「残りの問題も全て対応せよ」との
  指示があり、Tier 1の残りのminor指摘（11件）のうち9件も併せて修正した。
- 修正した項目（コード変更）: (1) `.drop-reveal-shine`のreduced-motion時
  `opacity: 0`欠落を修正。(2) `open-flourish.tsx`のsessionStorage確保をuseEffect本体
  ではなくマイクロタスク内に移し、React 19 dev/StrictModeの二重マウントで演出が
  一度も表示されない不具合を修正。(3) `docs/repo-map.md`の記述をD-039の6トグル
  モデルに更新。(4) 旧`fx-intensity`キーからの一度限りの移行処理を追加
  （quiet→全OFF、lively→全ON、normal→タップ/完了のみON、いずれも新6キーが
  未設定の場合のみ適用）。(5) 完了エフェクト演出（spring/shine/glow/rank8粒子）を
  `completion`トグルでもゲートするよう修正——ただしreplay（図鑑タップ再生）は
  D-036の「常時有効」原則によりトグルではなくreduced-motionのみでゲートする
  （`fireReplayEffect`も同様に修正、confetti.tsのゲートを`isEffectEnabled`から
  `prefersReducedMotion`直接参照に変更）。加えて: ページ別遷移音がreduced-motion時に
  無音化していた問題を修正（音はトグルの保存値のみで判定し、reduced-motionは視覚側
  のCSSテーマのみに残す）。起動演出のEscapeスキップとフェードアウトが実際には
  機能していなかった問題を修正（`<button>`直下の暗黙フォーカスに依存していたのを
  `autoFocus`付きの明示的なスキップボタンに変更、`return null`の瞬間消去を
  クロージングフェーズ付きの遷移に変更）。起動演出の`<button>`によるブロック
  要素ラップ+`aria-label`によるAT向けコンテンツ抑制を修正し、`role="dialog"
  aria-modal`+可視テキストがそのままAT到達可能な構造に変更。ライトテーマで
  起動演出の金色フレーム/タイトルが常に暗い背景に対して低コントラストになっていた
  問題を修正（`.open-flourish`スコープで`--gold`をダークモード相当の明るい値に
  固定——背景は常に`bg-black/70`でテーマに依存しないため）。タップの光の
  `animationend`リスナーがバブリングで最初に終わった子要素（モート、0.4s）に
  反応し、コア閃光（0.42s）を20ms早く消していた問題を修正（コア要素へ直接
  リスナーを付け替え）。`rarityBand()`が定義済みだが未使用だった問題を解消し、
  `sound.ts`の`playClear`のランク分岐（旧: `rarity<=3`/`rarity<=6`のハードコード）
  を`rarityBand()`経由に統一。`EFFECT_KEYS`の「設定画面の表示順」というコメントが
  実態と食い違っていた（settings-screen.tsxが独自にハードコードした2つのリストを
  持っていた）問題を、`EFFECT_SECTIONS`という正準の割り当てマップに置き換えて
  解消し、`tests/lib/domain/fx.test.mjs`に「全キーが必ずどちらか一方のセクションに
  属する」ことを検証するテストを追加した（将来7個目のキーが追加された際、
  設定画面に行が出ないまま出荷される事故を機械的に防ぐ）。plant/allテーマの
  ページ遷移が、戻り方向ナビゲーション時にbackルールの`transform-origin: right
  center`を意図せず継承していた問題を修正（両テーマとも純粋なscale演出なので
  `transform-origin: center center`を明示）。
- 受容済み・未修正のまま残す指摘（2件、いずれもconfetti.ts関連）: (a) 紙吹雪の
  本バーストが予備振動パフの40ms後に発火するようdeferredになった結果、その40ms
  以内に画面が閉じられるとバーストが飛ばれる可能性がある——発生確率が極めて低く、
  修正するとanticipation演出自体（本レビューが評価した「juice」の核）を取り除く
  ことになるため受容する。(b) 旧「にぎやか」ユーザー向けの2波紙吹雪機能が
  固定値化により失われ、代替トグルもない——これは意図的なアーキテクチャ選択
  （D-039本文参照: 強度スケーリングの廃止はトグル数抑制とセットの設計判断であり、
  紙吹雪の波数だけ個別に復活させると同じ2^N問題を部分的に再導入することになる）
  なので、機能追加ではなく本エントリへの明記をもって対応済みとする。

## D-041: Grimoire v2 着手 — 環境準備(Blender/BlenderMCP)を機械的に自動実行

- 日付: 2026-08-19
- 対象: infra / tooling / v2-kickoff
- 背景: 現行Grimoire(v1)を土台に、3D相棒(グリモ)+Three.js背景世界を持つv2をほぼ
  ゼロから作る方針。設計資料は `grimore-v2/` 配下の3ファイル(決定事項ログ統合版、
  Three.js設計文書、UIコンポーネントサイト集)としてリポジトリに追加。決定事項ログの
  P章「次のアクション」に列挙された5つの機械的セットアップ作業について、当初は
  「手順提示のみ」で計画したが、オーナーから「手順提示ではなく実行可能な方法を
  探して実行せよ」と明示指示があり、自動化可能な範囲を全て自動実行した。
- 決定(ブランチ): `chore/v2-env-setup` を `main` から作成。v2は「ほぼ0から」の
  大規模刷新のため、今後の実装は既存のtasks.md/docs/*ledgerの流儀を維持しつつ、
  機能単位でさらに枝分かれさせる想定(このブランチは環境準備のみに限定)。
- 決定(Blender): `winget install BlenderFoundation.Blender.LTS.4.5` で
  Blender 4.5.10 LTSをサイレントインストール(exit 0で確認)。5.x系の最新版ではなく
  4.5 LTSを選んだ理由: 決定事項ログP章が明示的に「Blender 4.x」を要求しており、
  ahujasid/blender-mcp addonのbl_info最小要求も`(3, 0, 0)`以上でLTS 4.5との
  互換性リスクが最も低いため。
- 決定(BlenderMCPアドオン): `github.com/ahujasid/blender-mcp` の`addon.py`を
  ダウンロードし、`blender --background --python <setup script>` でheadless実行し
  `bpy.ops.preferences.addon_install` + `addon_enable` を実施、
  `bpy.ops.wm.save_userpref()`で永続化を確認(次回Blender起動時に再インストール不要)。
  同スクリプト内で `bpy.context.scene.blendermcp_use_polyhaven = True` を設定し
  `bpy.ops.wm.save_homefile()` で既定の起動ファイルとして保存したため、PolyHaven
  連携は次回Blender起動時点で既にONの状態になる。**唯一自動化できなかった手順**:
  addon自身が`--background`モードでの明示的なガード
  (`"cannot start server in background mode... run Blender with a GUI"`)を持つため、
  ソケットサーバーの起動("Connect to Claude"ボタン)はBlenderのGUIを開いた上で
  ユーザーが1回クリックする必要がある(サーバーはBlenderのイベントループに依存し、
  `--background`終了と同時にプロセスごと消えるため、原理的にheadless自動化不可)。
- 決定(Claude Code側MCP登録): `claude mcp add --scope project blender -- uvx blender-mcp`
  でこのプロジェクトの`.mcp.json`(既存の`.gitignore`ルールにより追跡対象外、
  そのままで正しい)に登録済み。`claude mcp list`は`⏸ Pending approval`と表示——
  これはClaude Codeの新規プロジェクトMCPサーバーに対する標準の一度きり承認ゲートで、
  次回`claude`起動時にユーザーが承認すれば解消する(セキュリティ上、エージェント側で
  バイパスすべきではない)。
- 決定(CC0四足リグ済みベースモデル): Sketchfab API(`api.sketchfab.com/v3/search`)を
  license=cc0で複数クエリ試行した結果、"downloadable かつ CC0 かつ実際にリグ済み
  (animCount>0)"の四足生物はほぼ皆無と判明(該当ヒットは考古学スキャン/彫像が
  大半で、リグ済み創作モデルは大半がSketchfab Storeの有料コンテンツかCC-BY)。
  代わりに `Quaternius` の "Animated Animal Pack"(poly.pizza経由、CC0確認済み、
  Idle/Walk/Run/Jump/Deathアニメーション付き、FBX/glTF/Blend形式)を発見——
  Shiba Inu・Husky・Wolf・Foxを含み、L章のロードマップ最優先である犬(水属性)の
  参考/叩き台として直接使える。ダウンロード自体はオーナー指示どおり次セッションの
  選定判断に委ねて未実施、候補提示のみに留めた。
- 不採用: Mixamo(人型リグ中心で四足動物に非対応)、Sketchfab Storeの有料
  リグ済みモデル(予算0円方針(G章)に反する)。
- 将来見直し条件: BlenderのGUI起動+ソケットサーバー接続をオーナーが実施した後、
  `claude mcp list`でblenderが`✔ Connected`になることを次セッション冒頭で確認する。
  Quaternius以外の候補(CGTrader等)が必要になった場合、同じCC0/商用可の判定基準で
  追加調査する。

## D-042: Grimoire v2 — 犬系グリモ(水属性)デザイン仕様確定 + MHW参照画像ポリシー転換

- 日付: 2026-08-19
- 対象: design / assets / legal-risk / v2-kickoff
- 決定:
  1. 犬系グリモ(水属性)の卵〜成体デザインを確定
     (`grimore-v2/Grimoire_決定事項ログ_統合版_20260819.md` L-2章に記載)。
     卵=氷/水晶の半透明殻、幼体=まん丸プニプニ+耳/尻尾先端のみヒレ/水滴状+
     周囲の波紋エフェクト、子供=幼体の延長で体型のみ成長、成体=オオカミ/
     ハスキー系ベース+体全体の水色〜青グラデーション。トーンは卵〜子供の
     「かわいい」路線から成体で「かわいい+かっこいい」の融合へ転換。O章の
     最優先未決定事項を解消。
  2. Monster Hunter World: Iceborneの参照画像8枚について、旧方針(アート
     ディレクション参照限定・最終素材への使用不可)を撤回し、**背景世界
     (相棒+世界画面の環境)の素材として元画像をそのまま使用する**方針へ
     転換。グリモ本体(生物)には適用しない(C章の背景/生物レイヤー分離を維持)。
- 採用理由: (1)は相談セッションでの分解質問(卵の質感/幼体のファンタジー
  要素の宿し先/成長のプロポーション変化/成体のベース犬種/色の主張度/
  子供段階の性格)への回答を統合。(2)はオーナーへ法的リスクを2回明示提示
  した上での採用: 本アプリは家族2名も利用中(D-030)のため「自分専用だから
  私的使用の複製特例が及ぶ」という前提は厳密には成立せず、Three.jsでの
  加工は複製に留まらず翻案に該当しうる。著作権侵害は親告罪のため摘発
  リスクは低いが、ゼロではないことを伝達済み。オーナーはリスクを理解した
  上で明示的に採用を選択した。
- 不採用案: MHW画像を完全に不使用としオリジナル素材のみで背景世界を
  構築する案(A章の旧方針) → オーナーが「元画像をそのまま使いたい」と
  明示選択したため不採用。
- 将来見直し条件: 著作権者からの指摘があった場合、または本アプリの公開
  範囲が家族以外へ広がる場合は再検討する。犬グリモのデザインは、次段階
  (表情・模様の入り方・サイズ感等のディテール)を詰める際に細部を追記する。
