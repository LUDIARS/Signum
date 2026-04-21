"""Command-line entry point for Signum."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from .tracer import trace


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="signum",
        description=(
            "Trace the outlines of a raster image and emit SVG data. "
            "Use --detail to slide between a bare silhouette (0.0) and "
            "fine internal patterns (1.0)."
        ),
    )
    parser.add_argument("image", type=Path, help="Path to the input image.")
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        default=None,
        help="Output SVG path. If omitted, SVG is written to stdout.",
    )
    parser.add_argument(
        "-d",
        "--detail",
        type=float,
        default=0.5,
        help="Detail level in [0.0, 1.0]. Default: 0.5.",
    )
    parser.add_argument(
        "--stroke",
        default="#000000",
        help="Stroke color for traced paths. Default: #000000.",
    )
    parser.add_argument(
        "--stroke-width",
        type=float,
        default=1.0,
        help="Stroke width in SVG user units. Default: 1.0.",
    )
    parser.add_argument(
        "--background",
        default=None,
        help="Optional background fill color (e.g. white).",
    )
    parser.add_argument(
        "--min-contour-length",
        type=int,
        default=2,
        help="Discard contours shorter than this many vertices. Default: 2.",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)

    svg = trace(
        args.image,
        detail=args.detail,
        stroke=args.stroke,
        stroke_width=args.stroke_width,
        background=args.background,
        min_contour_length=args.min_contour_length,
    )

    if args.output is None:
        sys.stdout.write(svg)
    else:
        args.output.write_text(svg, encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
