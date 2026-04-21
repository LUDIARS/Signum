import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Vite dev server proxies `/api` and `/ws` to the Hono backend so the
// SPA can talk to both over the same origin — matching the nginx
// layout described in AIFormat RULE_TECH_STACK.md.
export default defineConfig({
    plugins: [react(), tailwindcss()],
    server: {
        port: 8083,
        proxy: {
            "/api": { target: "http://localhost:3200", changeOrigin: true },
            "/ws":  { target: "ws://localhost:3200",   ws: true },
        },
    },
    preview: { port: 8083 },
    build:  { outDir: "dist", sourcemap: true },
});
