/// Hono app composition — the HTTP surface for Signum.
///
/// Layering matches RULE.md:
///   - `/api/health*`     public probes (docker / nginx healthcheck)
///   - `/api/*`           auth-gated (Cernere id-cache → requireAuth)
///   - `/ws`              WebSocket upgrade → WsHub (RULE.md §1.2)
///
/// No business logic lives in this file — route modules own their own
/// Hono sub-apps. Keep this file focused on wiring + middleware order.

import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import { env } from "./config/env.js";
import { authMiddleware, requireAuth } from "./middleware/auth.js";
import { requestIdMiddleware } from "./middleware/request-id.js";
import { registerHealthRoutes } from "./routes/health.js";
import { meRoutes } from "./routes/me.js";

export function createApp(): Hono {
    const app = new Hono();

    app.use("*", requestIdMiddleware());

    // CORS — Vite dev server + explicit allow-list.
    app.use("*", cors({
        origin: env.corsOrigins,
        allowHeaders: ["Content-Type", "Authorization", "X-Request-Id", "X-User-Id", "X-User-Role"],
        allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        credentials: true,
    }));

    if (env.verboseLogging) app.use("*", logger());

    // Public health / version — attached directly (no sub-app) so the
    // auth gate on `/api/*` can't accidentally shadow the trailing-slash
    // variant that Docker / nginx healthchecks tend to use.
    registerHealthRoutes(app);

    // Auth-gated API surface. Keeping the middleware inside the sub-app
    // (instead of `app.use("/api/*", …)`) scopes the gate to routes
    // registered on `api` — health above stays untouched even though it
    // shares the `/api/` prefix.
    const api = new Hono();
    api.use("*", authMiddleware());
    api.use("*", requireAuth());
    api.route("/me", meRoutes());

    app.route("/api", api);

    // Root landing — lets `curl localhost:3200/` return something meaningful.
    app.get("/", (c) => c.json({ service: "signum", docs: "/api/health/version" }));

    return app;
}
