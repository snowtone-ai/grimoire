# CONTEXT.md -- Grimoire Domain Vocabulary

## Product Name
- Canonical name: Grimoire
- Legacy names: Task Plant / Focus Task Manager / task-manager
- Package name: grimoire
- GitHub repo: snowtone-ai/grimoire (renamed from snowtone-ai/task-plant)

## User
- 不注意優勢型ADHDの就活中大学生。
- Android Chrome PWAを主な利用環境とする。
- 対象ユーザーは1人用の自分専用利用。

## Domain Terms
- task: IndexedDBに保存される作業項目。UI語彙では「クエスト」。
- dueDate: YYYY-MM-DD形式の期限日。
- dueTime: HH:MM形式の任意の期限時刻。nullは終日。
- category: job / university / life。
- recurrence: none / daily / weekly / monthly。
- streak: タスクが1件以上ある日に全完了した連続日数。
- all view: /all のカレンダー/リスト全体表示。
- voice input: Web Speech API + Gemini APIによる即時タスク登録（UI語彙では「受注」）。

## Reward Vocabulary (2026-07 アイスボーン風改訂 — Capcom固有名詞は不使用)
| UI語彙 | コード実体 | 場所 |
|---|---|---|
| クエスト達成 | `toggleTaskComplete` + drop grant | src/lib/taskDb.ts, src/hooks/use-home-screen.ts |
| 素材ドロップ | `DropDef` / `DropRecord` / `grantDropForTask` | src/lib/domain/drops.ts, src/lib/rewardDb.ts |
| RARE1 採集素材 | `COMMON_DROPS`（オリジナル霜の植物12種） | src/lib/domain/drops.ts |
| RARE4 希少植物 | `RARE_DROPS`（月替わり12種の花） | src/lib/domain/drops.ts |
| RARE8 絶景 | `SSR_DROPS`（12枚の実写真 = 旧報酬画像） | src/lib/domain/drops.ts |
| 天井 / 初回保証 | `PITY_LIMIT` / `isFirstOfDay` in `decideRarity` | src/lib/domain/drops.ts |
| 調査記録（図鑑） | `/book` + `getCollection` | src/app/book/, src/lib/rewardDb.ts |
| 植生研究所 | `/plant`（月次累積成長・週次リセット廃止） | src/app/plant/, src/lib/domain/plant.ts |
| ページめくり | next-view-transitions + `html[data-page-turn]` | src/components/navigation/bottom-nav.tsx, globals.css |
| プニッ | `btn-squish` utility（唯一の押下エフェクト） | src/app/globals.css |
| 効果音 | Web Audio合成・Cペンタトニック単一パレット | src/lib/sound.ts |
| バウンティ（予定） | T018: デイリーミッション+出発ボタン | tasks.md |

報酬設計原則: 即時（遅延割引対策）・無罰（没収しない）・変動（飽き対策）・一貫
（効果音/エフェクトは単一文法で、ランダム刺激疲れを防ぐ）。

## Naming Rules
- User-facing product name is Grimoire.
- Keep code identifiers in English.
- Keep Japanese UI copy concise and action-oriented.
