# Grimoire Product Atlas

別の AI モデルが、このファイルだけを読んで Grimoire のプロダクト、実装、データ依存関係、外部連携、主要パイプライン、検証境界を把握するための自己完結型システム地図。

- 調査基準日: 2026-09-13 JST
- 対象: このリポジトリの現行コードと設計文書
- 正式名称: Grimoire（旧 Task Plant / Focus Task Manager）
- 想定利用者: Android Chrome の PWA を主に使う個人利用者。1人用で、端末内データを基本とする
- 公開先: Vercel（既定の確認 URL は `https://task-plant.vercel.app`）
- この文書に含めないもの: API キー、OAuth トークン、`.env.local`、個人データ、秘密情報

## 1. プロダクトの要約

Grimoire は「今、何をすべきか」を瞬時に把握する個人向けタスク管理 PWA である。タスクは UI 上ではクエストと呼ばれ、完了すると素材ドロップ、植物の成長、ストリーク、音・触覚・視覚フィードバックが発生する。Gmail や Google Calendar は任意の入力源であり、データの正本はブラウザ内 IndexedDB である。

設計原則は次のとおり。

- オフラインファースト: CRUD と報酬・植物の主要機能はネットワーク不要
- 即時報酬: 完了操作の直後にドロップと演出を返す
- 無罰: ドロップは取り消さず、タスクの未完了化で報酬を没収しない
- 変動と一貫性: RARE ラダー、固定された音色/演出文法、月ごとの植物で継続を支える
- 外部境界の限定: Gemini は固定された用途だけを受け付けるサーバープロキシ、Google OAuth は読み取り専用スコープ
- 可逆性の確保: バックアップ取り込みは upsert のみ。リセットだけが明示的な破壊操作で、二段階確認を要求する

## 2. 技術構成

| 層 | 現行実装 | 主な責務 |
|---|---|---|
| Web app | Next.js 16.3.1 App Router / React 19.2.4 / TypeScript 5 | ルート、SSR、クライアント画面、API route |
| UI | Tailwind CSS v4、Radix UI、lucide-react、class-variance-authority | UI primitives、ダイアログ、フォーム、レスポンシブ表示 |
| 永続化 | Dexie.js 4.4.2 / IndexedDB | tasks、streaks、plantState、drops |
| PWA | `@ducanh2912/next-pwa`、`public/sw.js`、manifest | install、cache、オフライン静的資産 |
| 演出 | Web Audio、Canvas/WebGL1、VFX sprite、CSS | 音、ハプティクス、素材演出、WebGL 魔力オーブ |
| 外部 API | Google Identity Services、Gmail API、Google Calendar API、Gemini API | 任意の外部入力と AI 抽出/比較 |
| 検証 | Node built-in test、fake-indexeddb、Playwright、ESLint、TypeScript | domain/DB/API、実ブラウザ、品質ゲート |
| 配信 | Vercel | production hosting |

依存を追加する場合は `pnpm` のみを使い、`pnpm-lock.yaml` と `package.json` を一致させる。

## 3. ルートと画面

| Route | 画面 | 主要目的 | データ/操作 |
|---|---|---|---|
| `/` | Home / 今日のクエスト | 今日やることを確認・追加・完了 | `getTasksForDate`、task CRUD、drop grant、streak、bounty、通知 |
| `/all` | Calendar / List | 日付を横断して記録を閲覧 | カレンダー月サマリー、今日以降/全件リスト、選択日シート、Calendar import |
| `/book` | 調査記録（図鑑） | 取得素材と年代記を見る | `getCollection`、`getChronicle`、地域/アイテム探索、音付きリプレイ |
| `/plant` | 植生研究所 | 現在月の植物と成長を見る | `usePlant`、`plantState`、12種/4 archetype の SVG 表現 |
| `/settings` | 設定 | 表示・演出・連携・バックアップ・リセット | localStorage 設定、OAuth token、JSON backup、二段階 reset |

全画面は共有下部ナビ（Home / Calendar / Plant、Book/Settings への導線は画面構成に従う）を使う。`src/app/layout.tsx` は metadata、view transition、PWA 登録、グローバル演出と戻る履歴ブリッジのシェルである。

主要 UI ファイル:

