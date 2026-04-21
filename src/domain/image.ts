/// Image decoding helpers for the tracer route.
///
/// The first milestone supports PNG input only — pngjs is a pure-JS
/// decoder with no native build step, which keeps `npm install` working
/// across every target (ci / docker-alpine / local). Additional formats
/// (JPEG / WebP) can be added by swapping in a format-specific decoder
/// while keeping the `decodeToGrayscale` contract stable.
///
/// The returned buffer is ITU-R BT.601 luminance (same formula PIL uses
/// for `convert("L")`), so SVG output is consistent with the original
/// Python prototype's baseline.

import { PNG } from "pngjs";

import type { GrayscaleImage } from "./tracer.js";

export class UnsupportedImageError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "UnsupportedImageError";
    }
}

/** Decode an image buffer into row-major 8-bit luminance. */
export function decodeToGrayscale(buffer: Buffer | Uint8Array): GrayscaleImage {
    const bytes = buffer instanceof Buffer ? buffer : Buffer.from(buffer);
    if (!looksLikePng(bytes)) {
        throw new UnsupportedImageError(
            "Only PNG input is supported in this milestone.",
        );
    }

    const png = PNG.sync.read(bytes);
    const { width, height, data } = png;
    const gray = new Uint8Array(width * height);

    // RGBA, 4 bytes/pixel. Alpha-composite against white so transparent
    // regions read as background rather than black.
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
        const a = data[i + 3]! / 255;
        const r = data[i]! * a + 255 * (1 - a);
        const g = data[i + 1]! * a + 255 * (1 - a);
        const b = data[i + 2]! * a + 255 * (1 - a);
        // BT.601 luma coefficients (matches PIL "L" conversion).
        gray[j] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    }

    return { width, height, data: gray };
}

function looksLikePng(bytes: Buffer): boolean {
    if (bytes.length < 8) return false;
    return (
        bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e &&
        bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a &&
        bytes[6] === 0x1a && bytes[7] === 0x0a
    );
}
