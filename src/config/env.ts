/// Environment variable accessor with narrow typing + required guards.
///
/// Signum treats env vars as the single source of configuration: the
/// Infisical-backed `@cernere/env-cli` drops a `.env` before `dev` /
/// `start`, and this module reads it with strict parsing.
///
/// Kept free of side effects (no network / no Infisical direct calls)
/// so tests can stub `process.env`.

function required(name: string): string {
    const v = process.env[name];
    if (!v || v.trim().length === 0) {
        throw new Error(`environment variable ${name} is required`);
    }
    return v;
}

function optional(name: string, fallback: string): string {
    const v = process.env[name];
    return v && v.length > 0 ? v : fallback;
}

function optionalNumber(name: string, fallback: number): number {
    const v = process.env[name];
    if (!v) return fallback;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
}

export const env = {
    /** Application listen port. Separate from BACKEND_PORT so Docker composition is flexible. */
    port: optionalNumber("SIGNUM_PORT", optionalNumber("BACKEND_PORT", 3200)),

    /** Comma-separated origins; in dev, the Vite dev server (8083) is automatically allowed. */
    corsOrigins: optional(
        "SIGNUM_CORS_ORIGINS",
        "http://localhost:8083,http://localhost:5173",
    ).split(",").map((s) => s.trim()).filter(Boolean),

    nodeEnv: optional("NODE_ENV", "development"),

    /** Cernere — RULE.md §1, FORMAT_AUTH.md §3. */
    cernere: {
        url:          optional("CERNERE_URL", "http://localhost:3000"),
        jwtSecret:    process.env.JWT_SECRET ?? "",
        toolClientId: process.env.TOOL_CLIENT_ID ?? "",
        toolClientSecret: process.env.TOOL_CLIENT_SECRET ?? "",
    },

    /** PostgreSQL — shared LUDIARS/Infra. `SIGNUM_DATABASE_URL` overrides `DATABASE_URL`. */
    databaseUrl: optional(
        "SIGNUM_DATABASE_URL",
        optional("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/signum"),
    ),

    /** Redis — shared LUDIARS/Infra; separate DB number per service. */
    redisUrl: optional(
        "SIGNUM_REDIS_URL",
        optional("REDIS_URL", "redis://localhost:6379/4"),
    ),

    /** Toggle verbose request logs. Off by default in production. */
    verboseLogging: optional("SIGNUM_VERBOSE", optional("NODE_ENV", "development")) !== "production",
};

export function requireProductionEnv(): void {
    // Extra guards that only fire in production so `npm run dev` stays frictionless.
    if (env.nodeEnv === "production") {
        required("JWT_SECRET");
        required("CERNERE_URL");
        required("SIGNUM_DATABASE_URL");
        required("SIGNUM_REDIS_URL");
    }
}