- Home: `src/components/home/home-screen.tsx`, `task-card.tsx`, `task-add-modal.tsx`, `task-edit-modal.tsx`, `quest-add-button.tsx`, `voice-input-button.tsx`, `bounty-board.tsx`
- All: `src/components/all/all-screen.tsx`, `calendar-view.tsx`, `list-view.tsx`, `selected-date-sheet.tsx`
- Book: `book-screen.tsx`, `area-explorer.tsx`, `item-explorer.tsx`, `reward-art.tsx`
- Plant: `plant-screen.tsx`, `plant-renderer.tsx` と4 archetype の SVG component
- Settings: `src/components/settings/settings-screen.tsx`
- 共通: `src/components/navigation/bottom-nav.tsx`、`src/components/ui/*`

## 4. データモデルとスキーマ

IndexedDB の DB 名は `TaskManagerDB`。Dexie はブラウザで遅延 singleton 化され、SSR 中に IndexedDB を触らない。`src/lib/db.ts` が型と schema の source of truth である。

### 4.1 `tasks`

```ts
interface Task {
  id: string;                    // UUID。Calendar import では source key を安定 ID にする
  title: string;
  description?: string;
  dueDate: string;               // YYYY-MM-DD、ローカル日付意味
  dueTime: string | null;        // HH:MM。null は終日
  category: "job" | "university" | "life";
  completed: boolean;
  completedAt: string | null;    // ISO datetime
  recurrence: "none" | "daily" | "weekly" | "monthly";
  recurrenceDayOfWeek?: number;  // weekly only, 0=Sun..6=Sat
  recurrenceDayOfMonth?: number; // monthly only, 1..31
  createdAt: string;             // ISO datetime
  importSourceKey?: string;      // 現在は Google Calendar の stable identity
}
```

Index: `id`、`dueDate`、`category`、`completed`、`recurrence`、schema v4 から sparse unique `&importSourceKey`。

### 4.2 `streaks`

```ts
interface Streak { date: string; allCompleted: boolean }
```

主キーはローカル日付。ホームでその日の task state が変化した時に記録し、1件以上ある日の全完了を連続日数へ使う。今日が未完了でも朝から即座に鎖を切らず、1連鎖につき1日の保険を吸収する純関数がある。最大 400 日を lookback する。

### 4.3 `plantState`

```ts
interface PlantState {
  id?: number;                  // 現行 singleton は id=1
  monthlyCompleted: number;    // 現在のローカル月内の完了数
  monthKey: string;             // YYYY-MM
  lifetimeCompleted: number;
  lastUpdated: string;          // ISO datetime
}
```

成長は月次累積。週次リセットは廃止。`syncPlantStateFromTasks` が task 群から現在月を再集計するため、派生値が壊れても再構築できる。現行閾値は stage 0..5 に対して 0, 1, 3, 6, 10, 満開（stage 5 は 10 以上）。

### 4.4 `drops`

```ts
interface DropRecord {
  id?: number;                 // auto increment
  taskId: string;
  dateKey: string;             // ローカル YYYY-MM-DD
  dropId: string;              // catalog key
  rarity: number;              // 1..8
  at: string;                  // ISO datetime
}
```

Index: `++id`、`taskId`、`dateKey`、`rarity`、unique compound `&[taskId+dateKey]`。
`drops` は append-only。完了を取り消しても消えない。通常の task は同一 task・同一ローカル日で最大1 drop。daily bounty の claim ledger も `taskId` が `bounty:` で始まる drops を再利用する。

### 4.5 Schema migration

- v1: `tasks`、`streaks`
- v2: `plantState` を追加
- v3: `drops`、unique `[taskId+dateKey]`、月次 plant へ移行。upgrade で task から当月値を再計算し、旧週次フィールドを削除。既存データは消さない
- v4: `tasks.importSourceKey` の sparse unique index。既存の未 import task は変更しない

schema/identity を変更する場合の必須条件は、既存データ保持、replay、同時実行、rollback、backup 互換性を先に検証すること。

## 5. データ依存グラフ

```text
手動入力 ───────────────┐
音声認識 → Gemini parse ──┤
Gmail → Gemini extract ───┤→ createTask / importCalendarTasks → tasks
Calendar → normalize ────┘                                      │
                                                                │ 完了/未完了
                    ┌───────────────────────────────────────────┼───────────────┐
                    │                                           │               │
             recordStreak                                  syncPlant       grantDrop
                    │                                           │               │
                streaks                                      plantState       drops
                    │                                           │               │
             streak counter                              monthly plant  collection + chronicle
                    │                                                           │
              Home status                                              `/book`図鑑/年代記
```

