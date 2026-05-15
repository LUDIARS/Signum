# REVIEW_DESIGN — Signum

評価: **B**

## 良い点
- AIFormat と src の対応 (`README.md:14-43`)。
- tracer が I/O ゼロ純関数 (`src/domain/tracer.ts:39`)。
- 個人データ非保管 (`src/db/schema.ts:23-28` + `src/auth/user-info.ts:54`)。
- middleware 順序明確 (`src/app.ts:22-58`)。

## 懸念
- WS 認証空白 (`src/index.ts:42-58`)、`user_id` クエリを userId 化。
- touchSeen が fire-and-forget (`src/middleware/auth.ts:88-94`)。
- `/api/trace` CPU が event loop 直 (`src/routes/trace.ts:51-74`)。
- `/api/auth/*` (`spec/web/README.md:25-32`) が backend 未実装。
- `serviceMeta` 未消費 (`src/db/schema.ts:48-56`)。

## 推奨
WS verify / touchSeen throttle / worker / auth proxy 確定 / migration stamp。
