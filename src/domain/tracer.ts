/// Image → SVG outline tracer. Pure function over grayscale pixel data —
/// no I/O, no image decoding, no Hono types. Keeps the domain testable
/// without a running HTTP server and decouples tracing from whichever
/// decoder the route handler chooses to feed it.
///
/// A `detail` slider in [0.0, 1.0] scales the number of luminance
/// thresholds used for contour extraction:
///   - 0.0 → single median silhouette (外観のみ)
///   - 1.0 → MAX_LEVELS nested contours (模様まで)
/// producing a smooth gradient between "bare outline" and "all patterns".

export interface GrayscaleImage {
    /** Image width in pixels. */
    width: number;
    /** Image height in pixels. */
    height: number;
    /** Row-major luminance bytes, length === width * height. */
    data: Uint8Array | Uint8ClampedArray;
}

export interface TraceOptions {
    /** Detail slider in [0.0, 1.0]. */
    detail?: number;
    /** SVG stroke color. */
    stroke?: string;
    /** SVG stroke width. */
    strokeWidth?: number;
    /** Solid background fill. `null` / `undefined` keeps it transparent. */
    background?: string | null;
    /** Drop contours with fewer than this many vertices. */
    minContourLength?: number;
}

const MIN_LEVELS = 1;
const MAX_LEVELS = 8;

type Point = readonly [number, number];

export function traceGrayscale(
    image: GrayscaleImage,
    options: TraceOptions = {},
): string {
    const detail = options.detail ?? 0.5;
    if (!(detail >= 0 && detail <= 1)) {
        throw new RangeError(`detail must be within [0.0, 1.0], got ${detail}`);
    }
    const stroke           = options.stroke ?? "#000000";
    const strokeWidth      = options.strokeWidth ?? 1.0;
    const background       = options.background ?? null;
    const minContourLength = Math.max(2, options.minContourLength ?? 2);

    const { width, height } = image;
    const thresholds = thresholdsForDetail(detail, image);

    const paths: string[] = [];
    for (const t of thresholds) {
        const segments = boundarySegments(image, t);
        if (segments.length === 0) continue;
        const polylines = chainSegments(segments);
        const d = polylinesToSvgD(polylines, minContourLength);
        if (d.length === 0) continue;
        paths.push(
            `<path d="${d}" fill="none" stroke="${escapeAttr(stroke)}" ` +
            `stroke-width="${strokeWidth}" stroke-linejoin="round" ` +
            `stroke-linecap="round"/>`,
        );
    }

    const body: string[] = [];
    if (background) {
        body.push(
            `<rect width="${width}" height="${height}" ` +
            `fill="${escapeAttr(background)}"/>`,
        );
    }
    body.push(...paths);

    return (
        `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<svg xmlns="http://www.w3.org/2000/svg" ` +
        `viewBox="0 0 ${width} ${height}" ` +
        `width="${width}" height="${height}">\n` +
        body.join("\n") +
        `\n</svg>\n`
    );
}

// ---------------------------------------------------------------------------
// Internals (exported for tests)
// ---------------------------------------------------------------------------

export function thresholdsForDetail(
    detail: number,
    image: GrayscaleImage,
): number[] {
    const n = clamp(
        Math.round(MIN_LEVELS + detail * (MAX_LEVELS - MIN_LEVELS)),
        MIN_LEVELS,
        MAX_LEVELS,
    );

    if (n === 1) return [median(image.data)];

    let lo = 255;
    let hi = 0;
    for (let i = 0; i < image.data.length; i++) {
        const v = image.data[i]!;
        if (v < lo) lo = v;
        if (v > hi) hi = v;
    }
    if (hi - lo < 1) return [median(image.data)];

    // Evenly spaced, excluding the extrema so masks are never trivially
    // empty/full.
    const step = (hi - lo) / (n + 1);
    const out = new Array<number>(n);
    for (let i = 0; i < n; i++) out[i] = lo + step * (i + 1);
    return out;
}

/** Oriented unit segments around True regions of `image.data < threshold`.
 *  Winding is clockwise (interior on the right of travel) in SVG's
 *  y-down coordinate system, so chaining produces closed polygons.
 */
