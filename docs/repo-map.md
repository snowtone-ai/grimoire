# repo-map.md -- pm-zero v12 Repository Map (grimore-v2)

## Read Policy
- Session start: read Summary only.
- Before editing: read the section for the target area when target files are unclear.
- When navigation is unclear: read Entry Points and Directory Map.
- After structural changes: update only the affected section.

## Summary
Grimoire v2 は Next 16のlocal-first PWAとして実行可能。製品横断の最高品質化仕様は
`grimore-v2/Grimoire_最高品質化仕様.md`、確定した世界・生物・表現判断は
`grimore-v2/Grimoire_決定事項ログ.md`、実行状態は `tasks.md` と `docs/state.md` を参照する。
`src/app/`が統合境界、`src/application/`/`src/domain/`がdurable command、
`src/infrastructure/dexie/`が永続化、`src/features/`が各画面、Area1原典はprototypeに保つ。
非エンジニア向けの現時点reportは`docs/implementation-status-2026-08-20.html`。

## Directory Map
| Path | Purpose | Edit Frequency | Notes |
|---|---|---|---|
| `grimore-v2/` | v2の設計正典、参考資料、試作 | high | 設計判断は決定事項ログへ記録 |
| `grimore-v2/prototypes/area1-coral/` | 陸珊瑚の台地 Three.js 試作 | high | 独立したnpm package |
| `grimore-v2/prototypes/area1-coral/src/` | scene、pass、geometry計数、品質制御、fallback、GUI | high | `main.js`が統合点 |
| `grimore-v2/prototypes/area1-coral/test/` | 品質ガバナー、visible geometry、fallbackの純粋テスト | medium | Node test runner |
| `docs/` | 状態、決定、障害、リポジトリ地図 | medium | 工学判断のみを記録 |
| `docs/implementation-status-2026-08-20.html` | 非エンジニア向け実装現在地 | low | 単独HTML、表・SVG graph・実画面を含む |
| `src/app/` | Next route、bootstrap、UI read model統合 | high | DurableUiPortだけが永続層とfeature UIを接続 |
| `src/domain/`, `src/application/` | task/recurrenceとatomic command契約 | high | UI/renderer非依存 |
| `src/infrastructure/dexie/` | IndexedDB schema、migration、import activation | high | DB v2、append-only ledgerからinventory投影 |
| `src/features/` | Home、Calendar、Settings、Grimo、Catalog | high | feature間の直接writeは禁止 |
| `public/` | wordless brand、PWA icons/manifest/service worker | medium | user truthは保存しない |
| `tests/` | unit/integration/world/e2e | high | production serverでPWA E2E |

## Entry Points
| Area | File | Purpose |
|---|---|---|
| 最高品質化仕様 | `grimore-v2/Grimoire_最高品質化仕様.md` | 5領域の根拠、正確な初期値、契約、コード/JSON、受入基準 |
| 実装現在地report | `docs/implementation-status-2026-08-20.html` | release判定、成熟度、機能表、実画面、N+1、検証、残課題を平易に可視化 |
| 製品デザイン判断 | `grimore-v2/Grimoire_決定事項ログ.md` | 採用済みの世界・生物・UI・音響判断 |
| 背景試作 | `grimore-v2/prototypes/area1-coral/src/main.js` | renderer、scene、passes、quality governorの統合 |
| 品質制御 | `grimore-v2/prototypes/area1-coral/src/quality.js` | p20、予算、ヒステリシス、tier lockの純粋ロジック |
| fallback | `grimore-v2/prototypes/area1-coral/src/fallback.js` | low-p20連続判定、生成Canvas poster、任意video切替 |
| geometry計数 | `grimore-v2/prototypes/area1-coral/src/geometry.js` | visible world triangles、instance count、sky除外 |
| 品質パラメータ | `grimore-v2/prototypes/area1-coral/src/params.js` | 端末非依存の閾値、DPR/render scale、許容差 |
| 環境契約 | `grimore-v2/prototypes/area1-coral/src/scene.js` | read-only environment contract v2とscene実測値 |
| 品質テスト | `grimore-v2/prototypes/area1-coral/test/quality.test.mjs` | 縮退、復帰、cooldown、lock、±2%境界 |
| fallback/geometryテスト | `grimore-v2/prototypes/area1-coral/test/fallback.test.mjs`, `geometry.test.mjs` | 3秒連続窓、非対象tier、visible/instance/sky境界 |
| 製品runtime | `src/app/durable-ui-port.ts` | 固定本数bulk query、command配線、UI read model |
| IndexedDB schema | `src/infrastructure/dexie/schema.ts` | index、DB v1→v2一括migration |
| N+1防止投影 | `src/app/catalog-projection.ts` | inventoryだけからO(items)でCatalog生成 |
| PWA offline shell | `public/sw.js` | route HTMLと参照static chunkをcache |
| 本番browser flow | `tests/e2e/app.spec.ts` | durable task、launch/world、offline reload |
