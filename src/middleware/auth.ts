/// Hono middleware — delegates auth to Cernere through @cernere/id-cache.
///
/// RULE.md §1 + FORMAT_AUTH.md §3 dictate that every `/api/*` route
/// verifies a Bearer token (or dev header fallback) before handling.
/// Unauthenticated traffic is rejected with 401 here.

import type { Context, MiddlewareHandler, Next } from "hono";

import { env } from "../config/env.js";
import { userRepo } from "../db/repository.js";

type IdCacheMiddleware = MiddlewareHandler;

let _wrappedMiddleware: IdCacheMiddleware | null = null;
let _wrappedReady      = false;

/// Lazily import `@cernere/id-cache`. The package lives in another
/// LUDIARS repo; during `npm install` it may be absent (e.g. fresh
/// clone before workspaces are wired). In that case we fall back to a
/// minimal JWT decoder so local dev still works.
async function loadIdCacheMiddleware(): Promise<IdCacheMiddleware | null> {
    if (_wrappedReady) return _wrappedMiddleware;
    _wrappedReady = true;
    try {
        // Types from @ludiars/cernere-id-cache vary across consumer
        // versions (schedula vs cernere-composite), so pin a permissive
        // structural shape via an `unknown` hop instead of importing
        // the published types directly.
        const raw = (await import("@ludiars/cernere-id-cache")) as unknown;
        const mod = raw as {
            createIdCache?: (opts: Record<string, unknown>) => unknown;
            createIdCacheMiddleware?: (opts: Record<string, unknown>) => IdCacheMiddleware;
        };
        if (!mod.createIdCache || !mod.createIdCacheMiddleware) return null;

        const idCache = mod.createIdCache({
            idServiceUrl:    env.cernere.url,
            jwtSecret:       env.cernere.jwtSecret || undefined,
            cacheTtlSeconds: 300,
            maxCacheSize:    10_000,
        });
        _wrappedMiddleware = mod.createIdCacheMiddleware({
            idCache,
            jwtSecret: env.cernere.jwtSecret || undefined,
            isDev:     env.nodeEnv !== "production",
        });
        return _wrappedMiddleware;
    } catch {
        return null;
    }
}

/// Development-only fallback: accept `X-User-Id` / `X-User-Role`
/// headers (FORMAT_AUTH.md §3.6). In production these are ignored.
function devFallback(): IdCacheMiddleware {
    return async (c: Context, next: Next) => {
        if (env.nodeEnv === "production") {
            // Production without id-cache installed = misconfiguration.
            return c.json({ error: "auth middleware not installed" }, 500);
        }
        const id   = c.req.header("X-User-Id")   ?? "anonymous";
        const role = c.req.header("X-User-Role") ?? "general";
        c.set("userId",   id);
        c.set("userRole", role);
        c.set("user",     { id, role });
        await next();
    };
}

export function authMiddleware(): MiddlewareHandler {
    return async (c, next) => {
        const mw = await loadIdCacheMiddleware();
        if (mw) return mw(c, next);
        return devFallback()(c, next);
    };
}

/// Reject handlers that received `anonymous`. Use this on every mutating
/// or auth-required route after `authMiddleware()`.
export function requireAuth(): MiddlewareHandler {
    return async (c, next) => {
        const userId = c.get("userId");
        if (!userId || userId === "anonymous") {
            return c.json({ error: "Unauthorized" }, 401);
        }
        // Touch the FK anchor + last_seen stamp. Non-blocking on failure
        // — the route still runs even if the DB is briefly unavailable.
        void Promise.resolve().then(async () => {
            try {
                await userRepo.ensure(userId);
                await userRepo.touchSeen(userId);
            } catch { /* best-effort */ }
        });
        await next();
    };
}

/// Extract a typed user context inside a handler.
export function currentUser(c: Context): { id: string; role: string } {
    const id   = (c.get("userId")   as string | undefined) ?? "anonymous";
    const role = (c.get("userRole") as string | undefined) ?? "general";
    return { id, role };
}
