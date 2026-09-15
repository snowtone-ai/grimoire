# グリモ実装計画の品質調査

調査日: 2026-09-07 JST  
対象: `docs/grimo-final-spec.md` の製品実装工程 4〜11  
費用条件: 追加費用 0 円。既存の Chrome DevTools、Node、`@playwright/test`、`fake-indexeddb`、pnpm scripts だけを使う。依存追加、外部計測サービス、参加謝礼、有料作品の新規購入は前提にしない。

## 先に固定する合格条件

この調査の判定軸は、一般的なスコアを上げることではなく、最終企画の触れ合いが壊れず、端末内データを失わず、動きの苦手な利用者にも同じ価値が届くことに置く。

- 最初に見える反応は p95 100 ms 以内を仮目標にする（初回、連打、低性能条件を含む）。60 fps 相当を目指すが、数字だけで合否を決めない。
- 60 秒眺めても周期が露骨に揃わず、同種入力 10 回で同じ演技を続けない。連打で待ち行列を作らず、現在姿勢から中断可能に遷移する。
- 320 px、390 px、1280 px、低い横画面、大文字、キーボード、タッチ、音 OFF、`prefers-reduced-motion`、30 分放置、復帰、連続入力を通す。
- 初見協力者 5 名を目安に、4 名以上が 10 秒以内に触れ始めることを暫定ゲートにする。5 名の少数試遊から市場全体の優越は断定しない。
- console error/warn、未許可外部通信、未処理例外、HTTP 5xx、データ重複、データ削除を合格にしない。測定ログと協力者メモに個人情報を入れない。

企画の 30 秒入口は「0〜3 秒で目が合う → 接触直後に局所反応 → 3〜12 秒で個性ある返答 → 指を止めると寄り添う → 12〜30 秒は呼吸と環境」に固定する。最初はキャロルの 3 行為（つつく、ゆっくりなでる、押して待つ）だけを実装し、外観と手法が合格してから 5 体へ展開する。

## 現行コードとの接続

実装前に次の境界を守る。現在の製品にはグリモの触れ合い画面はまだなく、既存 `/plant` の植物画面を入口として保持しながら段階的に表示を移す計画である。

| 接続箇所 | 現在の役割 | 計画上の注意 |
|---|---|---|
| `src/app/plant/page.tsx`、`src/components/plant/plant-screen.tsx` | `/plant` を `PlantScreen` に接続。植物画像、進捗、`BottomNav` を表示 | グリモ画面の最初の試作はこの入口を保持し、既存データを読める状態で差し替える。既存の植物表示を先に削除しない |
| `src/hooks/use-plant.ts` | `plantState` を読み、月境界で `monthlyCompleted` を更新 | `loadPlantState()` は初回に `plantState` を作る。新画面の保存失敗表示が植物読み込みを壊さないよう、別の state/transaction 境界にする |
| `src/lib/db.ts` | Dexie `TaskManagerDB`、schema v1〜v4。`tasks`、`streaks`、`plantState`、`drops`。v4 で `&importSourceKey` を追加し、既存の `&[taskId+dateKey]` を保持 | 新しい相棒状態・思い出は v5 への加算的な object store とし、既存 store・index・row を変更削除しない。DB は browser-only lazy singleton (`getDb`) なので SSR で開かない |
| `src/lib/taskDb.ts` | タスク CRUD、繰り返し完了、植物同期、Calendar import、カレンダー reset | `importCalendarTasks()` と完了操作の transaction/idempotency を壊さない。グリモの入力をタスク達成や報酬に紐付けないという企画方針を守る |
| `src/lib/rewardDb.ts` | `drops` に一度だけ報酬を記録。transaction と複合 unique index を使用 | グリモの道具・反応を `drops` や通貨として再利用しない。`resetSurveyNotes()` は destructive なので実データで試さない |
| `src/lib/backup.ts` | `BACKUP_VERSION = 4`。全 store を JSON 化し、import は transaction + upsert、既存行を削除しない | 新 store を足すと backup version も上げ、旧 v4 payload を新 DB に取り込んでも新 store を消さない。将来版は `version > current` を拒否する現在の安全境界を維持する |
| `public/sw.js`、`src/components/pwa-register.tsx` | navigation は network-first 3 秒 timeout 後 cache fallback、hashed JS と `/audio` `/vfx` は cache-first。production で登録、dev では登録解除 | 初回オンライン訪問後に初めてオフライン再訪できる設計。初回インストール直後も完全オフラインと報告しない。SW cache version を上げ、旧 cache を消す前に fallback を確認する |
| `package.json` | `pnpm verify` は lint/typecheck/test/build。Playwright 1.62、`fake-indexeddb`、resilience scripts が既存 | 依存を増やさず、必要な検証は既存 `tests/`、`tests/resilience/`、`scripts/resilience/` に追加する。通常の製品検証は `pnpm verify` を通す |

