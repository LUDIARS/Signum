/// WebSocket hub — tracks live sessions and implements RULE.md §1.2
/// Step 4 relay semantics (same-user scope by default).

import type { WebSocket } from "ws";

import { attachSession, type ModuleRegistry } from "./session.js";

interface Conn {
    ws:        WebSocket;
    userId:    string;
    sessionId: string;
}

export class WsHub {
    private readonly conns = new Map<string, Conn>();

    register(ws: WebSocket, userId: string, sessionId: string, modules: ModuleRegistry): void {
        this.conns.set(sessionId, { ws, userId, sessionId });
        ws.on("close", () => this.conns.delete(sessionId));

        attachSession(ws, {
            userId, sessionId, modules,
        });

        // Relay frames are handled at the hub level (separate from the
        // module_request handler) so that one user's sessions can fan
        // messages at each other without per-module boilerplate.
        ws.on("message", (raw) => {
            let msg: { type?: string; target?: unknown; payload?: unknown };
            try { msg = JSON.parse(raw.toString()) as typeof msg; }
            catch { return; }
            if (msg.type !== "relay") return;
            this.handleRelay(sessionId, userId, msg);
        });
    }

    private handleRelay(
        fromSessionId: string,
        fromUserId:    string,
        msg:           { target?: unknown; payload?: unknown },
    ): void {
        const payload = msg.payload;
        const target  = msg.target;

        const matches: Conn[] = [];
        if (target === "broadcast") {
            // All other sessions of the same user.
            for (const c of this.conns.values()) {
                if (c.userId === fromUserId && c.sessionId !== fromSessionId) matches.push(c);
            }
        } else if (target && typeof target === "object") {
            const t = target as { user?: string; session?: string };
            for (const c of this.conns.values()) {
                if (t.session && c.sessionId === t.session) matches.push(c);
                // Cross-user relay is denied (RULE.md §1.4).
                else if (t.user && c.userId === fromUserId && c.userId === t.user) matches.push(c);
            }
        }

        const wire = JSON.stringify({
            type:         "relayed",
            from_session: fromSessionId,
            payload,
        });
        for (const c of matches) {
            if (c.ws.readyState === c.ws.OPEN) c.ws.send(wire);
        }
    }

    clientCount(): number { return this.conns.size; }
}
