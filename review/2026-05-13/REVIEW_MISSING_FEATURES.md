# REVIEW_MISSING_FEATURES — Signum

評価: **C**

## 仕様 → 未実装
- **MISSING-001** `src/routes/trace.ts` に `recordOperation` 無し。
- **MISSING-002** frontend が呼ぶ `/api/auth/{login,refresh,logout,mfa/*}` が backend 不在、bootstrap 即 404。
- **MISSING-003** upload + slider UI 未着手 (README.md:115-118)。
- **MISSING-004** OpenAPI ファイル無し。
- **MISSING-005** JPEG/WebP decoder 未着手 (`src/domain/image.ts:1-11`)。
- **MISSING-006** テストが `tests/tracer.test.ts` のみ。

## 仕様外
- **MISSING-007** `/api/trace` rate limit 無し。
- **MISSING-008** shutdown が `server.close()` のみ。
- **MISSING-009** structured log 無し。
- **MISSING-010** schema version 未書込み。
- **MISSING-011** WS resume 無し。
