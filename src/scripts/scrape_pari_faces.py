#!/usr/bin/env python3
"""
Scrape face portraits from PARI (People's Archive of Rural India).

Source: https://ruralindiaonline.org/pa/categories/faces/
District index pages: /pa/categories/faces/{a-z}/

Downloads the highest-resolution images embedded on each letter page
(.height-1080.jpg renditions) into images_pari_faces/{letter}/.

Usage:
  python3 src/scripts/scrape_pari_faces.py
  python3 src/scripts/scrape_pari_faces.py --letters c,d --dry-run
  python3 src/scripts/scrape_pari_faces.py --delay 0.5
"""

from __future__ import annotations

import argparse
import json
import re
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "images_pari_faces"
MANIFEST_PATH = OUT_DIR / "manifest.json"

BASE_URL = "https://ruralindiaonline.org"
LETTERS = "abcdefghijklmnopqrstuvwxyz"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)

IMAGE_RE = re.compile(
    r'(?:src|data-src|data-original-image-src)=["\'](/media/images/[^"\']+\.height-1080\.jpg)["\']'
    r'|(/media/images/[^"\'\s>]+\.height-1080\.jpg)'
)
FACE_LINK_RE = re.compile(
    r'href="(/pa/categories/faces/[^"]+/)"[^>]*>\s*'
    r'<div class="face-name[^"]*">([^<]+)</div>\s*'
    r'<div class="face-district[^"]*">([^<]+)</div>',
    re.DOTALL,
)


def http_get(url: str, timeout: int = 45) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def fetch_letter_page(letter: str) -> str:
    url = f"{BASE_URL}/pa/categories/faces/{letter}/"
    return http_get(url).decode("utf-8", "replace")


def extract_images(html: str) -> list[str]:
    seen: set[str] = set()
    urls: list[str] = []
    for m in IMAGE_RE.finditer(html):
        path = m.group(1) or m.group(2)
        if path and path not in seen:
            seen.add(path)
            urls.append(path)
    return urls


def extract_face_metadata(html: str) -> dict[str, dict[str, str]]:
    """Map image basename stem -> {name, district, pageUrl}."""
    meta: dict[str, dict[str, str]] = {}
    for block in re.findall(
        r'<div class="[^"]*face-item[^"]*"[^>]*>.*?</div>\s*</div>\s*</div>',
        html,
        flags=re.DOTALL,
    ):
        link_m = re.search(r'href="(/pa/categories/faces/[^"]+/)"', block)
        name_m = re.search(r'class="face-name[^"]*">([^<]+)<', block)
        district_m = re.search(r'class="face-district[^"]*">([^<]+)<', block)
        img_m = re.search(r'/media/images/([^"\'\s>]+\.height-1080\.jpg)', block)
        if not img_m:
            continue
        stem = Path(img_m.group(1)).stem.replace(".height-1080", "")
        meta[stem] = {
            "name": name_m.group(1).strip() if name_m else "",
            "district": district_m.group(1).strip() if district_m else "",
            "pageUrl": f"{BASE_URL}{link_m.group(1)}" if link_m else "",
        }
    return meta


def safe_filename(path: str) -> str:
    name = Path(path).name
    return re.sub(r"[^\w.\-]", "_", name)


def load_manifest() -> list[dict]:
    if MANIFEST_PATH.exists():
        try:
            return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return []
    return []


def scrape(
    letters: str,
    delay: float,
    dry_run: bool,
    limit_per_letter: int | None,
) -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest = load_manifest()
    seen_files = {e["fileName"] for e in manifest if e.get("fileName")}
    saved = 0

    for letter in letters:
        letter = letter.lower()
        letter_dir = OUT_DIR / letter
        letter_dir.mkdir(parents=True, exist_ok=True)

        print(f"\n[{letter.upper()}] fetching index page...")
        try:
            html = fetch_letter_page(letter)
        except urllib.error.HTTPError as exc:
            print(f"  skip — HTTP {exc.code}")
            continue
        except Exception as exc:
            print(f"  skip — {exc}")
            continue

        image_paths = extract_images(html)
        face_meta = extract_face_metadata(html)
        if limit_per_letter is not None:
            image_paths = image_paths[:limit_per_letter]

        print(f"  found {len(image_paths)} images")
        if not image_paths:
            continue

        for img_path in image_paths:
            file_name = safe_filename(img_path)
            dest = letter_dir / file_name
            stem = Path(file_name).stem.replace(".height-1080", "")
            info = face_meta.get(stem, {})

            if dest.exists() or file_name in seen_files:
                continue

            img_url = f"{BASE_URL}{img_path}"
            if dry_run:
                print(f"  would download: {file_name} ({info.get('name', '?')})")
                saved += 1
                continue

            try:
                data = http_get(img_url)
            except Exception as exc:
                print(f"  failed {file_name}: {exc}")
                time.sleep(delay)
                continue

            if len(data) < 4_000:
                print(f"  skipped tiny file: {file_name}")
                time.sleep(delay)
                continue

            dest.write_bytes(data)
            entry = {
                "fileName": file_name,
                "letter": letter,
                "name": info.get("name", ""),
                "district": info.get("district", ""),
                "sourceUrl": img_url,
                "pageUrl": info.get("pageUrl", ""),
                "source": "pari_faces",
                "license": "CC BY-NC-ND 4.0",
            }
            manifest.append(entry)
            seen_files.add(file_name)
            saved += 1
            if saved % 25 == 0:
                MANIFEST_PATH.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
            print(f"  saved {letter}/{file_name} — {info.get('name', '')[:40]}")

            time.sleep(delay)

    if not dry_run:
        MANIFEST_PATH.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    print(f"\nDone. {'Would save' if dry_run else 'Saved'} {saved} images this run.")
    print(f"Output: {OUT_DIR}")
    print(f"Manifest: {MANIFEST_PATH} ({len(manifest)} total entries)")
    return saved


def main() -> None:
    parser = argparse.ArgumentParser(description="Scrape PARI FACES portraits (A–Z)")
    parser.add_argument(
        "--letters",
        default=LETTERS,
        help="Letters to scrape, e.g. 'a,b,c' or 'abcdef' (default: a-z)",
    )
    parser.add_argument("--delay", type=float, default=0.35, help="Seconds between downloads")
    parser.add_argument("--dry-run", action="store_true", help="List images without downloading")
    parser.add_argument("--limit-per-letter", type=int, default=None, help="Max images per letter")
    args = parser.parse_args()

    letters = "".join(c for c in args.letters.lower() if c.isalpha())
    if not letters:
        letters = LETTERS

    scrape(
        letters=letters,
        delay=max(0.1, args.delay),
        dry_run=args.dry_run,
        limit_per_letter=args.limit_per_letter,
    )


if __name__ == "__main__":
    main()
