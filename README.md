# Signum

LUDIARS の Web サービス基盤 (AIFormat 準拠)。

- 認証: **Cernere** に委譲 (`@ludiars/cernere-id-cache`) — RULE.md §1
- 個人データ: Signum DB に保存しない (RULE.md §5)
- サーバー: **Node 22 + Hono + Drizzle + PostgreSQL + Redis** (RULE_TECH_STACK.md)
- フロント: **React 19 + Vite + React Router 7 + Tailwind 4** (Foundation デザイントークン)

このリポジトリは **Web 基底処理のみ** を含む。ドメイン機能 (Signum の
意味するもの) は後続 PR で `spec/` と `src/routes/` に追加していく。

## ディレクトリ

```
signum/
├── src/                    # バックエンド (Hono)
│   ├── index.ts            # エントリ (HTTP + WS)
│   ├── app.ts              # Hono 合成
│   ├── config/env.ts       # 環境変数アクセッサ
│   ├── auth/               # Cernere Tool Client / user-info cache
│   ├── db/                 # Drizzle schema / repository / migrate
│   ├── middleware/         # request-id / auth / audit
│   ├── routes/             # /api/health, /api/me
│   └── ws/                 # session + hub (RULE.md §1.2)
├── frontend/               # SPA
│   ├── src/
│   │   ├── auth/AuthContext.tsx
│   │   ├── lib/{tokens,api}.ts
│   │   └── pages/{Home,Login,Register}Page.tsx
│   ├── vite.config.ts      # /api + /ws → api:3200 proxy
│   └── nginx.conf          # 本番 SPA fallback
├── migrations/
│   └── 001_init.sql        # users / operation_logs / service_meta
├── spec/                   # AIFormat FORMAT_SPEC.md 準拠
│   ├── schema/
│   ├── web/
│   └── code/
├── docker-compose.yaml
└── docker-compose.standalone.yaml
```

## 起動

### 開発 (ホットリロード)

```bash
npm install
(cd frontend && npm install)
npm run env:setup          # Infisical 初回のみ
npm run env:env            # .env 生成
npm run dev                # api:3200 + web:8083 を concurrently
```

### Docker (共有インフラ前提)

```bash
npm run env:up             # api + web, DB/Redis は LUDIARS/Infra
```

### Docker (All-in-One)

```bash
npm run env:up:standalone  # + signum-db / signum-redis
```

## ヘルスチェック

| path                      | 用途                              |
|---------------------------|-----------------------------------|
| `GET /api/health/`        | 生きてるか (docker healthcheck 用) |
| `GET /api/health/ready`   | DB + Redis 到達確認               |
| `GET /api/health/version` | バージョン + uptime               |
| `GET /api/me`             | Cernere resolved ユーザー情報     |

## 次のステップ

1. Signum のドメイン仕様を `spec/` にまとめる (FORMAT_SPEC.md 参照)
2. Cernere に Tool Client を発行し、`TOOL_CLIENT_ID/SECRET` を
   Infisical 経由でセット (`npm run env:set`)
3. `src/routes/` にモジュールルートを追加
4. `migrations/002_*.sql` を追加 (DROP 禁止 / IF NOT EXISTS)
5. `frontend/src/pages/` に画面を追加し、`App.tsx` の Router へ配線