派生関係の重要点:

- Home の表示タスクは `tasks` 全件を `doesTaskApplyToDate` で日付フィルタし、recurrence は表示日ごとに `taskForDisplayDate` で完了状態を投影する
- Calendar/List の完了ヒートマップは task 日付適用と完了数から算出する。カレンダーは drops ではなく task completion の記録を中心にする
- 植物は `tasks` の完了を再集計して `plantState` を同期する。plantState は現在表示のキャッシュ/状態であり、task が正本
- 図鑑/年代記は `drops` から導出する。catalog に存在しない古い dropId は collection 集計から安全に除外する
- `bounty` はタスク/完了/出発件数と `drops` の claim ledger を組み合わせる
- `departure` と設定、音、VFX、文字サイズ、テーマ、通知は主に localStorage/sessionStorage。バックアップ対象は IndexedDB の4 collection のみ

## 6. 主要パイプライン

### 6.1 手動タスク登録

1. Home の `TaskAddModal` または `QuestAddButton` が title、description、dueDate、dueTime、category、recurrence を収集
2. `createTask` が UUID と `createdAt` を付加して `db.tasks.add`
3. Home が再読込し、日付適用/時刻順で表示
4. 初回登録など bounty の `add` progress を再計算

### 6.2 音声タスク登録

1. `voice-recognition.ts` が Web Speech API の recognition session を開始
2. watchdog、mounted/session guard、明示 retry で停止・重複 result・timeout を制御
3. transcript を正規化し、空なら登録しない
4. client `parseTaskFromText` は最大 500 文字、`todayDate` とともに `/api/gemini/generate` へ `{kind:"voice"}` を送る
5. server route は free-form prompt を受けず、固定 `buildTaskParsePrompt` を生成
6. Gemini の JSON/コードフェンス/余分な文を抽出し、title、日付、時刻、カテゴリをローカル検証。title は最大120文字
7. 成功した `ParsedTask` を登録シートで確認し、`createTask` へ。失敗は invalid response / timeout / unavailable / quota / configuration を利用者向けに回復可能な表示へ変換

### 6.3 Gmail からの取り込み

1. `useGoogleAuth("gmail")` が GIS の readonly Gmail scope を取得
2. `gmail.ts` が Gmail API の inbox/messages を読み取り、件名・送信者・snippet を最大30件の bounded input に整形
3. `/api/gemini/generate` の `{kind:"gmail", messages}` が固定プロンプトで候補抽出
4. `gmail-task-extractor.ts` が候補 JSON を parse/validate
5. モーダルで候補を選択し、採用分を通常の task として保存。Gmail message ID による永続的な task identity は設計上の中心ではないため、再取得時は利用者確認を前提にする

### 6.4 Google Calendar 取り込み

1. `useGoogleAuth("calendar")` で `calendar.readonly` token を取得
2. primary calendar を取得し、今後の予定を `timeMin`、`singleEvents=true`、`orderBy=startTime`、最大30件で取得
3. `calendarEventToTaskData` が終日/時刻付き予定を task fields に変換
4. `calendarImportSourceKey` が `google-calendar:<calendarId>:<eventId>` を生成。calendar ID/event ID は検証・encode する
5. `planCalendarComparisons` が hard duplicate と意味的候補を分離。source key 完全一致は自動スキップ候補、同日で時刻が前後60分以内（またはどちらか終日）のみ比較対象。最大100 pair
6. 表現違いの候補は `/api/gemini/generate` の `{kind:"calendar-duplicates", pairs}` で Gemini に比較させる。返却 ID は入力 pair の許可集合に対して厳密検証
7. モーダルで選択/解除を利用者が確定。既存 task は削除・統合しない
8. `importCalendarTasks` が最大30件・入力 shape・category・recurrence・`google-calendar:` prefix を検証し、単一 read-write transaction 内で unique source key を再確認。既存は `skipped`、新規は `id=importSourceKey` で追加
9. replay と競合 tab の双方で duplicate を防止する。失敗時は transaction rollback で部分保存しない

### 6.5 タスク完了 → 報酬/植物/ストリーク

