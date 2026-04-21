# code/

ソースコード構造とクラス責務。AIFormat FORMAT_SPEC.md §4 準拠。

## バックエンド (`src/`)

| ディレクトリ      | 責務                                                                        |
|-------------------|-----------------------------------------------------------------------------|
| `config/`         | 環境変数アクセッサ (`env.ts`)                                                |
| `auth/`           | Cernere Tool Client 認証 (`cernere-client.ts`) / user-info キャッシュ (`user-info.ts`) |
| `db/`             | Drizzle schema / connection / repository / migrate / Redis クライアント        |
| `middleware/`     | `request-id` / `auth` (id-cache + dev fallback) / `audit`                   |
| `routes/`         | `/api/health`, `/api/me` 等 Hono サブアプリ (機能追加時はここに)              |
| `ws/`             | `session.ts` (hello / ping / module_request) + `hub.ts` (relay)              |
| `app.ts`          | Hono 合成ルート (middleware 順序を一元管理)                                  |
| `index.ts`        | エントリポイント: HTTP/WS サーバ起動 + signal ハンドラ                        |

### 重要な依存

```
routes/* → middleware/auth → db/repository → db/connection (Drizzle)
auth/cernere-client → fetch (Cernere)
ws/hub → ws/session → db/repository.operationLogRepo
```

### 設計パターン

- **リポジトリパターン**: ルート/WS ハンドラは `db/repository.ts` のみを使用。
  Drizzle の raw クエリを直接書かない (RULE_TECH_STACK.md §DB アクセスルール)
- **アダプタ**: `auth/middleware.ts` は本番 (`@cernere/id-cache`) と
  開発 (ヘッダフォールバック) の両実装を切り替える
- **Best-effort 書込み**: `recordOperation` / `touchSeen` 等は失敗しても
  リクエスト成功を阻害しない

## フロントエンド (`frontend/src/`)

| ディレクトリ      | 責務                                                                |
|-------------------|---------------------------------------------------------------------|
| `auth/`           | `AuthContext` (FORMAT_AUTH.md §2.7) + `RequireAuth` ルートガード     |
| `lib/`            | `tokens.ts` (localStorage 抽象) + `api.ts` (自動リフレッシュ付 fetch) |
| `pages/`          | Login / Register / Home。追加時は `App.tsx` の Router にマウント      |
| `App.tsx`         | BrowserRouter + ルーティング定義                                     |
| `main.tsx`        | `createRoot` / StrictMode                                           |
| `index.css`       | Foundation デザイントークン (Ars/Schedula 共通)                      |

## テスト

- バックエンド: Vitest (`npm test`)
- フロント: ESLint + tsc build (CI で `frontend && npm run build`)
- CI 呼び出し: `scripts/ci-check.sh` がすべてのチェックを単一スクリプト化
