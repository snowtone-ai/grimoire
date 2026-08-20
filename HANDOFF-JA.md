# HANDOFF-JA.md -- pm-zero v12 (grimore-v2)

## 2026-08-20 セッション終了checkpoint

- 非エンジニア向け実装現在地を`docs/implementation-status-2026-08-20.html`へ作成した。
  12章、3表、2 SVG graph、3実画面で、完成率を装わず4段階成熟度とrelease「保留」を説明。
  N+1は発見日時inventory materializeとactive-task cache/差分投影の2修正、残る10k実測境界を分離。
- browser QA: 1280pxと390pxでconsole error 0、broken image 0、document横overflow 0。
  mobile表はtable container内だけ横scroll可能。report用faviconもwordless魔導書紋章へ接続。
- 終了時raw gate: `pnpm verify`全合格（lint、typecheck、Vitest 15 files/60 tests、
  Next production build 7 static routes）、`pnpm test:e2e` 5 passed/1 skipped/0 failed、
  `pnpm audit --prod` 0 vulnerabilities。skipは従来どおりWindows WebKit offline harnessのみ。
- releaseはFAIL/保留のまま。次セッションはT015/T016残差を優先順に進める:
  (1) task edit/delete、(2) audio engine、(3) outbox lease pump、(4) 10k/multi-tab/quota/physical QA、
  (5) Catalog残708件。Area 2以降とGoogle Calendarはその後。
- 作業用`test-results/`、`.playwright-mcp/`、report QA一時PNGは`.gitignore`へ追加。
  HTMLが参照する`grimoire-mobile-{home,catalog,grimo}.png`の3枚はreport evidenceとして保持。

## 2026-08-19 T011–T016 製品統合

- Next 16/React 19のlocal-first PWAを構築し、Home、Calendar、Settings、Area1、Catalogを
  `DurableUiPort`経由でDexieへ接続した。タスク作成/初回完了の報酬、growth、receipt、
  event、outbox、inventoryは単一transactionでexactly-onceにcommitする。
- 起動紋章はv1を流用せず、文字なしの壊れた魔導書印/開いた本/水の核としてSVGとPWA iconを
  新規作成。起動設定はOFF/一定時間(既定900ms、上限1.2s)/毎回。
- N+1監査で、refreshのreward ledger全走査とinventoryごとの探索を発見。発見日時をinventoryへ
  atomic materializeし、DB v2 migrationで旧ledgerから一括backfillした。さらに独立レビューで
  各refreshの全active task O(N×R)を検出し、起動cache＋作成1件の差分投影へ変更。完了・設定・
  storage確認ではactive task query/recurrence再展開をしない。Catalog投影はO(inventory)。
- PWA shellはroute HTMLから参照されるNext static chunkもinstall時にcacheし、内部Linkの不要な
  prefetchを停止。本番Chromiumでoffline reload時のconsole error/request failure 0を確認。

## 検証

- `pnpm verify`: lint、typecheck、Vitest 15 files/60 tests、Next production buildの全て合格。
- Playwright production E2E: 5 passed / 1 skipped。skipはWindows Playwright WebKitがoffline
  context reloadで内部エラーになる既知のharness境界で、Chromium offlineは合格。
- `pnpm audit --prod`: known vulnerability 0。`git diff --check`: error 0。

## 未完了を明示

- 10k task benchmark、実ブラウザmulti-tab crash/QuotaExceeded、物理Pixel/Xiaomi、200% zoom。
- Google Calendar adapter、実audio engine、outbox lease pump、task edit/delete。
- Catalog契約は12分類×60枠だが、品質確定した実定義は12件。720件をダミー生成していない。
- Area1以外の世界、最終生物asset、WebGL context-lossの製品E2E。

## 2026-08-19 T007 最高品質化

- `prompt.md` の5領域を、一次資料URL、現状分析、採用判断、正確な初期調整値、
  コード/JSON、要求coverage、acceptance matrixまで含む
  `grimore-v2/Grimoire_最高品質化仕様.md`へ統合した。
- 背景・グリモ・UI・storeの一方向契約、IndexedDB migration/outbox、二層UI、
  WCAG 2.2 AA、VFX/ACES/shared light、部位別spring、press/glow、adaptive audioを
  `grimore-v2/Grimoire_決定事項ログ.md` S章の実装基準へ昇格した。
- 陸珊瑚の台地へp20 FPS・scene draw calls・triangles・post passesで判定する
  `RuntimeQualityGovernor`を統合した。4秒warmup、2.5秒縮退、8秒復帰、15秒cooldown、
  2回目縮退でsession lock。三角形は基準150,000、許容+2%、実効上限153,000。
- 計測はprimary scene callsとmultipass totalを分離し、試作環境契約v2からquality、budget、
  sampling、reasonをread-onlyで公開する。製品consumerはbootstrap adapterでlinear変換した
  `schema: 3`だけを読み、V2へ直接依存しない。
- visible world trianglesとrenderer total trianglesを分離し、auto+reducedでp20<40が
  3秒継続またはcontext loss時は生成Canvas poster（任意video優先）へ切り替える。

## 検証

- Node test: 15/15 pass。
- production build: pass。
- Markdown: 1,572行、fence 44整合、JSON 6ブロックparse、一次資料URL 55件と要求IDを監査済み。
- headless Chrome (ANGLE/AMD Radeon/D3D11): exception/warning/error 0。auto fullは
  FPS 60 / p20 59、scene draw 29、triangles 152,490、post 10でfull維持。forced reducedは
  draw 25、triangles 44,918、post 8、render scale .82。
- 独立最終監査: product/spec/prototypeはCRITICAL 0 / HIGH 0。

## 継続事項

- Pixel 7a / Xiaomi 14T Proの物理端末thermal測定、最終rig/world scale/HDR assetでの
  VFX・spring調整、旧DB実fixture、Bluetooth音声遅延は製品統合時に再検証する。
- T009は公式現行schemaまで確定したが、管理境界外の`~/.codex/config.toml`は未反映。
  D-007の最小差分をオーナーが反映して再起動する。
- T010は`AGENTS.md`へCodex-only最大4 workerを反映済み。実行時上限は管理境界外の
  `~/.codex/config.toml`へ`[agents] max_concurrent_threads_per_session = 4`を追加して
  再起動する必要がある。`CLAUDE.md`とClaude設定は変更しない。
- T006のStore版PowerShell起動拒否は継続中。非Store版PowerShellまたはWSLへ切替える。
