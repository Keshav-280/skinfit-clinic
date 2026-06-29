#!/usr/bin/env python3
"""Export annotated skin images with markings and a color legend (no on-image labels)."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

CATEGORY_ORDER = [
    "Active Acne",
    "Acne Scars",
    "Pigmentation",
    "Wrinkles",
    "Sagging & Volume",
    "Under-Eye",
]

DEFAULT_CATEGORY_COLORS = {
    "Active Acne": (239, 68, 68),
    "Acne Scars": (185, 28, 28),
    "Pigmentation": (59, 130, 246),
    "Wrinkles": (168, 85, 247),
    "Sagging & Volume": (236, 72, 153),
    "Under-Eye": (14, 165, 233),
}

RGB_RE = re.compile(r"rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)")


def parse_rgb(color: str, fallback: tuple[int, int, int]) -> tuple[int, int, int]:
    match = RGB_RE.match(color.strip())
    if not match:
        return fallback
    return tuple(int(g) for g in match.groups())  # type: ignore[return-value]


def norm_points_to_pixels(
    points: list[dict[str, float]], width: int, height: int
) -> list[tuple[float, float]]:
    return [(p["x"] * width, p["y"] * height) for p in points]


def polygon_area(points: list[tuple[float, float]]) -> float:
    if len(points) < 3:
        return 0.0
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    return (max(xs) - min(xs)) * (max(ys) - min(ys))


def draw_annotations(
    base: Image.Image,
    annotations: list[dict],
    stroke_scale: float = 0.005,
) -> Image.Image:
    img = base.convert("RGBA")
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    fill_draw = ImageDraw.Draw(overlay, "RGBA")
    stroke_draw = ImageDraw.Draw(overlay, "RGBA")

    w, h = img.size
    stroke_width = max(2, int(min(w, h) * stroke_scale))

    prepared: list[tuple[dict, list[tuple[float, float]], tuple[int, int, int]]] = []
    for ann in annotations:
        points = ann.get("points") or []
        if len(points) < 2:
            continue

        category = ann.get("category", "")
        fallback = DEFAULT_CATEGORY_COLORS.get(category, (156, 163, 175))
        rgb = parse_rgb(ann.get("color", ""), fallback)
        pixel_points = norm_points_to_pixels(points, w, h)
        prepared.append((ann, pixel_points, rgb))

    # Large regions first so small marks (e.g. forehead acne scar) stay visible on top.
    prepared.sort(key=lambda item: polygon_area(item[1]), reverse=True)

    for ann, pixel_points, rgb in prepared:
        fill = (*rgb, int(255 * 0.3))
        if ann.get("type") == "line":
            continue
        if len(pixel_points) >= 3:
            fill_draw.polygon(pixel_points, fill=fill)
        else:
            fill_draw.line(pixel_points, fill=fill, width=stroke_width, joint="curve")

    for ann, pixel_points, rgb in prepared:
        stroke = (*rgb, 255)
        if ann.get("type") == "line" or len(pixel_points) < 3:
            stroke_draw.line(pixel_points, fill=stroke, width=stroke_width, joint="curve")
        else:
            stroke_draw.polygon(pixel_points, outline=stroke, width=stroke_width)

    return Image.alpha_composite(img, overlay).convert("RGB")


def draw_legend(
    categories: list[str],
    category_colors: dict[str, tuple[int, int, int]],
    height: int,
    width: int = 260,
) -> Image.Image:
    legend = Image.new("RGB", (width, height), (248, 250, 252))
    draw = ImageDraw.Draw(legend)

    try:
        title_font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 18)
        label_font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 15)
    except OSError:
        title_font = ImageFont.load_default()
        label_font = ImageFont.load_default()

    swatch_w, swatch_h = 28, 16
    gap = 30
    title_h = 24
    block_h = title_h + 12 + len(categories) * gap
    start_y = max(16, (height - block_h) // 2)

    draw.text((16, start_y), "Legend", fill=(15, 23, 42), font=title_font)

    y = start_y + title_h + 12
    for category in categories:
        rgb = category_colors.get(category, (156, 163, 175))
        draw.rounded_rectangle(
            (16, y, 16 + swatch_w, y + swatch_h),
            radius=4,
            fill=rgb,
            outline=(100, 116, 139),
            width=1,
        )
        draw.text((52, y - 2), category, fill=(30, 41, 59), font=label_font)
        y += gap

    return legend


def draw_panel_label(img: Image.Image, label: str) -> Image.Image:
    """Return image with a small caption bar above it."""
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 16)
    except OSError:
        font = ImageFont.load_default()

    bar_h = 32
    out = Image.new("RGB", (img.width, img.height + bar_h), (248, 250, 252))
    draw = ImageDraw.Draw(out)
    draw.text((12, 8), label, fill=(51, 65, 85), font=font)
    out.paste(img, (0, bar_h))
    return out


def combine_original_and_marked(
    original: Image.Image,
    marked: Image.Image,
    legend: Image.Image,
    gap: int = 8,
) -> Image.Image:
    """Side-by-side original + annotated, with legend on the right."""
    original_panel = draw_panel_label(original.convert("RGB"), "Original")
    marked_panel = draw_panel_label(marked, "Annotated")

    content_h = max(original_panel.height, marked_panel.height)
    content_w = original_panel.width + gap + marked_panel.width
    total_w = content_w + gap + legend.width
    total_h = max(content_h, legend.height)

    canvas = Image.new("RGB", (total_w, total_h), (248, 250, 252))
    canvas.paste(original_panel, (0, 0))
    canvas.paste(marked_panel, (original_panel.width + gap, 0))
    legend_y = max(0, (total_h - legend.height) // 2)
    canvas.paste(legend, (content_w + gap, legend_y))
    return canvas


def export_images(
    json_path: Path,
    images_dir: Path,
    output_dir: Path,
    max_index: int = 9,
) -> list[Path]:
    with json_path.open(encoding="utf-8") as f:
        payload = json.load(f)

    images_meta = payload["images"]
    annotations = payload.get("annotations", [])
    by_image: dict[int, list[dict]] = {}
    for ann in annotations:
        idx = ann.get("imageIndex")
        if isinstance(idx, int) and 0 <= idx <= max_index:
            by_image.setdefault(idx, []).append(ann)

    output_dir.mkdir(parents=True, exist_ok=True)
    exported: list[Path] = []

    for idx in range(max_index + 1):
        file_name = images_meta[idx]["fileName"]
        src = images_dir / file_name
        if not src.exists():
            print(f"SKIP missing image: {src}")
            continue

        image_anns = by_image.get(idx, [])
        if not image_anns:
            print(f"SKIP no annotations: {file_name}")
            continue

        base = Image.open(src)
        marked = draw_annotations(base, image_anns)

        categories_present: list[str] = []
        category_colors: dict[str, tuple[int, int, int]] = {}
        for ann in image_anns:
            cat = ann.get("category", "")
            if cat and cat not in categories_present:
                categories_present.append(cat)
            if cat:
                category_colors[cat] = parse_rgb(
                    ann.get("color", ""),
                    DEFAULT_CATEGORY_COLORS.get(cat, (156, 163, 175)),
                )

        categories_present.sort(
            key=lambda c: CATEGORY_ORDER.index(c) if c in CATEGORY_ORDER else 999
        )

        legend = draw_legend(
            categories_present, category_colors, marked.height + 32
        )
        combined = combine_original_and_marked(base.convert("RGB"), marked, legend)

        out_name = file_name.replace("_alpha.png", "_comparison.png")
        out_path = output_dir / out_name
        combined.save(out_path, format="PNG", optimize=True)
        exported.append(out_path)
        print(f"Exported {out_path.name} ({len(image_anns)} shapes)")

    return exported


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--json",
        type=Path,
        default=Path("/Users/sagnikdey/Downloads/skinnfit-annotations-2026-06-22T11-53-21.json"),
    )
    parser.add_argument(
        "--images-dir",
        type=Path,
        default=Path("/Users/sagnikdey/Desktop/images_cropped_527_renamed"),
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("/Users/sagnikdey/Desktop/annotated_export_2026-06-22"),
    )
    parser.add_argument("--max-index", type=int, default=9, help="Last image index (inclusive)")
    args = parser.parse_args()

    exported = export_images(args.json, args.images_dir, args.output_dir, args.max_index)
    print(f"\nDone. {len(exported)} images saved to {args.output_dir}")


if __name__ == "__main__":
    main()
