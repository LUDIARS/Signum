/// env-cli manifest. Mirrors AIFormat RULE_TECH_STACK.md guidance —
/// secrets live in Infisical; `@cernere/env-cli` generates `.env` at
/// build time.

export default {
    projectId: "signum",
    defaults: {
        NODE_ENV:             "development",
        SIGNUM_PORT:          "3200",
        SIGNUM_CORS_ORIGINS:  "http://localhost:8083,http://localhost:5173",

        // Cross-service (shared infra). Override per-env via Infisical.
        CERNERE_URL:          "http://localhost:3000",
        SIGNUM_DATABASE_URL:  "postgresql://postgres:postgres@localhost:5432/signum",
        SIGNUM_REDIS_URL:     "redis://localhost:6379/4",

        // Sensitive — set via `npm run env:set`, never committed.
        JWT_SECRET:           "",
        TOOL_CLIENT_ID:       "",
        TOOL_CLIENT_SECRET:   "",
    },
    required: {
        production: ["JWT_SECRET", "CERNERE_URL", "SIGNUM_DATABASE_URL", "SIGNUM_REDIS_URL"],
    },
};