## 8 手法と実装タスク

検証の実行範囲・回数・合否はtasks.mdの現行計画を優先する。以下の調査候補を全て追加実行しない。UIの設計基準はApple HIGとプロジェクト形状指定を維持し、W3C資料はアクセシビリティの技術的確認の補助とする。

### 1. 30 秒タスク試遊と入力別の行動観察

根拠補足: [GOV.UKのmoderated usability testing](https://www.gov.uk/service-manual/user-research/using-moderated-usability-testing) のDesign the tasks / Run a session / discussion guideを本文確認（2026-09-07）。答えを含めない課題、同じ説明台本、静かに観察して後から理由を聞く手法を採用。UIの意匠基準ではなく調査手順の参照。資料閲覧とローカルのメモは0円。5名・10秒・比較順の入替はGrimo固有の計画で、同資料が保証する数値ではない。

**技法。** 最終企画の 30 秒入口を台本にし、タップ、ゆっくりなでる、速くなでる、600 ms 前後の押下、離す、連続入力、道具を渡す、何もしない、キーボード代替の順で試す。協力者には先に操作を説明せず、「この画面で相棒と過ごしてください」だけを伝える。参照作とうちの試作は順番を入れ替える。画面録画は同意を得た場合だけ、メモは識別子なしで残す。

**実装タスク。** `docs/grimo-final-spec.md` §触れ合いの設計の閾値を入力 state machine の受入条件にする。最初はキャロルの 3 行為を対象に、接触位置、接触継続時間、移動量、速度、方向、直近反応を記録できる開発用診断だけを用意する。診断を本番データや外部送信にしない。顔周りを前景で隠さず、同じ操作に文字ダイアログを出さず、反応が失敗しても画面を閉じない。

**無料条件と合格。** 協力者は同意を得た無償の範囲に限定し、謝礼や有料参照作の購入を計画に入れない。初見 5 名中 4 名が 10 秒以内に触り始め、4 つの質問（すぐ通じる、反応の違いが自然、眺めるだけでも生きている、また触りたい）について具体的な違和感が未解決で残らないことを暫定合格とする。これは市場全体の品質証明ではない。

### 2. Performance trace と INP で最初の反応を測る

**技法。** Chrome DevTools Performance で Screenshots を有効にし、通常条件と CPU 4x、必要なら 20x slowdown で trace を取る。接触開始、最初の視覚反応、反応の頂点、余韻終了に `performance.mark()` を置き、Main thread の flame chart、Frames/FPS、style/layout/paint、JS の長い処理を同じ trace で確認する。INP はクリック・タップ・キー入力の次の paint までを対象にするため、反応の後の非同期 DB 完了を「最初の反応」と混ぜない。

**実装タスク。** touch handler は DOM 全体の再計算を避け、ポインタ座標更新を compositor で処理できる CSS transform と `requestAnimationFrame` の境界に置く。反応開始時に見える状態を先に commit し、保存・音・余韻を同じ同期処理に詰め込まない。既存の `src/lib/vfx.ts`、`src/lib/sound.ts`、`src/app/globals.css` の reduced-motion 分岐を再利用する。開発用 mark は本番ログ・外部 RUM に送らない。

**無料条件と合格。** Performance panel、`performance.mark()`、Chrome の FPS meter は標準機能で無料。各入力を 20 回以上、初回・連打・低 CPU で繰り返し、最初の見える反応 p95 が 100 ms 以下を仮ゲートにする。一般的な INP の「200 ms 以下は good」は補助指標として記録するが、企画の 100 ms ゲートを置き換えない。性能 trace はローカルのレビュー成果物にする。

### 3. Device Mode、狭幅、大文字、タッチ、reduced-motion の組合せ確認

**技法。** Chrome Device Mode で 320×（縦）、390×（縦）、1280×（横）と高さの低い横画面を確認し、Mobile/touch と Desktop/touch の両方を試す。Rendering drawer で `prefers-reduced-motion: reduce`、forced colors、必要に応じて contrast を emulation する。大文字は既存設定の `src/lib/text-size.ts` を使って切り替え、DevTools の viewport 変更だけを大文字確認の代わりにしない。Device Mode は実機の CPU/画面を完全再現しないため、最終候補は実 Android/iOS 1 台でも同じ操作を行う。

**実装タスク。** 4 層背景・相棒・道具・下部ナビの重なり順を狭幅で固定する。顔の周囲の余白、指の接点、キーボード用の同等ボタン、safe-area、横 overflow を確認する。`prefers-reduced-motion` では自動呼吸を静止または穏やかな opacity/色変化に置き換え、`src/lib/fx.ts` の stored preference と OS override の意味を混同しない。画面を非表示にしたときは `visibilitychange` で自動行動・粒子・音を止め、復帰後に重複 timer を作らない。

**無料条件と合格。** Device Mode と Rendering は Chrome 標準。すべての対象幅で水平スクロールなし、中心の相棒と主要な入口が見え、reduced-motion で大きな移動・点滅・音の自動再生がないこと。DevTools の emulation が実機の代替ではないという制限を記録する。

### 4. Lighthouse、Accessibility tree、キーボード手動監査

**技法。** DevTools Lighthouse の Accessibility を各 route で実行し、Elements の Accessibility tab で相棒、道具、切替、代替操作、dialog の role/name/description と source order を見る。Lighthouse の自動監査だけではキーボード操作や screen reader の実体験を判定できないので、Tab/Shift+Tab/Enter/Space/Escape とフォーカス可視性を手動で行う。利用可能な OS の読み上げでも主要入口を確認する。

**実装タスク。** 主操作は意味のある `<button>` とし、装飾レイヤーは `aria-hidden` にする。相棒の反応は視覚だけにせず、必要な場合は `role=status` の短い非侵入的な状態を設ける。道具のドラッグには「選択して渡す」同等経路を用意する。各 pointer target は WCAG 2.2 AA の 24×24 CSS px 以上と間隔条件を満たし、頻繁な主要操作は現行 UI の 40〜48 px を維持する。focus が相棒の絵や固定 nav に隠れないようにする。

**無料条件と合格。** DevTools Lighthouse/Accessibility tree、キーボード、OS の標準読み上げだけを使う。Lighthouse の高影響失敗 0、主要操作の accessible name あり、focus trap なし、Tab 順が視覚順と一致し、320 px および 400% 相当の reflow で機能欠落や二方向スクロールがないこと。自動スコア 100 を人間監査の代用にしない。

### 5. 既存 Playwright で状態遷移とオフラインを再現する

**技法。** 既存の `@playwright/test` で isolated BrowserContext を作り、`page.emulateMedia({ reducedMotion: "reduce" })`、`context.setOffline(true/false)`、trace/screenshots、role locator を使う。Service Worker を含む実際の offline は `serviceWorkers: "allow"`、route interception のネットワーク fault は Playwright が SW の通信を見落としうるため `serviceWorkers: "block"` の専用 context と分ける。

**実装タスク。** グリモ画面のシナリオに、初回表示、3 行為、連打、画面遷移中の入力、再読み込み、タブ再開、reduced-motion、音 OFF、狭幅、dialog の Escape、キーボード代替を加える。既存 `scripts/resilience/campaign.mjs` の seed、最大 action 数、最大 restart、timeout、console/page error/request failure/5xx の収集を使い、個人データ・production URL・外部アカウントへ向けない。

**無料条件と合格。** 依存追加なしで既存 Playwright を利用する。既存 resilience の `pnpm test:resilience` と、必要な範囲の新規 smoke を実行し、同じ seed を再実行した operation plan が一致すること。rapid tap、duplicate submit、navigation churn、offline、request abort/delay、quota pressure、storage corruption、browser restart の後も指定した不変条件（既存件数、相棒選択、重複なし、外部通信なし、未処理例外なし）を満たすこと。

### 6. Dexie transaction、fake-indexeddb、schema migration の後方互換確認

**技法。** 新しい保存は既存 `TaskManagerDB` に additive な v5 object store（例: singleton の `grimoState` と一意 id の `grimoMemories`）として設計し、`db.transaction("rw", ...)` で関連する書き込みをまとめる。`fake-indexeddb` で v4 の fixture を作ってから v5 を開き、既存 task/streak/plant/drop の全 row と index を比較する。思い出の一意キーを使って同じ反応を 2 回記録しても 1 行になること、transaction 内で例外を起こすと全書き込みが abort/rollback することを試す。

**実装タスク。** 触れ合いの視覚反応は保存完了を待たずに返し、保存は有限 timeout の非同期 transaction にする。ただし failure を握り潰さず、`role=status` で控えめに「触れ合いは続けられます。後で保存を再試行できます」と示し、同じ入力を無制限に再送しない。`getDb()` の SSR guard を維持し、全 table scan が hot path に入らないよう必要な index を先に決める。`tasks` や `drops` を流用せず、企画の「道具・好みは無料・減らない・タスクに紐付けない」を schema に反映する。

**無料条件と合格。** 既存 `fake-indexeddb` と Node test だけを使う。v4 fixture を v5 へ移行して row 数、`completedAt`、`plantState.monthKey`、drop unique index が変わらないこと。2 tab 相当の競合 import/記録で二重 row や未処理 `ConstraintError` がないこと。意図的な quota/abort では transaction 前の状態が残り、植物・タスク・報酬を削除しないこと。

### 7. Backup/rollback と quota pressure の検証

**技法。** 変更前に現行 `buildBackupJson()` で v4 JSON を保存し、新版で v5 payload を export/import して件数と一意キーを照合する。Chrome Application > Storage で IndexedDB、Cache Storage、service worker、使用量を確認し、`navigator.storage.estimate()` の `usage`/`quota` は推定値であることを踏まえて記録する。実データではなく一時 profile で quota error と壊れた row を注入する。

**実装タスク。** `BackupPayload` に新 store を追加して `BACKUP_VERSION` を 5 へ上げる。v4 import は新 store を空にしたり削除したりせず、同じ id の upsert だけを行う。version が current より新しいファイルは現在どおり拒否する。import 前後の件数・primary key・unique key を表示し、parse/transaction 失敗時は途中だけ反映された状態を残さない。リセット UI（`resetCalendar()`、`resetSurveyNotes()`）は backup を先に案内し、テストで実データを対象にしない。

**無料条件と合格。** Chrome Application、StorageManager、既存 resilience の `patchStorageQuota()`/`storage-corruption` を使う。v4 backup→新版、v5 backup→新版の再 import が idempotent、既存 records が減らない、future version は安全に拒否、quota error 後に画面が操作可能で新しい保存だけを失敗表示すること。DB の version を下げるだけの rollback は合格にしない。

### 8. Service Worker と IndexedDB を分けた offline-first 試遊

**技法。** 最初に online で `/plant` とグリモの route、JS、CSS、必要な静的素材を読み、SW が `controller` を得たことを確認する。その後 Playwright context を offline にして reload、route 遷移、触れ合い、IndexedDB read/write を行う。DevTools Application > Service workers と Cache Storage で、`sw.js` の network-first navigation、3 秒 timeout、hashed asset/audio/vfx の cache-first、cache version を照合する。

**実装タスク。** 既存 `public/sw.js` の install を壊さず、cache key を変える場合だけ `CACHE_NAME` を bump する。キャッシュできない外部 API（Gemini、Gmail、Calendar）は offline でもグリモの触れ合いを止めず、機能ごとに回復可能なエラーを示す。画像や音声のキャッシュ失敗で 200 の画面応答を 503 に変えない現在の bounded cache の性質を維持する。初回 install 直後の完全 offline を仕様に追加しない。

**無料条件と合格。** 既存 SW、Chrome DevTools、Playwright の `setOffline()` だけを使う。オンライン初回訪問後に offline reload してグリモが開き、DB の読み書きが継続でき、外部 API の失敗は画面を壊さず回復案内になること。online/offline を 3 回切り替えても cache 重複、SW 更新ループ、console error、データ重複がないこと。次の SW deploy 後に新旧 cache が整理され、既存 DB row は変わらないこと。

## 長時間・復帰の補助確認

上の 8 手法に加え、30 分放置と background/foreground 復帰を一つの bounded smoke として実行する。Chrome DevTools Performance Monitor で CPU、JS heap、DOM nodes、event listeners、frames、layouts/sec、style recalculations を開始時・10 分・30 分・復帰後に記録する。`visibilitychange` の前後で自動反応・粒子・音の timer が増えず、画面を再訪しても同数程度に戻ることを合格とする。Performance Monitor は原因特定の trace ではなく、増え続ける資源の早期検知に使う。

## IndexedDB と rollback の明示注意

1. IndexedDB の schema version は下げない。v5 に上げた端末へ v4 のコードだけを戻すことは、安全なデータ移行や rollback にならない。release rollback が必要な場合は、新schemaとbackupを扱える互換修正版を用意し、disposable profileで既存・新storeを保持して起動できることを確認する。v5 backupをv4コードへ渡すだけでは復旧しない。自動削除、DB delete、旧 backup での全置換は行わない。
2. migration 前に v4 backup を作る。v5 upgrade は `tasks`、`streaks`、`plantState`、`drops` を読み書きせず、必要な新 store の作成と変換だけにする。upgrade 途中の例外は versionchange transaction を abort させ、部分的な schema/row を受け入れない。
3. 既存の `backup.ts` は「同じ primary key を上書きするが、既存にない row を削除しない」契約である。グリモの新 storeもこの契約に合わせる。旧 v4 payload に新 storeがないことを「新 storeを空にする指示」と解釈しない。
4. `plantState` の月境界リセット、`resetCalendar()`、`resetSurveyNotes()` は仕様上異なる操作であり、グリモの選択・好み・思い出を巻き戻す処理に流用しない。タスク・植物・報酬を触れ合い保存の失敗時に削除しない。
5. IndexedDB、Cache Storage、localStorage は別の失敗面である。quota error、transaction abort、SW cache miss、外部 API timeout を一つの「offline」エラーにまとめず、ユーザーに影響する範囲と復旧操作を分ける。

## 調査した一次資料と閲覧範囲

以下は 2026-09-07 JST に公式ドキュメントの該当節と公式 YouTube チャンネルの動画ページを確認した範囲である。YouTube は Chrome for Developers（認証済み公式チャンネル）の公開者、説明、章立て、公開日を確認し、実装上の閾値や API 契約は対応する公式ドキュメントで照合した。動画の宣伝文句を単独の仕様根拠にはしていない。

| 資料 | 使った範囲 | 実装計画への接続 |
|---|---|---|
| [Chrome DevTools: Analyze runtime performance](https://developer.chrome.com/docs/devtools/performance) | CPU throttling、Screenshots、record、FPS、Main flame chart、runtime performance の手順 | 手法 2。4x/20x、trace、フレームと長い JS の確認 |
| [Chrome DevTools: Performance panel overview](https://developer.chrome.com/docs/devtools/performance/overview) | Local LCP/CLS/INP、capture settings、CPU/network throttling、`performance.mark()`/`measure()` | 手法 2。mark と INP を補助指標として扱う |
| [web.dev: Interaction to Next Paint (INP)](https://web.dev/articles/inp) | 反応の定義、click/tap/key、次の paint、200 ms good、lab と field の差、測定限界 | 手法 2。最初の視覚反応を保存完了と混同しない |
| [Chrome DevTools: Device mode](https://developer.chrome.com/docs/devtools/device-mode) | viewport、touch/click、CPU/network、実機との差の注意 | 手法 3。320/390/1280 と低性能近似 |
| [Chrome DevTools: Emulate CSS media features](https://developer.chrome.com/docs/devtools/rendering/emulate-css) | Rendering の `prefers-reduced-motion: reduce`、forced colors、contrast | 手法 3。OS 設定の代替確認 |
| [Chrome DevTools: Accessibility features reference](https://developer.chrome.com/docs/devtools/accessibility/reference) | Lighthouse の位置づけ、Accessibility tab、ARIA、source order、手動 keyboard/screen reader の限界 | 手法 4。自動監査と人間操作を分離 |
| [W3C: WCAG 2.2](https://www.w3.org/TR/WCAG22/)、[Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)、[Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) | 320 CSS px reflow、24×24 CSS px target、間隔/代替操作の例 | 手法 3/4。狭幅と touch target の判定 |
| [Playwright BrowserContext API](https://playwright.dev/docs/api/class-browsercontext)、[Page API](https://playwright.dev/docs/api/class-page)、[Network guide](https://playwright.dev/docs/network) | isolated context、`setOffline()`、`serviceWorkers` allow/block、`emulateMedia()`、route と SW の関係、trace | 手法 5/8。既存 Playwright/resilience の再利用 |
| [MDN: Using IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB)、[IDBTransaction](https://developer.mozilla.org/en-US/docs/Web/API/IDBTransaction) | `upgradeneeded`、transaction の scope/mode、auto-commit、error/abort/rollback、quota/versionchange と blocked | 手法 6/7。v4→v5、abort、競合、後方互換 |
| [Dexie API Reference](https://dexie.org/docs/API-Reference) | schema syntax（`&` unique、compound index）、`version().upgrade()`、transaction | 手法 6。現行 Dexie v4 の設計に接続 |
| [Chrome DevTools: Application panel](https://developer.chrome.com/docs/devtools/application) | Manifest、Service workers、Storage、IndexedDB、Cache Storage、quota の inspect/clear | 手法 7/8。DB と cache を別々に観察 |
| [MDN: StorageManager.estimate()](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/estimate) | `usage`/`quota`/`usageDetails` と値が推定である注意 | 手法 7。容量表示を確定値と誤報告しない |
| [Chrome DevTools: Performance Monitor](https://developer.chrome.com/docs/devtools/performance-monitor) | CPU、heap、DOM nodes、listeners、frames、layout/style recalculation の時系列 | 補助確認。30 分放置・復帰の増加検知 |
| [Chrome for Developers: Performance debugging in DevTools](https://www.youtube.com/watch?v=BHqxD9qr6Gw) | YouTube 動画ページのタイトル、説明、公式公開者、Performance panel の新 UI/annotation/insight の説明（ページの説明範囲） | 手法 2 の trace の入口。数値基準は web.dev/Chrome docs を使用 |
| [Chrome for Developers: Offline Quickstart](https://www.youtube.com/watch?v=zw35jKRSIlo) | YouTube 動画ページのタイトル、説明、公式公開者、Service Worker と Cache API で offline app を作る説明（ページの説明範囲） | 手法 8 の cache/SW 試遊の入口。現行 `sw.js` の詳細はコードと Chrome Application docs を優先 |
| [Chrome for Developers: New logic to detect PWA offline support](https://www.youtube.com/watch?v=hoEE39yB2Pg) | YouTube 動画ページのタイトル、説明、公式公開者、install prompt が offline support を検査する背景説明（ページの説明範囲） | 初回 offline を過大報告しない判断の補助。配布判定そのものには使わない |

この文書は品質調査と実装計画だけを扱う。製品コード、IndexedDB schema、バックアップ、公開設定は今回変更していない。
