/// /api/me — returns the current session's user info resolved from
/// Cernere. Exists as a smoke test for the auth pipeline.

import { Hono } from "hono";

import { getUserInfo } from "../auth/user-info.js";
import { currentUser } from "../middleware/auth.js";

export function meRoutes(): Hono {
    const app = new Hono();

    app.get("/", async (c) => {
        const { id, role } = currentUser(c);
        const info = await getUserInfo(id);
        return c.json({
            id:          info.id,
            displayName: info.displayName,
            email:       info.email,
            role:        role || info.role,
            resolved:    info.resolved,
        });
    });

    return app;
}
