# web/

Signum フロントエンド (SPA) とバックエンド API の契約。
AIFormat FORMAT_SPEC.md §3 準拠。

## ルーティング (React Router 7 / BrowserRouter)

| path          | コンポーネント     | ガード              |
|---------------|--------------------|---------------------|
| `/login`      | `LoginPage`        | なし                |
| `/register`   | `RegisterPage`     | なし                |
| `/`           | `HomePage`         | `RequireAuth` (認証必須) |
| `*`           | `Navigate → /`     | —                   |

## API エンドポイント

| メソッド | path                        | 認証 | 役割                                  |
|----------|-----------------------------|------|---------------------------------------|
| GET      | `/api/health/`              | ✗    | ヘルスチェック (docker / nginx)        |
| GET      | `/api/health/ready`         | ✗    | DB + Redis 到達確認                    |
| GET      | `/api/health/version`       | ✗    | サービスバージョン + uptime            |
| GET      | `/api/me`                   | ✓    | Cernere 経由で解決したユーザー情報     |
| upgrade  | `/ws`                       | ✓    | module_request / relay (RULE.md §1.2) |

## 認証フロー (FORMAT_AUTH.md §2)

1. ログイン UI → `POST /api/auth/login` (Cernere プロキシ想定)
2. 成功 → `localStorage` に accessToken / refreshToken を保存
3. 以降の `/api/*` リクエストは `Authorization: Bearer` を付与
4. 401 → refreshToken で再発行 (`/api/auth/refresh`)
5. OAuth (Google / GitHub) はリダイレクト、コールバックでクエリから拾う

## 状態管理

| 層          | 役割                                           |
|-------------|------------------------------------------------|
| `AuthContext` | 現在ユーザー / MFA 状態 / OAuth URL の保持    |
| `lib/tokens.ts` | localStorage 抽象化                          |
| `lib/api.ts`    | fetch + 自動リフレッシュ                     |

## デザイントークン

Foundation (`src/index.css` :root) で CSS 変数として定義。
Ars / Schedula / Cernere と同じ一式を使用する。

## モバイル対応

`max-width: 767px` で mobile-stack、44px タッチターゲット準拠
(RULE_TECH_STACK.md §Foundation / モバイル対応)。
