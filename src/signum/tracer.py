"""Core image-to-SVG tracing logic."""

from __future__ import annotations

from collections import defaultdict
from pathlib import Path
from typing import Iterable

import numpy as np
from PIL import Image

Point = tuple[int, int]
Segment = tuple[Point, Point]


MIN_LEVELS = 1
MAX_LEVELS = 8


def trace(
    image: str | Path | Image.Image,
    detail: float = 0.5,
    *,
    stroke: str = "#000000",
    stroke_width: float = 1.0,
    background: str | None = None,
    min_contour_length: int = 2,
) -> str:
    """Trace a raster image and return an SVG string.

    Parameters
    ----------
    image:
        Path to an image file, or a ``PIL.Image.Image`` instance.
    detail:
        Value in ``[0.0, 1.0]``. ``0.0`` extracts only the coarsest outline,
        ``1.0`` traces fine internal patterns. Intermediate values blend
        between the two extremes.
    stroke:
        Stroke color for the traced paths.
    stroke_width:
        Stroke width in SVG user units.
    background:
        Optional solid background fill. ``None`` keeps the SVG transparent.
    min_contour_length:
        Contours with fewer than this many vertices are discarded. Useful for
        suppressing single-pixel speckle.
    """
    gray = _load_grayscale(image)
    height, width = gray.shape
    thresholds = _thresholds_for_detail(detail, gray)

    path_elements: list[str] = []
    for threshold in thresholds:
        mask = gray < threshold
        segments = _boundary_segments(mask)
        if not segments:
            continue
        polylines = _chain_segments(segments)
        d = _polylines_to_svg_d(polylines, min_contour_length)
        if d:
            path_elements.append(
                f'<path d="{d}" fill="none" stroke="{stroke}" '
                f'stroke-width="{stroke_width}" stroke-linejoin="round" '
                f'stroke-linecap="round"/>'
            )

    return _wrap_svg(width, height, path_elements, background)


def trace_to_file(
    image: str | Path | Image.Image,
    output: str | Path,
    detail: float = 0.5,
    **kwargs,
) -> Path:
    """Trace ``image`` and write the resulting SVG to ``output``."""
    svg = trace(image, detail=detail, **kwargs)
    out_path = Path(output)
    out_path.write_text(svg, encoding="utf-8")
    return out_path


# ---------------------------------------------------------------------------
# Internals
# ---------------------------------------------------------------------------


def _load_grayscale(image: str | Path | Image.Image) -> np.ndarray:
    if isinstance(image, Image.Image):
        img = image
    else:
        img = Image.open(image)
    if img.mode != "L":
        img = img.convert("L")
    return np.asarray(img, dtype=np.uint8)


def _thresholds_for_detail(detail: float, gray: np.ndarray) -> list[float]:
    """Pick luminance thresholds based on the detail slider.

    detail = 0 -> a single threshold near the image median (coarse silhouette).
    detail = 1 -> ``MAX_LEVELS`` evenly spaced thresholds (fine patterns).
    """
    if not 0.0 <= detail <= 1.0:
        raise ValueError(f"detail must be within [0.0, 1.0], got {detail!r}")

    n = int(round(MIN_LEVELS + detail * (MAX_LEVELS - MIN_LEVELS)))
    n = max(MIN_LEVELS, min(MAX_LEVELS, n))

    if n == 1:
        # Use a data-driven midpoint so the silhouette tracks image contrast.
        return [float(np.median(gray))]

    # Evenly spaced thresholds between the image's min and max luminance,
    # skipping the extremes so the mask is never trivially empty/full.
    lo = float(gray.min())
    hi = float(gray.max())
    if hi - lo < 1.0:
        return [float(np.median(gray))]
    return list(np.linspace(lo, hi, n + 2)[1:-1])


