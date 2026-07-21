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
