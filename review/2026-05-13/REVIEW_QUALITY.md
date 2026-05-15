# REVIEW_QUALITY — Signum

評価: **B**

## 良い点
コメントが「なぜ」を残す、DDL/Drizzle/spec 同期、依存最小 (`package.json:36-66`)。

## 懸念
- **QUALITY-001** tracer 以外テスト空白。
- **QUALITY-002** `console.log` のみ、structured log 無し。
- **QUALITY-003** env null 表現混在 (`config/env.ts:45` ↔ `middleware/auth.ts:39`)。
- **QUALITY-004** `data[i]!` 多用、tsconfig strict 要確認。
- **QUALITY-005** `catch {}` 多数で障害観測不能。
- **QUALITY-006** `bcryptjs`/`jsonwebtoken` dead dep 疑い。
- **QUALITY-007** `c.json` と `new Response` 混在 (`routes/trace.ts`)。

## 推奨
coverage / pino / dead dep 除去 / strict 明示。
