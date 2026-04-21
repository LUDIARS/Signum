"""Tests for the Signum tracer."""

from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from pathlib import Path

import numpy as np
import pytest
from PIL import Image, ImageDraw

from signum import trace, trace_to_file
from signum.tracer import (
    _boundary_segments,
    _chain_segments,
    _thresholds_for_detail,
)


SVG_NS = "{http://www.w3.org/2000/svg}"


def _solid_disc(size: int = 32, radius: int = 10) -> Image.Image:
    img = Image.new("L", (size, size), color=255)
    draw = ImageDraw.Draw(img)
    center = size // 2
    draw.ellipse(
        (center - radius, center - radius, center + radius, center + radius),
        fill=0,
    )
    return img


def _patterned_image(size: int = 32) -> Image.Image:
    # A dark disc with a lighter-grey ring inside, so low and high detail
    # levels produce clearly different SVGs.
    img = Image.new("L", (size, size), color=255)
    draw = ImageDraw.Draw(img)
    c = size // 2
    draw.ellipse((c - 12, c - 12, c + 12, c + 12), fill=40)
    draw.ellipse((c - 8, c - 8, c + 8, c + 8), fill=140)
    draw.ellipse((c - 4, c - 4, c + 4, c + 4), fill=40)
    return img


def _parse(svg: str) -> ET.Element:
    return ET.fromstring(svg)


def test_trace_returns_wellformed_svg_for_disc():
    svg = trace(_solid_disc(), detail=0.0)
    root = _parse(svg)
    assert root.tag == f"{SVG_NS}svg"
    paths = root.findall(f"{SVG_NS}path")
    assert len(paths) == 1, "detail=0 should produce a single path element"
    d = paths[0].get("d")
    assert d and d.startswith("M")
    assert d.rstrip().endswith("Z"), "disc boundary should be a closed path"


def test_detail_increases_path_count():
    img = _patterned_image()
    low = _parse(trace(img, detail=0.0))
    high = _parse(trace(img, detail=1.0))

    low_d = " ".join(p.get("d", "") for p in low.findall(f"{SVG_NS}path"))
    high_d = " ".join(p.get("d", "") for p in high.findall(f"{SVG_NS}path"))

    low_moves = len(re.findall(r"M", low_d))
    high_moves = len(re.findall(r"M", high_d))
    assert high_moves > low_moves, (
        f"higher detail should yield more contours (low={low_moves}, "
        f"high={high_moves})"
    )


def test_trace_rejects_out_of_range_detail():
    with pytest.raises(ValueError):
        trace(_solid_disc(), detail=1.5)
    with pytest.raises(ValueError):
        trace(_solid_disc(), detail=-0.1)


def test_trace_preserves_image_dimensions():
    img = _solid_disc(size=24)
    svg = trace(img, detail=0.3)
    root = _parse(svg)
    assert root.get("viewBox") == "0 0 24 24"
    assert root.get("width") == "24"
    assert root.get("height") == "24"


def test_trace_with_background_adds_rect():
    svg = trace(_solid_disc(), detail=0.5, background="white")
    root = _parse(svg)
    rect = root.find(f"{SVG_NS}rect")
    assert rect is not None
    assert rect.get("fill") == "white"


def test_trace_to_file_roundtrip(tmp_path: Path):
    out = tmp_path / "disc.svg"
    result = trace_to_file(_solid_disc(), out, detail=0.0)
    assert result == out
    content = out.read_text(encoding="utf-8")
    assert "<svg" in content
    assert "</svg>" in content


def test_boundary_segments_closed_square():
    mask = np.zeros((5, 5), dtype=bool)
    mask[1:4, 1:4] = True
    segments = _boundary_segments(mask)
    # A 3x3 filled square has a 12-unit perimeter.
    assert len(segments) == 12
    polylines = _chain_segments(segments)
    assert len(polylines) == 1
    poly = polylines[0]
    assert poly[0] == poly[-1], "boundary should close back on itself"


def test_thresholds_increase_with_detail():
    gray = np.tile(np.arange(256, dtype=np.uint8), (16, 1))
    low = _thresholds_for_detail(0.0, gray)
    high = _thresholds_for_detail(1.0, gray)
    assert len(low) == 1
    assert len(high) >= len(low)
    assert len(high) > 1
