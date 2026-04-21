/// Repository layer — RULE_TECH_STACK.md enforces that route handlers
/// never touch Drizzle directly. All data access goes through named
/// repos here so the dialect surface stays thin and mockable.

import { and, desc, eq, gt, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

import { getDb } from "./connection.js";
import {
    operationLogs,
    serviceMeta,
    users,
    type NewOperationLog,
    type NewUser,
    type OperationLog,
    type User,
} from "./schema.js";

// ---------------------------------------------------------------------------
// userRepo — FK anchor only. No personal data.
// ---------------------------------------------------------------------------

export const userRepo = {
    async ensure(id: string): Promise<User> {
        const db = getDb();
        const [existing] = await db.select().from(users).where(eq(users.id, id)).limit(1);
        if (existing) return existing;
        const payload: NewUser = { id };
        const [created] = await db.insert(users).values(payload).returning();
        return created!;
    },

    async touchSeen(id: string): Promise<void> {
        const db = getDb();
        await db.update(users).set({ lastSeenAt: new Date() }).where(eq(users.id, id));
    },

    async findById(id: string): Promise<User | undefined> {
        const db = getDb();
        const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
        return row;
    },
};

// ---------------------------------------------------------------------------
// operationLogRepo — audit trail (RULE.md §1.2 Step 8).
// ---------------------------------------------------------------------------

export const operationLogRepo = {
    async record(input: Omit<NewOperationLog, "id" | "createdAt">): Promise<OperationLog> {
        const db = getDb();
        const [row] = await db.insert(operationLogs).values({ id: uuidv4(), ...input }).returning();
        return row!;
    },

    async listRecent(limit = 100): Promise<OperationLog[]> {
        const db = getDb();
        return await db.select().from(operationLogs).orderBy(desc(operationLogs.createdAt)).limit(limit);
    },

    async listByUser(userId: string, limit = 50): Promise<OperationLog[]> {
        const db = getDb();
        return await db.select().from(operationLogs)
            .where(eq(operationLogs.userId, userId))
            .orderBy(desc(operationLogs.createdAt))
            .limit(limit);
    },

    async pruneOlderThan(cutoff: Date): Promise<number> {
        const db = getDb();
        const result = await db.delete(operationLogs)
            .where(sql`${operationLogs.createdAt} < ${cutoff}`);
        return result.count ?? 0;
    },
};

// ---------------------------------------------------------------------------
// serviceMetaRepo — small KV for runtime config + migration stamps.
// ---------------------------------------------------------------------------

export const serviceMetaRepo = {
    async get<T = unknown>(key: string): Promise<T | null> {
        const db = getDb();
        const [row] = await db.select().from(serviceMeta).where(eq(serviceMeta.key, key)).limit(1);
        return (row?.value as T | undefined) ?? null;
    },

    async set<T extends object>(key: string, value: T): Promise<void> {
        const db = getDb();
        await db.insert(serviceMeta)
            .values({ key, value })
            .onConflictDoUpdate({ target: serviceMeta.key, set: { value, updatedAt: new Date() } });
    },

    async delete(key: string): Promise<void> {
        const db = getDb();
        await db.delete(serviceMeta).where(eq(serviceMeta.key, key));
    },
};

// Handy helper used by health checks — keep near the repos for discoverability.
export async function pingDb(): Promise<boolean> {
    const db = getDb();
    try {
        await db.execute(sql`select 1`);
        return true;
    } catch {
        return false;
    }
}

// Narrow re-export so callers avoid importing raw tables from schema.ts by accident.
export { and, eq, gt, desc };
