# Task Plant — タスク管理PWA

大学生活と就職活動のマルチタスクを整理し、ユーザーが「今、何をすべきか」を瞬時に把握することに特化した、自分専用のタスク管理PWA（Progressive Web App）です。

> ※自分専用前提で設計しているため、他の方はご利用いただけません。

**Production URL**: https://task-plant.vercel.app

## 主な機能

- **AI音声タスク登録**: Gemini 2.5 Flash APIを搭載。曖昧な発話からタスク名・期限・カテゴリを自動抽出。
- **Gmailタスク抽出**: 受信メールからGeminiがタスク候補を検出し、ワンタップで取り込む。
- **Googleカレンダー連携**: 予定をタスクとして取り込み、締切管理を一元化。
- **繰り返しタスク**: 毎日・毎週・毎月の定期タスクを自動生成。
- **植物成長システム**: 週次完了数に応じて植物が育つ12か月・4アーキタイプの成長演出。
- **Streak記録**: 毎日の全タスク完了を🔥ストリークとして記録。
- **オフラインファースト**: PWA + IndexedDB（Dexie.js）により通信なしでも動作。
- **即時報酬**: タスク完了時に canvas-confetti による視覚演出。

## 技術スタック

| カテゴリ | 採用技術 |
|---|---|
| Framework | Next.js 16+ (App Router) / React 19 |
| Language | TypeScript (strict: true) |
| Styling | Tailwind CSS v4 (CSS-First Configuration) |
| AI | Gemini 2.5 Flash API |
| Auth | Google Identity Services (GIS) OAuth2 |
| Database | Dexie.js (IndexedDB, lazy init) |
| PWA | @ducanh2912/next-pwa + maskable icons |
| Deployment | Vercel |
| Package Manager | pnpm |

## セットアップ

### 1. 環境変数

`.env.local` を作成し以下を設定:

```env
NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_api_key
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_oauth_client_id
```

Google Cloud Console で OAuth 2.0 クライアントIDを作成し、`Authorized JavaScript origins` に以下を追加:
- `http://localhost:3000`（開発）
- `https://task-plant.vercel.app`（本番）

### 2. 開発サーバー起動

```bash
pnpm install
pnpm dev
```

### 3. PWAアイコン生成（SVG変更時のみ）

```bash
node scripts/gen-icons.mjs
```

`public/icon.svg` から 192px/512px（通常・maskable）の4種類のPNGを生成します。

## 検証コマンド

```bash
npx tsc --noEmit   # 型チェック
pnpm lint          # ESLint
pnpm build         # ビルド確認
```

## AI協調開発

このプロジェクトはAIエージェントと密接に協調する開発手法で構築されました。

1. **PMエージェントによる要件定義**: 独自の「要件定義専門PMエージェント（pm-zero）」を用いて曖昧なアイデアを `docs/vision.md` に構造化。
2. **Claude Code による自律実装**: `CLAUDE.md` / `AGENTS.md` に蓄積された地雷回避ルールに基づき、Claude Code がコードの実装・デバッグ・Playwright検証を自律的に実行。
3. **Codex CLI との並行開発**: 同一ブランチへの同時書き込みを禁止し、Write Lock で排他制御。

## ディレクトリ構成（主要）

```
src/
├── app/                  # Next.js App Router
│   ├── plant/            # 植物画面
│   └── manifest.ts       # PWA manifest
├── components/
│   ├── home/             # ホーム画面（タスクカード/追加/編集）
│   ├── all/              # 全タスク一覧
│   ├── calendar/         # カレンダー連携
│   ├── gmail/            # Gmail連携
│   └── plant/            # 植物成長コンポーネント
├── hooks/                # Reactカスタムフック
├── lib/
│   ├── domain/           # Pure domain logic（category / plant / task-date）
│   ├── api/              # 外部API補助（gmail / google-auth / google-calendar）
│   ├── db.ts             # Dexie スキーマ定義
│   ├── taskDb.ts         # DB操作
│   └── gemini.ts         # Gemini API クライアント
docs/
├── vision.md             # 仕様（Single Source of Truth）
├── state.md              # 現在の実装状態
├── decisions.md          # 設計判断ログ
└── issues.md             # 失敗・エスカレーション記録
```
