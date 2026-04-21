/// POST /api/trace — accept a PNG body, emit an SVG outline.
///
/// Contract:
///   - Request:  `Content-Type: image/png`, raw PNG bytes as body.
///               Query params (all optional):
///                 `detail` in [0, 1]           (default 0.5)
///                 `stroke` CSS color           (default "#000000")
///                 `strokeWidth` number         (default 1.0)
///                 `background` CSS color | null (default null)
///                 `minContourLength` integer   (default 2)
///   - Response: 200 `image/svg+xml` — traced SVG document.
///               400 on missing body / unsupported format / bad params.
///               413 if the payload exceeds `MAX_BYTES`.

import { Hono } from "hono";
import { z } from "zod";

import { decodeToGrayscale, UnsupportedImageError } from "../domain/image.js";
import { traceGrayscale } from "../domain/tracer.js";

const MAX_BYTES = 16 * 1024 * 1024; // 16 MiB — generous ceiling for a PNG.

const QuerySchema = z.object({
    detail: z.coerce.number().min(0).max(1).optional(),
    stroke: z.string().min(1).max(64).optional(),
    strokeWidth: z.coerce.number().min(0).max(100).optional(),
    background: z.string().min(1).max(64).optional(),
    minContourLength: z.coerce.number().int().min(2).max(1_000_000).optional(),
});

export function traceRoutes(): Hono {
    const app = new Hono();

    app.post("/", async (c) => {
        const contentType = c.req.header("content-type") ?? "";
        if (!contentType.toLowerCase().startsWith("image/png")) {
            return c.json(
                { error: "Content-Type must be image/png" },
                400,
            );
        }

        const parsed = QuerySchema.safeParse(c.req.query());
        if (!parsed.success) {
            return c.json(
                { error: "invalid query parameters", issues: parsed.error.issues },
                400,
            );
        }

        const raw = await c.req.arrayBuffer();
        if (raw.byteLength === 0) {
            return c.json({ error: "empty request body" }, 400);
        }
        if (raw.byteLength > MAX_BYTES) {
            return c.json(
                { error: "payload too large", maxBytes: MAX_BYTES },
                413,
            );
        }

        let svg: string;
        try {
            const image = decodeToGrayscale(Buffer.from(raw));
            svg = traceGrayscale(image, parsed.data);
        } catch (err) {
            if (err instanceof UnsupportedImageError) {
                return c.json({ error: err.message }, 400);
            }
            if (err instanceof RangeError) {
                return c.json({ error: err.message }, 400);
            }
            throw err;
        }

        return new Response(svg, {
            status: 200,
            headers: { "content-type": "image/svg+xml; charset=utf-8" },
        });
    });

    return app;
}
