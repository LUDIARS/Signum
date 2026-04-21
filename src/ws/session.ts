/// WebSocket session handler — implements the RULE.md §1.2 protocol
/// (hello / ping-pong / module_request / relay) in its minimum form.
///
/// This module deliberately does *not* own authentication: the `GET /ws`
/// handshake verifies `token` / `session_id` through Cernere id-cache
/// (or the dev fallback) and hands a user id in. WS here just owns the
/// protocol state machine.

import type { WebSocket } from "ws";

import { recordOperation } from "../middleware/audit.js";

type ClientState = "fresh" | "hello" | "closed";

export interface ModuleHandlerCtx {
    userId:    string;
    sessionId: string;
    send(msg: unknown): void;
}

/** Map of `"moduleId.action"` → handler. Keep small and explicit. */
export type ModuleRegistry = Record<string, (payload: unknown, ctx: ModuleHandlerCtx) => Promise<unknown>>;

export interface SessionOptions {
    userId:    string;
    sessionId: string;
    modules:   ModuleRegistry;
    /** Seconds between pings (default 30, per RULE.md §1.2 Step 2). */
    pingIntervalS?: number;
    /** Pong wait before we drop the connection (default 10). */
    pongTimeoutS?:  number;
}

interface Env {
    ping?: NodeJS.Timeout;
    pong?: NodeJS.Timeout;
}

export function attachSession(ws: WebSocket, opts: SessionOptions): void {
    const pingEveryMs = (opts.pingIntervalS ?? 30) * 1000;
    const pongWaitMs  = (opts.pongTimeoutS  ?? 10) * 1000;

    const env: Env = {};
    let   state: ClientState = "fresh";

    function send(msg: unknown) {
        if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
    }

    function schedulePing() {
        env.ping = setTimeout(() => {
            if (state === "closed") return;
            send({ type: "ping", ts: Date.now() });
            env.pong = setTimeout(() => {
                if (state !== "closed") {
                    send({ type: "error", code: "pong_timeout", message: "client missed pong" });
                    ws.close();
                }
            }, pongWaitMs);
        }, pingEveryMs);
    }

    // Initial hello — RULE.md §1.2 Step 1.
    send({
        type:       "connected",
        session_id: opts.sessionId,
        user_state: { role: "general" },   // host can enrich later
    });
    state = "hello";
    schedulePing();

    ws.on("message", async (raw) => {
        let msg: { type?: string; [k: string]: unknown };
        try { msg = JSON.parse(raw.toString()) as typeof msg; }
        catch {
            send({ type: "error", code: "bad_json", message: "invalid JSON frame" });
            return;
        }

        switch (msg.type) {
            case "pong": {
                if (env.pong) clearTimeout(env.pong);
                schedulePing();
                return;
            }

            case "module_request": {
                const module = String(msg.module ?? "");
                const action = String(msg.action ?? "");
                const key    = `${module}.${action}`;
                const handler = opts.modules[key];
                if (!handler) {
                    send({ type: "error", code: "unknown_action", message: `no handler for ${key}` });
                    return;
                }
                try {
                    const payload = msg.payload;
                    const result  = await handler(payload, {
                        userId:    opts.userId,
                        sessionId: opts.sessionId,
                        send,
                    });
                    send({ type: "module_response", module, action, payload: result ?? {} });
                    await recordOperationAsync(opts.userId, `ws:${key}`, "ok", payload);
                } catch (err) {
                    const message = (err as Error).message ?? "handler error";
                    send({ type: "error", code: "command_error", message });
                    await recordOperationAsync(opts.userId, `ws:${key}`, "error", msg.payload, message);
                }
                return;
            }

            default: {
                send({ type: "error", code: "bad_frame", message: `unsupported type: ${msg.type}` });
            }
        }
    });

    ws.on("close", () => {
        state = "closed";
        if (env.ping) clearTimeout(env.ping);
        if (env.pong) clearTimeout(env.pong);
    });
    ws.on("error", () => { /* close handler will run */ });
}

// Small bridge that avoids importing Hono's Context inside the WS path.
async function recordOperationAsync(
    userId:  string,
    action:  string,
    status:  "ok" | "error",
    payload: unknown,
    error?:  string,
): Promise<void> {
    try {
        const { operationLogRepo } = await import("../db/repository.js");
        await operationLogRepo.record({
            userId:  userId === "anonymous" ? null : userId,
            action,
            status,
            payload: payload ?? null,
            error:   error   ?? null,
        });
    } catch { /* best-effort */ }
}
