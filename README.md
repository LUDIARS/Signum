# Signum

LUDIARS の Web サービス基盤 (AIFormat 準拠)。

- 認証: **Cernere** に委譲 (`@ludiars/cernere-id-cache`) — RULE.md §1
- 個人データ: Signum DB に保存しない (RULE.md §5)
- サーバー: **Node 22 + Hono + Drizzle + PostgreSQL + Redis** (RULE_TECH_STACK.md)
- フロント: **React 19 + Vite + React Router 7 + Tailwind 4** (Foundation デザイントークン)

Signum のドメイン機能は画像のアウトライン解析 → SVG 生成。
最初のマイルストーンとして `POST /api/trace` を実装している
(「外観だけ」から「模様まで」を `detail` スライダーで連続的に切り替え)。

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
│   ├── domain/             # image decode / tracer (純関数)
│   ├── routes/             # /api/health, /api/me, /api/trace
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

## ドメイン API

### `POST /api/trace`

画像 (PNG) のアウトラインを解析して SVG として返す。`detail` パラメータ
(`0.0` 〜 `1.0`) で、外観だけのシルエットから内部の模様までを
グラデーションで切り替える。

- **Request**
  - `Content-Type: image/png`
  - body: PNG バイト列 (最大 16 MiB)
  - query (任意):
    - `detail` 0.0 (外観のみ) 〜 1.0 (模様まで) / 既定 `0.5`
    - `stroke` 線の色 / 既定 `#000000`
    - `strokeWidth` 線幅 / 既定 `1.0`
    - `background` 背景色 (未指定なら透明)
    - `minContourLength` これより短い輪郭は破棄 / 既定 `2`
- **Response**: `200 image/svg+xml` (生成された SVG)
- **Errors**: `400` 未対応フォーマット / 空 body / 不正パラメータ, `413` 大きすぎる body

```bash
curl -sS -X POST \
  -H "Content-Type: image/png" \
  -H "X-User-Id: dev" \
  --data-binary @photo.png \
  "http://localhost:3200/api/trace?detail=0.3&background=white" \
  > photo.svg
```

実装は `src/domain/tracer.ts` (純関数) + `src/domain/image.ts`
(pngjs による PNG デコード) + `src/routes/trace.ts` (Hono ルート)。
`src/domain/` はドメインロジックを副作用から切り離し、Hono 非依存の
vitest テストを `tests/tracer.test.ts` に置く。

## 次のステップ

1. JPEG / WebP デコーダ対応 (`decodeToGrayscale` の拡張)
2. `spec/web/` に `/api/trace` の OpenAPI 記述を追加
3. `frontend/src/pages/` にアップロード画面 + `detail` スライダー UI
4. `migrations/002_*.sql` でトレース履歴テーブル (必要なら / RULE §5 遵守)
