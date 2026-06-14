#!/usr/bin/env python3
"""
Copy images from Desktop/images_scrape, convert to PNG, and save as:
  image_A_0001.png, image_A_0002.png, ...

Output folder is created on Desktop if it does not exist.

Usage:
  python scripts/prepare_annotator_images.py
  python scripts/prepare_annotator_images.py --source ~/Desktop/images_scrape --dest ~/Desktop/annotator_images_png
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image

# Common raster formats Pillow can open
SUPPORTED_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff", ".gif"}


def default_desktop() -> Path:
    return Path.home() / "Desktop"


def collect_images(source_dir: Path) -> list[Path]:
    if not source_dir.is_dir():
        raise FileNotFoundError(f"Source folder not found: {source_dir}")

    files = [
        p
        for p in source_dir.iterdir()
        if p.is_file() and p.suffix.lower() in SUPPORTED_SUFFIXES
    ]
    return sorted(files, key=lambda p: p.name.lower())


def convert_and_copy(source_files: list[Path], dest_dir: Path, prefix: str = "image_A") -> list[Path]:
    dest_dir.mkdir(parents=True, exist_ok=True)
    written: list[Path] = []

    for index, src in enumerate(source_files, start=1):
        out_name = f"{prefix}_{index:04d}.png"
        out_path = dest_dir / out_name

        with Image.open(src) as img:
            # Flatten transparency onto white for formats that need it
            if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
                background = Image.new("RGBA", img.size, (255, 255, 255, 255))
                converted = Image.alpha_composite(background, img.convert("RGBA")).convert("RGB")
            else:
                converted = img.convert("RGB")

            converted.save(out_path, format="PNG", optimize=True)

        written.append(out_path)
        print(f"{src.name} -> {out_path.name}")

    return written


def main() -> None:
    desktop = default_desktop()

    parser = argparse.ArgumentParser(
        description="Convert Desktop scrape images to numbered PNG files."
    )
    parser.add_argument(
        "--source",
        type=Path,
        default=desktop / "images scrape",
        help="Folder with source images (default: ~/Desktop/images scrape)",
    )
    parser.add_argument(
        "--dest",
        type=Path,
        default=desktop / "annotator_images_png",
        help="Output folder on Desktop (default: ~/Desktop/annotator_images_png)",
    )
    parser.add_argument(
        "--prefix",
        default="image_A",
        help="Filename prefix before the 4-digit number (default: image_A)",
    )
    args = parser.parse_args()

    source_files = collect_images(args.source)
    if not source_files:
        raise SystemExit(f"No supported images found in {args.source}")

    written = convert_and_copy(source_files, args.dest, prefix=args.prefix)
    print(f"\nDone. Wrote {len(written)} PNG file(s) to {args.dest}")


if __name__ == "__main__":
    main()
