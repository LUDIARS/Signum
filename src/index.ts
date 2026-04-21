/// Signum service entry point. Boots the HTTP + WS server and wires
/// the hub to the upgrade handler (RULE.md §1.2 Step 1).

import { serve } from "@hono/node-server";
import { WebSocketServer } from "ws";
import { parse as parseUrl } from "node:url";

import { createApp } from "./app.js";
import { env, requireProductionEnv } from "./config/env.js";
import { WsHub } from "./ws/hub.js";
import type { ModuleRegistry } from "./ws/session.js";

requireProductionEnv();

// Application-level module handlers — add new (module, action) pairs
// here as features grow. The auth pipeline above treats this as the
// single allow-list for WS RPC.
const modules: ModuleRegistry = {
    "signum.ping": async () => ({ pong: Date.now() }),
};

const app = createApp();

const server = serve({ fetch: app.fetch, port: env.port }, (info) => {
    console.log(`[signum] listening on http://localhost:${info.port}`);
    console.log(`[signum]   cernere: ${env.cernere.url}`);
    console.log(`[signum]   node_env: ${env.nodeEnv}`);
});

// WebSocket upgrade routing — accept only `/ws`, look up auth via the
// dev header fallback (production will plug in Cernere id-cache).
const wss = new WebSocketServer({ noServer: true });
const hub = new WsHub();

server.on("upgrade", (req, socket, head) => {
    const url = parseUrl(req.url ?? "/", true);
    if (url.pathname !== "/ws") {
        socket.destroy();
        return;
    }
    // MVP: expect `token` or `session_id` in the query. Real auth
    // resolution happens once the dev fallback is replaced with the
    // Cernere id-cache ws-verify path.
    const query = url.query ?? {};
    const token     = typeof query.token      === "string" ? query.token      : "";
    const sessionId = typeof query.session_id === "string" ? query.session_id : "";
    if (env.nodeEnv === "production" && !token && !sessionId) {
        socket.destroy();
        return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
        const userId = typeof query.user_id === "string" && query.user_id
            ? query.user_id
            : "dev-user";
        const sid = sessionId || `sess-${Date.now().toString(36)}`;
        hub.register(ws, userId, sid, modules);
    });
});

function shutdown(): void {
    console.log("[signum] shutting down");
    server.close();
}
process.on("SIGINT",  shutdown);
process.on("SIGTERM", shutdown);

export { app };
