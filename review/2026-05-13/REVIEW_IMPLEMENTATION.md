# REVIEW_IMPLEMENTATION — Signum

評価: **B**

## 良い点
tracer 輪郭抽出が正攻法 (`src/domain/tracer.ts:125-204`)、PNG alpha→白合成 (`image.ts:39-46`)、401→refresh 1 段。

## 懸念
- **IMPL-001** `src/domain/tracer.ts:241-248` median が Array.sort で 16M 要素、Uint8 histogram O(N) 化可。
- **IMPL-002** `src/domain/tracer.ts:175` chain が文字列 Map キー。
- **IMPL-003** `src/domain/tracer.ts:183-203` 入口探索 O(K²)。
- **IMPL-004** `src/middleware/auth.ts:88-94` touchSeen が毎リクエスト DB write。
- **IMPL-005** `src/ws/hub.ts:17-19` 同 sessionId 再接続 race。
- **IMPL-006** `src/index.ts:24-28` `serve()` error listener 無し。
- **IMPL-007** `src/index.ts:53-58` user_id 未指定で全員 "dev-user"。
- **IMPL-008** `frontend/src/lib/api.ts:34-40` Content-Type 強制 json で PNG POST 不可。