1. `toggleTaskComplete` が対象 task を読む。通常 task は boolean を反転、recurrence task は「今日 `completedAt` があるか」を反転する
2. 完了側なら Home hook が `grantDropForTask(taskId, today)` を呼ぶ。未完了化では drop を消さない
3. `grantDropForTask` は transaction 内で compound unique key を確認し、既存なら null。`rollsSinceSsr` と first-of-day を index で取得
4. `decideRarity` が RARE 1..8 を roll。12回 SSR なしなら pity で RARE8、当日最初の roll は最低 RARE4
5. `pickDrop` が rarity pool から素材を選び、当月 plant species に季節重みを与える
6. `drops.add` 後、`isNew` を返す。Home は rarity 対応の sound/VFX/drop reveal を表示
7. 当日 task の完了状況を `recordStreak`、今月完了数を `syncPlantStateFromTasks` に反映
8. 完了操作に失敗した場合は UI の busy/error state を維持し、二重クリックで二重 reward にならないようにする

### 6.6 Bounty / 出発 / streak insurance

- 日付 hash から deterministic に3件の daily bounty を作る: 1件出発、1〜3件完了、1件登録
- `bountyProgress` は入力値を clamp、完了すると既存の `grantDropForTask` 相当の drop pipeline に bonus を付与
- claim 済み判定は `drops` の `taskId=bounty:<date>:<kind>` を読む。別 claim collection を増やさない
- 出発は「タスクに取り掛かる」イベントで、日付単位の ephemeral localStorage。失っても durable data/報酬を失わない
- streak は今日未完の猶予と chain あたり1日保険を純関数で計算。ストリークのカウント自体は全完了日のみ増える

### 6.7 通知

`reminders.ts` は今日/明日の未完了 task から前日+当日リマインダーを組み立て、既定時刻は09:00ローカル。`notifications.ts` は Service Worker registration 経由で通知し、localStorage の delivered ledger を7日保持して重複を抑止する。初回起動で勝手に権限を要求せず、利用者の設定/明示操作から許可フローへ入る。

### 6.8 JSON backup

`buildBackupJson` は tasks、streaks、plantState、drops 全件を version 4 の JSON にする。`parseBackup` は app/version/配列/最低限の ID と date fields を検証し、現在より新しい version を拒否する。`importBackup` は4 collectionを1 transactionで bulkPut/upsertし、何も delete しない。同じ file の再取込は idempotent。auto-increment drop ID の衝突を避けるため drop は `[taskId+dateKey]` で照合し、id を外して追加する。

## 7. 報酬・植物・アセット

### 7.1 Drop catalog

`src/lib/domain/drops.ts` が全 catalog と抽選を持つ。RARE1/2/3、RARE4、RARE5/6/7、RARE8 の8段階。主な pool は次のとおり。

- RARE1/2/3/5/6/7: 10遠征地域（Frost, Aegis, Caravan, Canopy, Lantern, Grove, Savanna, Tide, Petal, Lullaby）の生成素材。別に本部の seasonal garden がある
- RARE4: 12か月の植物に対応する花と variant
- RARE8: 12か月の実写植物報酬（旧 plant reward photo）
- `PITY_LIMIT=12`、first-of-day minimum RARE4、当月 species weight `CURRENT_MONTH_WEIGHT=4`

地域定義は `src/lib/domain/regions.ts`、素材見た目は `public/item-rewards/manifest.json` と `public/area-heroes/`、カタログ別定義は `src/lib/domain/reward-catalog/*.ts`。

### 7.2 Plant

`PLANT_SPECIES` は1〜12月の植物を持つ。`PlantRenderer` が species と growth stage から `upright-flower`、`cherry-blossom`、`hanging-cluster`、`delicate-flower` の4型へルーティングする。stage 4 以上の粒子は Pixi 系 overlay/植物演出に接続される。植物は rewards の実写写真とは別の成長 UI である。

### 7.3 Audio/VFX/motion

- `sound.ts` / `domain/sound-cues.ts`: C ペンタトニックの Web Audio と同梱 cue assets、mute、haptic、初回 gesture unlock
- `vfx.ts` / `domain/vfx-scenes.ts`: sprite 加算合成の tap、add ripple、completion、all clear、replay、flourish、morning、page scenes
- `fx.ts`: 効果ごとの localStorage toggle、prefers-reduced-motion、旧 intensity 設定の migration
- `mana-orb.ts` と `domain/mana-orb.ts`: WebGL1 SDF の「露」オーブ。GPU/WebGL が使えなければ CSS ボタンへ fallback、タブ非表示/画面外/reduced motion では loop を止める
- `view-transition.ts`: ナビゲーション時の page-turn。演出 OFF は `data-page-plain` の軽い遷移にする
- `use-dialog-back-close.ts`: ダイアログの Android/browser Back を合成 history entry として処理し、通常の page Back と混同しない

