/// Attaches a request id to every incoming request so audit logs can
/// correlate a `module_request` with the HTTP hit that spawned it.

import type { MiddlewareHandler } from "hono";
import { v4 as uuidv4 } from "uuid";

export function requestIdMiddleware(): MiddlewareHandler {
    return async (c, next) => {
        const incoming = c.req.header("X-Request-Id");
        const id = incoming && incoming.length > 0 ? incoming : uuidv4();
        c.set("requestId", id);
        c.res.headers.set("X-Request-Id", id);
        await next();
    };
}