def _boundary_segments(mask: np.ndarray) -> list[Segment]:
    """Return oriented unit boundary segments around True regions of ``mask``.

    Segments are oriented so the True region lies on the right of the
    direction of travel (clockwise winding in SVG/image coordinates where
    ``y`` grows downward). Consistent winding lets ``_chain_segments`` stitch
    them into closed polygons.
    """
    h, w = mask.shape
    # padded[y+1, x+1] == mask[y, x]; border rows/cols act as "outside".
    padded = np.pad(mask, 1, mode="constant", constant_values=False)

    segments: list[Segment] = []

    # Horizontal edges at image corner y (y in 0..h), image x in 0..w-1.
    above_h = padded[: h + 1, 1 : w + 1]  # pixel just above the edge
    below_h = padded[1 : h + 2, 1 : w + 1]  # pixel just below the edge

    # Above True, below False: interior lies north, travel west ((x+1,y)->(x,y)).
    ys, xs = np.where(above_h & ~below_h)
    for y, x in zip(ys.tolist(), xs.tolist()):
        segments.append(((x + 1, y), (x, y)))
    # Below True, above False: interior lies south, travel east ((x,y)->(x+1,y)).
    ys, xs = np.where(~above_h & below_h)
    for y, x in zip(ys.tolist(), xs.tolist()):
        segments.append(((x, y), (x + 1, y)))

    # Vertical edges at image corner x (x in 0..w), image y in 0..h-1.
    left_v = padded[1 : h + 1, : w + 1]  # pixel just left of the edge
    right_v = padded[1 : h + 1, 1 : w + 2]  # pixel just right of the edge

    # Left True, right False: interior west, travel south ((x,y)->(x,y+1)).
    ys, xs = np.where(left_v & ~right_v)
    for y, x in zip(ys.tolist(), xs.tolist()):
        segments.append(((x, y), (x, y + 1)))
    # Right True, left False: interior east, travel north ((x,y+1)->(x,y)).
    ys, xs = np.where(~left_v & right_v)
    for y, x in zip(ys.tolist(), xs.tolist()):
        segments.append(((x, y + 1), (x, y)))

    return segments


def _chain_segments(segments: Iterable[Segment]) -> list[list[Point]]:
    """Chain oriented unit segments into polylines.

    Segments are consumed greedily: starting from any segment, the walker
    follows outgoing segments from the current endpoint until it runs out or
    returns to the starting vertex.
    """
    outgoing: dict[Point, list[Point]] = defaultdict(list)
    for a, b in segments:
        outgoing[a].append(b)

    polylines: list[list[Point]] = []
    for start, _ in list(outgoing.items()):
        while outgoing[start]:
            polyline = [start]
            current = start
            while outgoing[current]:
                nxt = outgoing[current].pop()
                polyline.append(nxt)
                if nxt == start:
                    break
                current = nxt
            polylines.append(polyline)
    return polylines


def _polylines_to_svg_d(
    polylines: list[list[Point]], min_contour_length: int
) -> str:
    parts: list[str] = []
    for poly in polylines:
        if len(poly) < max(2, min_contour_length):
            continue
        closed = poly[0] == poly[-1]
        pts = poly[:-1] if closed else poly
        if not pts:
            continue
        head = pts[0]
        tail = pts[1:]
        body = " ".join(f"L{x} {y}" for x, y in tail)
        segment = f"M{head[0]} {head[1]} {body}".rstrip()
        if closed:
            segment += " Z"
        parts.append(segment)
    return " ".join(parts)


def _wrap_svg(
    width: int,
    height: int,
    path_elements: list[str],
    background: str | None,
) -> str:
    body = []
    if background:
        body.append(
            f'<rect width="{width}" height="{height}" fill="{background}"/>'
        )
    body.extend(path_elements)
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        f'<svg xmlns="http://www.w3.org/2000/svg" '
        f'viewBox="0 0 {width} {height}" width="{width}" height="{height}">\n'
        + "\n".join(body)
        + "\n</svg>\n"
    )