設定は sound、haptic、各 VFX、page transition、base theme、text size（Normal/Large 125%）、notifications。設定値は IndexedDB backup には含めない。

## 8. 外部 API とセキュリティ境界

### Google OAuth

`src/lib/api/google-auth.ts` の scope は以下だけ。

- Gmail: `https://www.googleapis.com/auth/gmail.readonly`
- Calendar: `https://www.googleapis.com/auth/calendar.readonly`

GIS client ID は `NEXT_PUBLIC_GOOGLE_CLIENT_ID`。token は browser-side session/local storage の既存設計に従い、scope 別に取得・clear・revoke する。Google API 呼び出しは有限 timeout、HTTP error、token expiry を UI に回復可能な形で返す。

### Gemini

秘密の `GEMINI_API_KEY` は server route のみが読む。クライアントから free-form prompt relay にしない。`POST /api/gemini/generate` の許可された `kind` は `voice`、`gmail`、`calendar-duplicates`。

- route `maxDuration=60s`
- voice text 最大500文字、Gmail messages 最大30件、calendar pairs 最大100件
- response に request ID (`x-request-id`) を付与し、ログは request ID、kind、status、duration 等の secret-free metadata に限定
- client は `gemini-flash-latest` を第一候補、`gemini-3.5-flash-lite` を continuity fallback とする
- 各 model × payload を共通 time budget 内で試す。400/404 は payload/model fallback、429 は quota、credential error は早期終了、timeout/network/5xx は bounded retry
- voice の返却 JSON は日付の実在性、時刻範囲、カテゴリ、空タイトルをローカルでも検証する
- server の例外で request header/API key を serialize しない

## 9. Service Worker / PWA / オフライン

`src/app/manifest.ts` と icons が installable PWA を構成する。`src/components/pwa-register.tsx` が production service worker を登録し、waiting worker の更新を controller change へつなぐ。静的資産の cache は `public/sw.js` のルールに従う。ネットワーク依存の Gemini/Google import は失敗し、ローカル CRUD・既存 catalog/audio/VFX は可能な範囲で継続する。

cache では `cache.addAll` の一括失敗を避け、bounded cache の書き込み失敗で正常な network response を 503 に変えない。browser の storage quota、offline、autoplay、WebGL context loss、missing asset は recoverable fallback を持つ。

## 10. 現在のコード地図

```text
src/app/
  page.tsx, all/page.tsx, book/page.tsx, plant/page.tsx, settings/page.tsx
  layout.tsx, manifest.ts
  api/gemini/generate/{route.ts,gemini-client.ts}
src/components/
  home/ all/ book/ plant/ reward/ calendar/ gmail/ settings/ navigation/ ui/ fx/
  pwa-register.tsx
src/hooks/
  use-home-screen.ts, use-plant.ts, use-google-auth.ts
src/lib/
  db.ts taskDb.ts rewardDb.ts backup.ts notifications.ts sound.ts vfx.ts fx.ts
  mana-orb.ts voice-recognition.ts view-transition.ts errors.ts
  api/{google-auth,gmail,google-calendar,calendar-duplicates,gmail-task-extractor,gemini-prompts}.ts
  domain/{task-date,plant,drops,bounty,streak,chronicle,calendar-import,reminders,regions,category,fx,mana-orb,sound-cues,vfx-scenes}.ts
public/
  sw.js, icons/, audio/, vfx/, item-rewards/, area-heroes/, plant-rewards/final/
tests/
  lib/*.test.mjs, lib/domain/*.test.mjs, resilience/{core,campaign}.test.mjs
scripts/
  verify.mjs, check-production.mjs, resilience/, asset processing/validation scripts
docs/
  vision.md, state.md, decisions.md, repo-map.md, environment-inventory.md,
  asset-art-bible.md, asset-production-ledger.md, this file
```

責務分離のルール: `domain/` はブラウザ副作用なしの純粋ロジック、`lib/api/` は外部 API の境界、`lib/*Db.ts` は永続化、hooks はクライアント state/side effect、components は UI composition。新しい schema や domain 挙動には対応 test を追加する。

