/// PostgreSQL connection + Drizzle binding.
///
/// AIFormat `RULE_TECH_STACK.md` mandates Drizzle for all schema access;
/// the runtime driver is `postgres-js`. Ruby-style connection pool is
/// created lazily so modules can import `db` without forcing network
/// I/O at import time (tests stub this).

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "../config/env.js";
import * as schema from "./schema.js";

let _sql: ReturnType<typeof postgres> | null = null;
let _db:  ReturnType<typeof drizzle>  | null = null;

function getPool() {
    if (_sql) return _sql;
    _sql = postgres(env.databaseUrl, { max: 10, onnotice: () => {} });
    return _sql;
}

export function getDb() {
    if (_db) return _db;
    _db = drizzle(getPool(), { schema });
    return _db;
}

/** Close the pool. Used by tests and graceful shutdown. */
export async function closeDb(): Promise<void> {
    if (_sql) await _sql.end({ timeout: 5 });
    _sql = null;
    _db  = null;
}

export { schema };
