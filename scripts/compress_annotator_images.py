#!/usr/bin/env python3
"""
Compress annotator images in place (overwrite originals).

Targets files over a size limit by downscaling longest edge and re-saving PNG/JPEG.
Safe two-phase write: temp file -> replace original.

Usage:
  python scripts/compress_annotator_images.py --folder ~/Desktop/images_cropped_527_renamed
  python scripts/compress_annotator_images.py --folder ./out --max-mb 12 --only-over-limit
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image

SUPPORTED_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff"}
MAX_EDGE_STEPS = (2048, 1536, 1280, 1024, 768)


def collect_images(folder: Path) -> list[Path]:
    return sorted(
        [
            p
            for p in folder.iterdir()
            if p.is_file() and p.suffix.lower() in SUPPORTED_SUFFIXES
        ],
        key=lambda p: p.name.lower(),
    )


def flatten_to_rgb(img: Image.Image) -> Image.Image:
    if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
        background = Image.new("RGBA", img.size, (255, 255, 255, 255))
        return Image.alpha_composite(background, img.convert("RGBA")).convert("RGB")
    return img.convert("RGB")


def resize_max_edge(img: Image.Image, max_edge: int) -> Image.Image:
    w, h = img.size
    longest = max(w, h)
    if longest <= max_edge:
        return img
    scale = max_edge / longest
    new_size = (max(1, int(w * scale)), max(1, int(h * scale)))
    return img.resize(new_size, Image.Resampling.LANCZOS)


def save_under_limit(
    src: Path,
    *,
    max_bytes: int,
    jpeg_quality: int,
) -> tuple[int, int, str]:
    suffix = src.suffix.lower()
    use_jpeg = suffix in {".jpg", ".jpeg"}

    with Image.open(src) as img:
        base = img if use_jpeg else flatten_to_rgb(img)
        for max_edge in MAX_EDGE_STEPS:
            candidate = resize_max_edge(base, max_edge)
            temp = src.with_suffix(src.suffix + ".compress_tmp")
            try:
                if use_jpeg:
                    candidate.save(
                        temp,
                        format="JPEG",
                        quality=jpeg_quality,
                        optimize=True,
                    )
                else:
                    candidate.save(temp, format="PNG", optimize=True)

                size = temp.stat().st_size
                if size <= max_bytes or max_edge == MAX_EDGE_STEPS[-1]:
                    temp.replace(src)
                    return size, max_edge, "jpeg" if use_jpeg else "png"
                temp.unlink(missing_ok=True)
            except Exception:
                temp.unlink(missing_ok=True)
                raise

    raise RuntimeError(f"Could not compress {src.name} under limit")


def main() -> None:
    parser = argparse.ArgumentParser(description="Compress images in a folder (overwrite).")
    parser.add_argument(
        "--folder",
        type=Path,
        required=True,
        help="Folder with images to compress in place",
    )
    parser.add_argument(
        "--max-mb",
        type=float,
        default=12.0,
        help="Target max file size in MB (default: 12 for annotator upload limit)",
    )
    parser.add_argument(
        "--only-over-limit",
        action="store_true",
        help="Only touch files already above --max-mb",
    )
    parser.add_argument(
        "--jpeg-quality",
        type=int,
        default=88,
        help="JPEG quality when source is .jpg/.jpeg (default: 88)",
    )
    args = parser.parse_args()

    folder = args.folder.expanduser().resolve()
    if not folder.is_dir():
        raise SystemExit(f"Folder not found: {folder}")

    max_bytes = int(args.max_mb * 1024 * 1024)
    files = collect_images(folder)
    if not files:
        raise SystemExit(f"No images found in {folder}")

    touched = 0
    for path in files:
        before = path.stat().st_size
        if args.only_over_limit and before <= max_bytes:
            continue

        after, max_edge, fmt = save_under_limit(
            path,
            max_bytes=max_bytes,
            jpeg_quality=args.jpeg_quality,
        )
        touched += 1
        print(
            f"{path.name}: {before / 1024 / 1024:.2f} MB -> {after / 1024 / 1024:.2f} MB "
            f"(max_edge={max_edge}, {fmt})"
        )

    if touched == 0:
        print(f"No files needed compression in {folder}")
    else:
        total = sum(p.stat().st_size for p in files)
        print(f"\nDone. Compressed {touched} file(s). Folder total: {total / 1024 / 1024:.1f} MB")


if __name__ == "__main__":
    main()