## 11. 検証と品質ゲート

標準ゲートは `pnpm verify`。`scripts/verify.mjs` が lint、typecheck、全 test、production build を順に実行する。

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm verify                 # 統合品質ゲート
pnpm test:resilience        # seeded local resilience campaign
pnpm check:production       # 配信 CSS/主要 production asset の照合
```

既存テストの責務:

- task DB / calendar import: fake-indexeddb、CRUD、recurrence、backup、replay/concurrency/rollback
- domain: plant、drops、catalog、rarity、bounty、streak、task date、chronicle、reminders、sound/VFX/mana orb
- Gemini: payload、parse、fallback、server contract、privacy-safe failure
- UI support: first route render、text size、voice recognition、sound preference
- resilience: duplicate action、lifecycle churn、network fault、quota/storage fault を seed `424242` 等で local のみ再現

UI変更ではコードだけで完了扱いにしない。対象 route を実ブラウザで操作し、320px/375px/414px と低い viewport、console error/warn、network、overflow、reduced motion、Back/Escape/close、失敗後 retry を確認する。production は deployment が Ready だけでは不十分で、主要 route/assets と `pnpm check:production` を確認する。

## 12. 重要な不変条件と回帰リスク

1. `TaskManagerDB` は端末正本。既存 task/streak/plant/drop を自動削除・自動統合しない
2. Calendar source key は stable かつ unique。replay/concurrent import で同じ予定を増やさない
3. `drops` は task の uncheck で revoke しない。同一 task・日付に二度の drop を許さない
4. Calendar import は all-or-nothing。部分保存と duplicate semantic suggestion の誤削除を避ける
5. Gemini key は client bundle/ログ/API response に出さない。入力上限と固定用途を維持する
6. Google scope は readonly。既存 OAuth 接続を別サービスへ切り替えない
7. 日付はローカル calendar semantics、timestamp は ISO。UTC 変換で日付をずらさない
8. recurring task の completed は日ごとの投影であり、単発 task と同じ意味ではない
9. reduced-motion、WebGL unavailable、audio autoplay blocked、offline、quota、missing asset はアプリを壊さず manual recovery を示す
10. UI の main action は1ページ1つ。下部ナビ、dialog Back、safe area、keyboard、contrast を壊さない
11. generated/vendor assets の出典とライセンスは `docs/asset-*`、`public/*/LICENSE*` を参照する

## 13. 変更時の最短読解順

1. `AGENTS.md`、`tasks.md` 先頭、`xp.md`
2. `docs/repo-map.md`、`docs/state.md`、`docs/decisions.md` の対象 decision
3. 変更対象 route/component と、そこから呼ばれる hook/lib
4. `src/lib/db.ts` と関連 domain/test（データ変更の場合は必須）
5. API 変更なら `src/lib/api/*`、`src/app/api/*`、関連 test と入力/失敗 contract
6. `pnpm verify`、必要な focused test、実ブラウザ smoke、production check

## 14. 既知の状態・未実装の境界

- 対象は個人1人用で、アカウント間の同期サーバーやマルチユーザー DB はない。端末間移行は JSON backup の手動交換
- Gmail/Calendar/Gemini は任意機能。未設定、権限拒否、ネットワーク失敗、quota をローカル task CRUD と分離して扱う
- 植物の満開後に「観察 milestone」を追加する案は提案段階で、現行の新機能ではない
- `grimore-v2/` の別キャラクター作業は現行 Grimoire 本体の実行経路ではない
- production の現在事実は `docs/state.md` を優先し、長期設計理由は `docs/decisions.md`、運用ルールは `AGENTS.md` を優先する

## 15. 参照元

この atlas は以下の現行ファイルから要約した。実装を変更する際は要約を鵜呑みにせず、該当 source を再確認する。

- `README.md`, `CONTEXT.md`
- `docs/vision.md`, `docs/repo-map.md`, `docs/state.md`, `docs/decisions.md`
- `src/lib/db.ts`, `taskDb.ts`, `rewardDb.ts`, `backup.ts`
- `src/lib/domain/*.ts`, `src/lib/api/*.ts`, `src/lib/gemini.ts`
- `src/app/api/gemini/generate/*`, `src/components/*`, `src/hooks/*`
- `package.json`, `scripts/verify.mjs`, `scripts/check-production.mjs`, `tests/`
