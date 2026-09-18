"""Convert a /annotator/marks export (schemaVersion marks-1) into a YOLO dataset.

Usage:
  python scripts/marks_to_yolo.py --input skinfit-marks-2026-09-18.json --images ./raw-images --out ./datasets/marks
  python scripts/marks_to_yolo.py --input export.json --classes acne_scar   # single-class scar model

Circles are stored normalized (cx, cy in 0-1; r as a fraction of image width),
so the YOLO box is (cx, cy, 2r, 2r * iw/ih) with no image reads required.
"""
import argparse
import hashlib
import json
import shutil
from collections import Counter, defaultdict
from pathlib import Path


def split_for(name: str, seed: int, val_frac: float) -> str:
    h = hashlib.sha1(f"{seed}:{name}".encode()).digest()
    return "valid" if int.from_bytes(h[:3], "big") / 0xFFFFFF < val_frac else "train"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", required=True)
    ap.add_argument("--images", help="Folder containing files named by images[].fileName")
    ap.add_argument("--out", help="Output dataset dir")
    ap.add_argument("--classes", nargs="*", help="Subset/order of classes to keep (default: all in export)")
    ap.add_argument("--val", type=float, default=0.15)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--dry", action="store_true")
    args = ap.parse_args()

    data = json.loads(Path(args.input).read_text(encoding="utf-8"))
    classes = args.classes or data["classes"]
    cls_index = {c: i for i, c in enumerate(classes)}

    by_image: dict[str, list[str]] = defaultdict(list)
    counts: Counter = Counter()
    for c in data["circles"]:
        if c["category"] not in cls_index:
            continue
        w = 2 * c["r"]
        h = w * c["iw"] / c["ih"]
        by_image[c["fileName"]].append(
            f"{cls_index[c['category']]} {c['cx']:.6f} {c['cy']:.6f} {min(w, 1):.6f} {min(h, 1):.6f}"
        )
        counts[c["category"]] += 1

    print(f"images with circles: {len(by_image)}")
    for k in classes:
        n = counts[k]
        print(f"  {k:12s} {n:5d}  {'NONE' if n == 0 else 'too few' if n < 50 else 'thin' if n < 200 else 'ok'}")
    if args.dry:
        return
    if not args.out or not args.images:
        raise SystemExit("--out and --images are required to write the dataset")

    out = Path(args.out)
    src_dir = Path(args.images)
    for s in ("train", "valid"):
        (out / s / "images").mkdir(parents=True, exist_ok=True)
        (out / s / "labels").mkdir(parents=True, exist_ok=True)

    written = missing = 0
    for name, lines in by_image.items():
        src = src_dir / name
        if not src.exists():
            missing += 1
            continue
        s = split_for(name, args.seed, args.val)
        shutil.copy2(src, out / s / "images" / name)
        (out / s / "labels" / f"{Path(name).stem}.txt").write_text("\n".join(lines) + "\n")
        written += 1

    (out / "data.yaml").write_text(
        f"train: {out.resolve()}/train/images\nval: {out.resolve()}/valid/images\n\n"
        f"nc: {len(classes)}\nnames: {classes}\n"
    )
    print(f"\nwrote {written} image/label pairs -> {out}" + (f" ({missing} images missing)" if missing else ""))


if __name__ == "__main__":
    main()
