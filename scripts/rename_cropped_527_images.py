#!/usr/bin/env python3
"""
Rename (or copy) face crops to annotator-style names:
  image_0001_alpha.png, image_0002_alpha.png, ...

Default source: ~/Desktop/images_cropped_527
Default dest:   ~/Desktop/image_cropped_527_renamed

Usage:
  python scripts/rename_cropped_527_images.py
  python scripts/rename_cropped_527_images.py --source ~/Desktop/image\\ cropped\\ 527 --dest ./out
  python scripts/rename_cropped_527_images.py --dry-run
  python scripts/rename_cropped_527_images.py --in-place --source ./my_crops
"""

from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path

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
    return sorted(files, key=lambda p: (p.name.lower(), p.stat().st_mtime))


def target_name(index: int, suffix: str, tag: str = "alpha") -> str:
    return f"image_{index:04d}_{tag}{suffix.lower()}"


def plan_renames(
    source_files: list[Path],
    *,
    start: int,
    tag: str,
    keep_extension: bool,
    output_ext: str | None,
) -> list[tuple[Path, str]]:
    planned: list[tuple[Path, str]] = []
    for offset, src in enumerate(source_files):
        index = start + offset
        if keep_extension:
            suffix = src.suffix.lower() or ".png"
        else:
            suffix = output_ext if output_ext else ".png"
            if not suffix.startswith("."):
                suffix = f".{suffix}"
        planned.append((src, target_name(index, suffix, tag=tag)))
    return planned


def write_rename_map(
    dest: Path,
    rows: list[dict[str, object]],
) -> Path:
    map_path = dest / "rename_map.json"
    map_path.write_text(json.dumps(rows, indent=2) + "\n", encoding="utf-8")
    return map_path


def apply_copy(
    planned: list[tuple[Path, str]],
    dest_dir: Path,
    *,
    dry_run: bool,
) -> list[dict[str, object]]:
    if not dry_run:
        dest_dir.mkdir(parents=True, exist_ok=True)

    rows: list[dict[str, object]] = []
    for number, (src, name) in enumerate(planned, start=1):
        out_path = dest_dir / name
        rows.append(
            {
                "number": number,
                "fileName": name,
                "originalFileName": src.name,
                "sourcePath": str(src.resolve()),
                "outputPath": str(out_path.resolve()),
            }
        )
        print(f"{src.name} -> {name}")
        if dry_run:
            continue
        shutil.copy2(src, out_path)

    return rows


def apply_in_place(
    planned: list[tuple[Path, str]],
    *,
    dry_run: bool,
) -> list[dict[str, object]]:
    source_dir = planned[0][0].parent if planned else Path(".")
    temp_suffix = ".rename_tmp_527"

    rows: list[dict[str, object]] = []
    temp_moves: list[tuple[Path, Path]] = []
    final_moves: list[tuple[Path, Path]] = []

    for number, (src, name) in enumerate(planned, start=1):
        final_path = source_dir / name
        temp_path = source_dir / f"{name}{temp_suffix}"
        rows.append(
            {
                "number": number,
                "fileName": name,
                "originalFileName": src.name,
                "outputPath": str(final_path.resolve()),
            }
        )
        print(f"{src.name} -> {name}")
        if dry_run:
            continue
        temp_moves.append((src, temp_path))
        final_moves.append((temp_path, final_path))

    if dry_run:
        return rows

    for src, temp in temp_moves:
        src.rename(temp)
    for temp, final in final_moves:
        temp.rename(final)

    return rows


def main() -> None:
    desktop = default_desktop()
    parser = argparse.ArgumentParser(
        description="Rename cropped face images to image_0001_alpha.* format."
    )
    parser.add_argument(
        "--source",
        type=Path,
        default=desktop / "images_cropped_527",
        help="Folder with cropped images (default: ~/Desktop/images_cropped_527)",
    )
    parser.add_argument(
        "--dest",
        type=Path,
        default=desktop / "image_cropped_527_renamed",
        help="Output folder when copying (default: ~/Desktop/image_cropped_527_renamed)",
    )
    parser.add_argument(
        "--in-place",
        action="store_true",
        help="Rename files inside --source instead of copying to --dest",
    )
    parser.add_argument(
        "--start",
        type=int,
        default=1,
        help="First 4-digit index (default: 1 -> image_0001_alpha)",
    )
    parser.add_argument(
        "--tag",
        default="alpha",
        help="Suffix tag after the number (default: alpha -> image_0001_alpha)",
    )
    parser.add_argument(
        "--ext",
        default=None,
        help="Force output extension, e.g. png (default: keep each source extension)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print planned renames without writing files",
    )
    args = parser.parse_args()

    if args.start < 0 or args.start > 9999:
        raise SystemExit("--start must be between 0 and 9999")

    source_files = collect_images(args.source)
    if not source_files:
        raise SystemExit(f"No supported images found in {args.source}")

    planned = plan_renames(
        source_files,
        start=args.start,
        tag=args.tag.strip() or "alpha",
        keep_extension=args.ext is None,
        output_ext=args.ext,
    )

    # Avoid overwriting when target names already exist in output folder.
    if not args.in_place and not args.dry_run:
        args.dest.mkdir(parents=True, exist_ok=True)
        collisions = [name for _, name in planned if (args.dest / name).exists()]
        if collisions:
            sample = ", ".join(collisions[:5])
            raise SystemExit(
                f"Refusing to overwrite {len(collisions)} existing file(s) in {args.dest}. "
                f"Examples: {sample}"
            )

    if args.in_place:
        rows = apply_in_place(planned, dry_run=args.dry_run)
        map_dir = args.source
    else:
        rows = apply_copy(planned, args.dest, dry_run=args.dry_run)
        map_dir = args.dest

    if not args.dry_run:
        map_path = write_rename_map(map_dir, rows)
        print(f"\nWrote rename map: {map_path}")

    action = "Would rename" if args.dry_run else "Renamed"
    where = args.source if args.in_place else args.dest
    print(f"\n{action} {len(planned)} file(s) under {where}")


if __name__ == "__main__":
    main()
