/// Ad-hoc migration runner. Applies every `migrations/*.sql` in lexical
/// order, splitting on `;` and tolerating the idempotent PostgreSQL
/// errors listed in AIFormat RULE.md §2.

import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

import postgres from "postgres";

import { env } from "../config/env.js";

const SKIPPABLE = new Set([
    "42P07", // relation already exists
    "42701", // column already exists
    "42710", // object already exists
    "42P01", // relation does not exist
    "42704", // type does not exist
    "23505", // duplicate key
]);

async function main() {
    const here = dirname(fileURLToPath(import.meta.url));
    const dir  = resolve(here, "../../migrations");

    const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
    if (files.length === 0) {
        console.log("[signum:migrate] no migration files");
        return;
    }

    const sql = postgres(env.databaseUrl, { max: 1 });
    try {
        for (const f of files) {
            const body = await readFile(join(dir, f), "utf8");
            console.log(`[signum:migrate] applying ${f}`);
            const statements = body.split(/;\s*(?:\r?\n|$)/)
                .map((s) => s.trim())
                .filter((s) => s.length > 0 && !s.startsWith("--"));
            for (const stmt of statements) {
                try {
                    await sql.unsafe(stmt);
                } catch (err) {
                    const pgCode = (err as { code?: string }).code;
                    if (pgCode && SKIPPABLE.has(pgCode)) {
                        console.log(`  · skipped (${pgCode}): ${stmt.slice(0, 60)}…`);
                        continue;
                    }
                    throw err;
                }
            }
        }
        console.log("[signum:migrate] done");
    } finally {
        await sql.end({ timeout: 5 });
    }
}

main().catch((err) => {
    console.error("[signum:migrate] failed:", err);
    process.exit(1);
});
