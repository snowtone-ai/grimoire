# repo-map.md -- pm-zero v12 Repository Map (grimore-v2)

## Read Policy
- Session start: read Summary only.
- Before editing: read the section for the target area when target files are unclear.
- When navigation is unclear: read Entry Points and Directory Map.
- After structural changes: update only the affected section.

## Summary
Grimoire v2 は設計正典と独立した Three.js 背景試作から再構築中。製品横断の
最高品質化仕様は `grimore-v2/Grimoire_最高品質化仕様.md`、確定した世界・生物・
表現判断は `grimore-v2/Grimoire_決定事項ログ.md`、実行状態は `tasks.md` と
`docs/state.md` を参照する。現在の実行可能な対象は `grimore-v2/prototypes/area1-coral/`。

## Directory Map
| Path | Purpose | Edit Frequency | Notes |
|---|---|---|---|
| `grimore-v2/` | v2の設計正典、参考資料、試作 | high | 設計判断は決定事項ログへ記録 |
| `grimore-v2/prototypes/area1-coral/` | 陸珊瑚の台地 Three.js 試作 | high | 独立したnpm package |
| `grimore-v2/prototypes/area1-coral/src/` | scene、pass、geometry計数、品質制御、fallback、GUI | high | `main.js`が統合点 |
| `grimore-v2/prototypes/area1-coral/test/` | 品質ガバナー、visible geometry、fallbackの純粋テスト | medium | Node test runner |
| `docs/` | 状態、決定、障害、リポジトリ地図 | medium | 工学判断のみを記録 |

## Entry Points
| Area | File | Purpose |
|---|---|---|
| 最高品質化仕様 | `grimore-v2/Grimoire_最高品質化仕様.md` | 5領域の根拠、正確な初期値、契約、コード/JSON、受入基準 |
| 製品デザイン判断 | `grimore-v2/Grimoire_決定事項ログ.md` | 採用済みの世界・生物・UI・音響判断 |
| 背景試作 | `grimore-v2/prototypes/area1-coral/src/main.js` | renderer、scene、passes、quality governorの統合 |
| 品質制御 | `grimore-v2/prototypes/area1-coral/src/quality.js` | p20、予算、ヒステリシス、tier lockの純粋ロジック |
| fallback | `grimore-v2/prototypes/area1-coral/src/fallback.js` | low-p20連続判定、生成Canvas poster、任意video切替 |
| geometry計数 | `grimore-v2/prototypes/area1-coral/src/geometry.js` | visible world triangles、instance count、sky除外 |
| 品質パラメータ | `grimore-v2/prototypes/area1-coral/src/params.js` | 端末非依存の閾値、DPR/render scale、許容差 |
| 環境契約 | `grimore-v2/prototypes/area1-coral/src/scene.js` | read-only environment contract v2とscene実測値 |
| 品質テスト | `grimore-v2/prototypes/area1-coral/test/quality.test.mjs` | 縮退、復帰、cooldown、lock、±2%境界 |
| fallback/geometryテスト | `grimore-v2/prototypes/area1-coral/test/fallback.test.mjs`, `geometry.test.mjs` | 3秒連続窓、非対象tier、visible/instance/sky境界 |