export function boundarySegments(
    image: GrayscaleImage,
    threshold: number,
): Array<[Point, Point]> {
    const { width: w, height: h, data } = image;
    const segments: Array<[Point, Point]> = [];

    const at = (x: number, y: number): boolean => {
        if (x < 0 || y < 0 || x >= w || y >= h) return false;
        return data[y * w + x]! < threshold;
    };

    // Horizontal edges: corners at image y in [0..h], image x in [0..w-1].
    for (let y = 0; y <= h; y++) {
        for (let x = 0; x < w; x++) {
            const above = at(x, y - 1);
            const below = at(x, y);
            if (above && !below) {
                // Travel west: interior (above) on the right.
                segments.push([[x + 1, y], [x, y]]);
            } else if (!above && below) {
                segments.push([[x, y], [x + 1, y]]);
            }
        }
    }

    // Vertical edges: corners at image x in [0..w], image y in [0..h-1].
    for (let y = 0; y < h; y++) {
        for (let x = 0; x <= w; x++) {
            const left  = at(x - 1, y);
            const right = at(x, y);
            if (left && !right) {
                // Travel south: interior (left) on the right.
                segments.push([[x, y], [x, y + 1]]);
            } else if (!left && right) {
                segments.push([[x, y + 1], [x, y]]);
            }
        }
    }

    return segments;
}

/** Greedy walker: starting from any vertex with outgoing edges, follow
 *  segments until the queue empties or we return to start.
 */
export function chainSegments(
    segments: ReadonlyArray<readonly [Point, Point]>,
): Point[][] {
    const outgoing = new Map<string, Point[]>();
    const key = ([x, y]: Point) => `${x},${y}`;
    for (const [a, b] of segments) {
        const k = key(a);
        const bucket = outgoing.get(k);
        if (bucket) bucket.push(b);
        else outgoing.set(k, [b]);
    }

    const polylines: Point[][] = [];
    for (const startKey of Array.from(outgoing.keys())) {
        let bucket = outgoing.get(startKey);
        while (bucket && bucket.length > 0) {
            const startPt = parseKey(startKey);
            const polyline: Point[] = [startPt];
            let currentKey = startKey;
            while (true) {
                const out = outgoing.get(currentKey);
                if (!out || out.length === 0) break;
                const next = out.pop()!;
                polyline.push(next);
                const nk = key(next);
                if (nk === startKey) break;
                currentKey = nk;
            }
            polylines.push(polyline);
            bucket = outgoing.get(startKey);
        }
    }
    return polylines;
}

function parseKey(k: string): Point {
    const [sx, sy] = k.split(",");
    return [Number(sx), Number(sy)];
}

function polylinesToSvgD(
    polylines: ReadonlyArray<ReadonlyArray<Point>>,
    minContourLength: number,
): string {
    const parts: string[] = [];
    for (const poly of polylines) {
        if (poly.length < minContourLength) continue;
        const closed = pointEq(poly[0]!, poly[poly.length - 1]!);
        const pts = closed ? poly.slice(0, -1) : poly;
        if (pts.length === 0) continue;
        const head = pts[0]!;
        let segment = `M${head[0]} ${head[1]}`;
        for (let i = 1; i < pts.length; i++) {
            const p = pts[i]!;
            segment += ` L${p[0]} ${p[1]}`;
        }
        if (closed) segment += " Z";
        parts.push(segment);
    }
    return parts.join(" ");
}

function pointEq(a: Point, b: Point): boolean {
    return a[0] === b[0] && a[1] === b[1];
}

function clamp(v: number, lo: number, hi: number): number {
    return v < lo ? lo : v > hi ? hi : v;
}

function median(data: Uint8Array | Uint8ClampedArray): number {
    const copy = Array.from(data);
    copy.sort((x, y) => x - y);
    const n = copy.length;
    if (n === 0) return 0;
    const mid = n >>> 1;
    return n % 2 === 0 ? (copy[mid - 1]! + copy[mid]!) / 2 : copy[mid]!;
}

function escapeAttr(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}
