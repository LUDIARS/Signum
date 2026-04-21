/// Best-effort audit-log writer for mutating operations (RULE.md §1.2
/// Step 8). Wraps a handler and records an operation_log row after it
/// completes. Failures in logging never break the request.

import type { Context } from "hono";

import { operationLogRepo } from "../db/repository.js";

export async function recordOperation(
    c: Context,
    action: string,
    result: "ok" | "error",
    opts: { payload?: unknown; error?: string } = {},
): Promise<void> {
    try {
        const userId = (c.get("userId") as string | undefined) ?? null;
        await operationLogRepo.record({
            userId:  userId === "anonymous" ? null : userId,
            action,
            status:  result,
            payload: opts.payload ?? null,
            error:   opts.error   ?? null,
        });
    } catch {
        // Never fail the request because we couldn't log it.
    }
}
