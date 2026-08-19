# HANDOFF-JA.md -- pm-zero v12 (grimore-v2)

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
