-- Initial migration for Signum.
-- AIFormat RULE.md §2 compliance:
--  * Idempotent: uses IF NOT EXISTS so re-runs are safe.
--  * No DROP: schema evolution is additive-only.
--  * Numbered file (001_*) — never reuse.

-- FK anchor for Cernere user ids. No personal data lives here
-- (RULE.md §5).
CREATE TABLE IF NOT EXISTS users (
    id           UUID PRIMARY KEY,
    is_active    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ
);

-- Audit log — RULE.md §1.2 Step 8.
CREATE TABLE IF NOT EXISTS operation_logs (
    id         UUID PRIMARY KEY,
    user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
    action     TEXT NOT NULL,
    status     TEXT NOT NULL,
    payload    JSONB,
    error      TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS op_logs_user_idx   ON operation_logs (user_id, created_at);
CREATE INDEX IF NOT EXISTS op_logs_action_idx ON operation_logs (action,  created_at);

-- Service-level KV for feature flags, migration stamps, etc.
CREATE TABLE IF NOT EXISTS service_meta (
    key        TEXT PRIMARY KEY,
    value      JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
