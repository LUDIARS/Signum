import { defineConfig } from "drizzle-kit";

export default defineConfig({
    schema:  "./src/db/schema.ts",
    out:     "./migrations",
    dialect: "postgresql",
    dbCredentials: {
        // Populated from env-cli / Infisical at runtime.
        url: process.env.SIGNUM_DATABASE_URL ?? process.env.DATABASE_URL
             ?? "postgresql://postgres:postgres@localhost:5432/signum",
    },
});
