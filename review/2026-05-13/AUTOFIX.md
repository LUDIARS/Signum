# AUTOFIX — Signum (2026-05-13)

ソースコード修正禁止のため、本レビューでは autofix を一切実行していない。
以下は「将来別 PR で安全に自動修正できる候補」の列挙のみ。

## autofix_count: 0

## 安全範囲の自動修正候補 (実行せず列挙のみ)

1. **`package.json` の未使用依存** — `bcryptjs`, `jsonwebtoken` を実際に import している箇所が `src/` に無い (QUALITY-006)。`npm ls` で確認後に `npm uninstall` で除去できる。
2. **`session.ts` の type guard 強化** — `String(msg.module ?? "")` で空文字を許してから handler not found に落ちる経路 (`src/ws/session.ts:88-93`)。空文字を 400 相当の error にした方が明確だが、振る舞い変更なので「自動」扱いはしない。
3. **`src/index.ts:62-66` の shutdown** — `server.close()` 後に `wss.close()` を加える。lint には引っかからないが、resource leak の懸念解消として安全。
4. **`tsconfig.json` の `noUncheckedIndexedAccess` 明示化** — 既に true なら no-op、false なら non-null assertion を見直す必要があるので「自動」扱いには不向き。
5. **`/api/trace` の `c.req.header("content-length")` 事前チェック追加** — VULN-002 対策。挙動変更を伴うので autofix では出さず別 PR 推奨。
6. **WS hub の cross-user relay 修正** (`src/ws/hub.ts:53-57`) — VULN-003 のクローズ条件追加 (`c.userId === fromUserId` の前置)。挙動変更でセキュリティ修正なので明確なレビュー必須、autofix 不可。

## 結論

今回の指示 (ソースコード修正禁止 + AUTOFIX は列挙のみ) に従い、コミット / push / ファイル変更は行わない。
上記候補は次回別 PR で `/ludiars-review --autofix` 等の方針合意後に着手すべきもの。

