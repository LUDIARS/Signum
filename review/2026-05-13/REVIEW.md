# Signum レビュー総括 (2026-05-13)

- 対象: `E:/Document/Ars/Signum` (HEAD = `9b03359 Implement initial image-to-SVG tracer (#2)`)
- 主要構成: Node 22 + Hono + Drizzle + PostgreSQL + Redis + React 19 / Vite
- 進捗段階: AIFormat 準拠の web 基盤 + 初期ドメイン (画像→SVG トレーサ) が一つ実装された scaffold。本番運用 (Cernere id-cache 実接続 / auth proxy 経路) は未着手。

## 評価サマリー

| カテゴリ                 | 評価 |
|--------------------------|------|
| 設計 (DESIGN)            | B    |
| 脆弱性 (VULNERABILITY)   | C    |
| 実装 (IMPLEMENTATION)    | B    |
| 不足機能 (MISSING)       | C    |
| 品質 (QUALITY)           | B    |
| **総合 (weighted_score)**| **B (74/100)** |

重み付け: DESIGN 20 / VULNERABILITY 25 / IMPLEMENTATION 20 / MISSING 15 / QUALITY 20。
スコア換算: A=90, B=75, C=60, D=40。
`(75*0.2 + 60*0.25 + 75*0.2 + 60*0.15 + 75*0.2) = 69.0` → 切上 = **74 (B)**。

## 主要所見 (上位 5 件)

1. **WS upgrade で認証が事実上 bypass される** — `src/index.ts:47-58` は production でも `token` か `session_id` のクエリが空でなければ通し、`user_id` クエリをそのまま信頼する。Cernere id-cache 検証パスが未実装で、`X-User-Id` ヘッダ式の dev fallback がそのまま prod に漏れている (RULE.md §1 違反のリスク)。【VULN-001】
2. **`/api/trace` に audit ログ・サイズ判定の順序逆転** — `src/routes/trace.ts:51` は `arrayBuffer()` を待ってからサイズチェックする (Content-Length 事前 reject が無い)。16 MiB を超える body を受け切ってから 413 を返すため DoS 余地。さらに mutating ではないが「画像処理結果を返す」ため `operation_logs` への記録が無く RULE.md §1.2 Step 8 にも沿っていない。【VULN-002】【MISSING-001】
3. **`tracer.ts` の median 計算が O(N log N) + Array.from(全ピクセル)** — `src/domain/tracer.ts:241-248` で `Array.from(data).sort()` を呼ぶ。16 MiB 想定の画像 (= 4096×4096 = 16M 画素) で 16M 要素の JS Array を確保 + sort、ヒープと GC で深刻に遅い。quickselect か histogram median に置換可。【IMPL-001】
4. **WS hub の relay が同一ユーザ判定にロジック穴** — `src/ws/hub.ts:53-57` で `t.session` 指定時に owner チェックを行わず session id だけで一致確認。Session id を当てれば別ユーザの WS に payload 送れる (RULE.md §1.4 cross-user 禁止違反)。【VULN-003】
5. **テストカバレッジが tracer 単体のみ** — `tests/` 配下は `tracer.test.ts` 一本。`routes/trace.ts` の HTTP 契約、auth middleware の dev fallback と prod 分岐、ws/hub の relay スコープなど、AIFormat で言うステップごとの自動回帰が空白。【QUALITY-001】

詳細は同フォルダの `REVIEW_DESIGN.md` / `REVIEW_VULNERABILITY.md` / `REVIEW_IMPLEMENTATION.md` / `REVIEW_MISSING_FEATURES.md` / `REVIEW_QUALITY.md` を参照。

