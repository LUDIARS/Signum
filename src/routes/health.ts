/// Public health endpoints. Kept outside the auth-gated `/api/*` block
/// so infra probes (docker healthcheck / nginx) can hit them without
/// credentials.

import type { Hono } from "hono";

import { pingRedis } from "../db/redis.js";
import { pingDb } from "../db/repository.js";

/**
 * Mount health endpoints directly on the root app (no sub-app). Hono's
 * sub-app mounting applies auth middleware registered on the parent's
 * path pattern even when a more-specific sub-app is registered first,
 * so we bypass the composition by attaching handlers explicitly.
 *
 * Paths: `/api/health`, `/api/health/`, `/api/health/ready`, `/api/health/version`.
 */
export function registerHealthRoutes(app: Hono): void {
    const alive = () => Response.json({ ok: true, service: "signum" });

    app.get("/api/health",  () => alive());
    app.get("/api/health/", () => alive());

    app.get("/api/health/ready", async () => {
        const [db, redis] = await Promise.all([pingDb(), pingRedis()]);
        const ok = db && redis;
        return Response.json({ ok, db, redis }, { status: ok ? 200 : 503 });
    });

    app.get("/api/health/version", () => Response.json({
        service:  "signum",
        version:  process.env.npm_package_version ?? "0.0.1",
        node:     process.version,
        uptime:   process.uptime(),
        node_env: process.env.NODE_ENV ?? "development",
    }));
}
