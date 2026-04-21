/// Signum core schema — FK-anchor-only users, plus an `operation_logs`
/// audit table per RULE.md §1.2 Step 8 and a `service_meta` KV for
/// service-level configuration.
///
/// PERSONAL DATA POLICY (RULE.md §5): this schema MUST NOT carry
/// names / emails / roles / auth tokens. Anything user-facing is
/// resolved at read time via `@cernere/id-cache`.

import {
    pgTable,
    uuid,
    text,
    timestamp,
    jsonb,
    boolean,
    index,
} from "drizzle-orm/pg-core";

/**
 * Anchor table for cross-table FKs. Holds only `id` (mirrors Cernere
 * `user.id`) and activity flags. Never populate with display data.
 */
export const users = pgTable("users", {
    id:        uuid("id").primaryKey(),
    isActive:  boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
});

/**
 * Operation log — RULE.md §1.2 Step 8. Every mutating request writes
 * one row. Kept service-local so GDPR opt-out in Cernere cascades here
 * via FK on delete.
 */
export const operationLogs = pgTable("operation_logs", {
    id:        uuid("id").primaryKey(),
    userId:    uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    action:    text("action").notNull(),          // e.g. "module_request:signum.foo.bar"
    status:    text("status").notNull(),          // "ok" | "error"
    payload:   jsonb("payload"),                   // request params (sanitised)
    error:     text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
    byUser:  index("op_logs_user_idx").on(t.userId, t.createdAt),
    byAction: index("op_logs_action_idx").on(t.action, t.createdAt),
}));

/**
 * Service-level KV store — feature flags, runtime tuning, schema version
 * stamps, etc. Not a general user store.
 */
export const serviceMeta = pgTable("service_meta", {
    key:       text("key").primaryKey(),
    value:     jsonb("value").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User          = typeof users.$inferSelect;
export type NewUser       = typeof users.$inferInsert;
export type OperationLog  = typeof operationLogs.$inferSelect;
export type NewOperationLog = typeof operationLogs.$inferInsert;
