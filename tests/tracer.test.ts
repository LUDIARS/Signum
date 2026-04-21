/// Tests for the pure-function tracer. Runs under vitest without needing
/// the HTTP server wired up — the tracer is intentionally independent of
/// Hono / Cernere so domain regressions surface fast.

import { describe, expect, it } from "vitest";

import {
    boundarySegments,
    chainSegments,
    thresholdsForDetail,
    traceGrayscale,
    type GrayscaleImage,
} from "../src/domain/tracer.js";

function solidDisc(size = 32, radius = 10): GrayscaleImage {
    const data = new Uint8Array(size * size).fill(255);
    const cx = size / 2;
    const cy = size / 2;
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const dx = x + 0.5 - cx;
            const dy = y + 0.5 - cy;
            if (dx * dx + dy * dy <= radius * radius) data[y * size + x] = 0;
        }
    }
    return { width: size, height: size, data };
}

function patterned(size = 32): GrayscaleImage {
    const data = new Uint8Array(size * size).fill(255);
    const cx = size / 2;
    const cy = size / 2;
    const shell = (r: number, v: number) => {
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const dx = x + 0.5 - cx;
                const dy = y + 0.5 - cy;
                if (dx * dx + dy * dy <= r * r) data[y * size + x] = v;
            }
        }
    };
    shell(12, 40);
    shell(8,  140);
    shell(4,  40);
    return { width: size, height: size, data };
}

describe("traceGrayscale", () => {
    it("emits a single closed path for a filled disc at detail=0", () => {
        const svg = traceGrayscale(solidDisc(), { detail: 0 });
        expect(svg).toMatch(/^<\?xml/);
        const paths = [...svg.matchAll(/<path\s[^>]*d="([^"]+)"/g)];
        expect(paths).toHaveLength(1);
        expect(paths[0]![1]).toMatch(/^M/);
        expect(paths[0]![1]).toMatch(/Z\s*$/);
    });

    it("produces more moves at high detail than at low detail", () => {
        const img = patterned();
        const low  = traceGrayscale(img, { detail: 0 });
        const high = traceGrayscale(img, { detail: 1 });
        const count = (svg: string) => (svg.match(/\bM\d/g) ?? []).length;
        expect(count(high)).toBeGreaterThan(count(low));
    });

    it("rejects detail outside [0, 1]", () => {
        expect(() => traceGrayscale(solidDisc(), { detail: 1.5 })).toThrow(RangeError);
        expect(() => traceGrayscale(solidDisc(), { detail: -0.1 })).toThrow(RangeError);
    });

    it("preserves image dimensions in the SVG attributes", () => {
        const svg = traceGrayscale(solidDisc(24), { detail: 0.3 });
        expect(svg).toContain('viewBox="0 0 24 24"');
        expect(svg).toContain('width="24"');
        expect(svg).toContain('height="24"');
    });

    it("adds a background rect when requested", () => {
        const svg = traceGrayscale(solidDisc(), { detail: 0.5, background: "white" });
        expect(svg).toMatch(/<rect[^>]*fill="white"/);
    });

    it("escapes attribute values defensively", () => {
        const svg = traceGrayscale(solidDisc(), {
            detail: 0.5,
            stroke: 'red" onclick="x',
        });
        expect(svg).not.toContain('onclick="x');
        expect(svg).toContain("&quot;");
    });
});

describe("boundarySegments / chainSegments", () => {
    it("closes the boundary of a solid 3x3 square", () => {
        const data = new Uint8Array(5 * 5).fill(255);
        for (let y = 1; y <= 3; y++) {
            for (let x = 1; x <= 3; x++) data[y * 5 + x] = 0;
        }
        const segments = boundarySegments(
            { width: 5, height: 5, data },
            128,
        );
        expect(segments).toHaveLength(12);
        const polylines = chainSegments(segments);
        expect(polylines).toHaveLength(1);
        const poly = polylines[0]!;
        expect(poly[0]).toEqual(poly[poly.length - 1]);
    });
});

describe("thresholdsForDetail", () => {
    it("returns a single threshold at detail=0 and more at detail=1", () => {
        const data = new Uint8Array(256 * 16);
        for (let y = 0; y < 16; y++) {
            for (let x = 0; x < 256; x++) data[y * 256 + x] = x;
        }
        const image = { width: 256, height: 16, data };
        expect(thresholdsForDetail(0, image)).toHaveLength(1);
        expect(thresholdsForDetail(1, image).length).toBeGreaterThan(1);
    });
});
