# schema/

Signum のデータスキーマ仕様。AIFormat FORMAT_SPEC.md §2 に従い、
テーブル定義・リレーション・インデックス・ENUM を網羅する。

## テーブル一覧 (初期)

| テーブル          | 用途                                                   | 備考 |
|-------------------|--------------------------------------------------------|------|
| `users`           | Cernere user_id の FK アンカー (**個人データは保管しない**) | RULE.md §5 |
| `operation_logs`  | 監査ログ (全 mutating 操作)                              | RULE.md §1.2 Step 8 |
| `service_meta`    | サービスレベル KV (feature flag / バージョン stamp 等)   |      |

実 DDL は `migrations/001_init.sql`、Drizzle 定義は
`src/db/schema.ts` に一致させる。スキーマ変更は

1. `migrations/NNN_*.sql` を追加 (DROP 禁止 / IF NOT EXISTS)
2. `src/db/schema.ts` を更新
3. 本ファイルの表を更新

の 3 点セット。
