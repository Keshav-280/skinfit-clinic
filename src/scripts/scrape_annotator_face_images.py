#!/usr/bin/env python3
"""
Scrape face-only dermatology images for the /annotator tool.

Targets the same categories as app/annotator/page.tsx. Images are filtered with
OpenCV face detection (frontal + profile), cropped to the face, and saved under
images_face/ for import via POST /api/annotator/import-from-folder.

Sources (in order):
  1. Wikimedia Commons (preferred — clear licenses)
  2. DuckDuckGo image search (broader Indian / clinical results)

Usage:
  python3 src/scripts/scrape_annotator_face_images.py
  python3 src/scripts/scrape_annotator_face_images.py --per-category 12
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "images_face"
FILTER_SCRIPT = ROOT / "src/scripts/face_image_filter.py"
MANIFEST_PATH = OUT_DIR / "scrape_manifest.json"

USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
SCRAPER_UA = "SkinfitAnnotatorScraper/1.0 (research; +https://skinfit.local)"

# Mirrors ALL_CATEGORIES in app/annotator/page.tsx
CATEGORY_QUERIES: dict[str, list[str]] = {
    "active_acne": [
        "acne face indian dermatology",
        "acne vulgaris face portrait",
        "facial pimples indian woman",
        "inflammatory acne cheeks face",
        "cystic acne face indian man",
        "teenage acne face indian",
        "hormonal acne jawline face indian",
        "facial acne treatment india before after",
    ],
    "acne_scars": [
        "acne scars face indian",
        "facial acne scarring portrait",
        "boxcar acne scars face",
        "rolling acne scars cheeks",
        "atrophic acne scars face indian",
        "ice pick acne scars face",
        "post acne marks face indian woman",
        "acne scar treatment face before after",
    ],
    "pigmentation": [
        "melasma face indian",
        "facial hyperpigmentation indian skin",
        "dark spots face indian woman",
        "PIH face indian dermatology",
    ],
    "wrinkles": [
        "facial wrinkles indian woman",
        "crow feet wrinkles face portrait",
        "forehead wrinkles face aging",
        "fine lines face indian skin",
    ],
    "sagging_volume": [
        "jowls sagging face portrait",
        "nasolabial folds face aging",
        "midface sagging face woman",
        "facial volume loss cheeks portrait",
    ],
    "under_eye": [
        "dark circles under eye indian face",
        "periorbital dark circles face",
        "under eye bags face portrait",
        "eye puffiness face indian",
    ],
}

CATEGORY_LABELS = {
    "active_acne": "Active Acne",
    "acne_scars": "Acne Scars",
    "pigmentation": "Pigmentation",
    "wrinkles": "Wrinkles",
    "sagging_volume": "Sagging & Volume",
    "under_eye": "Under-Eye",
}

ALLOWED_MIME = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
SKIP_HOST_FRAGMENTS = (
    "shutterstock",
    "gettyimages",
    "istockphoto",
    "alamy",
    "dreamstime",
    "depositphotos",
    "123rf",
    "adobe.com/stock",
    "stock.adobe",
    "ftcdn.net",
    "pngtree",
    "freepik",
)

FILE_NAME_RE = re.compile(
    r"^(active_acne|acne_scars|pigmentation|wrinkles|sagging_volume|under_eye)_(\d+)_([a-f0-9]{10})\.(jpg|jpeg|png|webp)$",
    re.IGNORECASE,
)


def http_get(
    url: str,
    headers: dict[str, str] | None = None,
    timeout: int = 30,
    *,
    browser: bool = False,
) -> bytes:
    ua = USER_AGENT if browser else SCRAPER_UA
    req = urllib.request.Request(
        url,
        headers={"User-Agent": ua, **(headers or {})},
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def wikimedia_search(query: str, limit: int = 20) -> list[dict]:
    params = urllib.parse.urlencode(
        {
            "action": "query",
            "format": "json",
            "generator": "search",
            "gsrnamespace": "6",
            "gsrsearch": f"filetype:bitmap {query}",
            "gsrlimit": str(limit),
            "prop": "imageinfo",
            "iiprop": "url|mime|size|extmetadata",
            "iiurlwidth": "1200",
        }
    )
    url = f"https://commons.wikimedia.org/w/api.php?{params}"
    raw = http_get(url)
    data = json.loads(raw)
    pages = data.get("query", {}).get("pages", {})
    results: list[dict] = []
    for page in pages.values():
        info = (page.get("imageinfo") or [{}])[0]
        img_url = info.get("url") or info.get("thumburl")
        mime = (info.get("mime") or "").lower()
        if not img_url or mime not in ALLOWED_MIME:
            continue
        title = page.get("title", "")
        if any(x in title.lower() for x in ("diagram", "illustration", "drawing", "histology", "zones", "chart")):
            continue
        results.append(
            {
                "url": img_url,
                "title": title,
                "source": "wikimedia",
                "license": ((info.get("extmetadata") or {}).get("LicenseShortName") or {}).get("value"),
            }
        )
    return results


def ddg_vqd(query: str) -> str | None:
    url = f"https://duckduckgo.com/?q={urllib.parse.quote(query)}&iax=images&ia=images"
    html = http_get(url, headers={"Accept": "text/html"}, browser=True).decode("utf-8", "replace")
    m = re.search(r"vqd=([\d-]+)", html)
    return m.group(1) if m else None


def ddg_image_search(query: str, limit: int = 25, pages: int = 1) -> list[dict]:
    vqd = ddg_vqd(query)
    if not vqd:
        return []
    results: list[dict] = []
    seen: set[str] = set()
    for page in range(1, pages + 1):
        params = urllib.parse.urlencode(
            {
                "l": "us-en",
                "o": "json",
                "q": query,
                "vqd": vqd,
                "f": ",,,,,",
                "p": str(page),
            }
        )
        url = f"https://duckduckgo.com/i.js?{params}"
        try:
            raw = http_get(
                url,
                headers={"Referer": "https://duckduckgo.com/", "Accept": "application/json"},
                browser=True,
            )
        except urllib.error.HTTPError:
            break
        data = json.loads(raw)
        batch = data.get("results", [])
        if not batch:
            break
        for item in batch[:limit]:
            img_url = item.get("image") or item.get("thumbnail")
            if not img_url or img_url in seen:
                continue
            host = (item.get("url") or img_url).lower()
            if any(s in host for s in SKIP_HOST_FRAGMENTS):
                continue
            title = item.get("title") or ""
            if any(x in title.lower() for x in ("stock photo", "vector", "illustration", "icon")):
                continue
            seen.add(img_url)
            results.append(
                {
                    "url": img_url,
                    "title": title,
                    "source": "duckduckgo",
                    "page_url": item.get("url"),
                }
            )
        time.sleep(0.35)
    return results


def download_image(url: str, dest: Path) -> bool:
    try:
        data = http_get(
            url,
            headers={"Referer": "https://duckduckgo.com/"},
            timeout=45,
            browser=True,
        )
    except Exception:
        return False
    if len(data) < 8_000:
        return False
    # Basic magic-byte check
    if data[:3] == b"\xff\xd8\xff":
        ext = ".jpg"
    elif data[:8] == b"\x89PNG\r\n\x1a\n":
        ext = ".png"
    elif data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        ext = ".webp"
    else:
        return False
    tmp = dest.with_suffix(ext)
    tmp.write_bytes(data)
    return True


def run_face_filter(cmd: str, src: Path, dst: Path | None = None) -> dict:
    args = [sys.executable, str(FILTER_SCRIPT), cmd, str(src)]
    if dst is not None:
        args.append(str(dst))
    proc = subprocess.run(args, capture_output=True, text=True, check=False)
    if proc.returncode != 0:
        return {"ok": False, "reason": proc.stderr.strip() or "filter_failed"}
    try:
        return json.loads(proc.stdout.strip() or "{}")
    except json.JSONDecodeError:
        return {"ok": False, "reason": "bad_filter_output"}


def slug(text: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")
    return s[:48] or "image"


def load_existing_state() -> tuple[list[dict], dict[str, int], dict[str, int], set[str], set[str]]:
    manifest: list[dict] = []
    if MANIFEST_PATH.exists():
        try:
            manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            manifest = []

    cat_counts: dict[str, int] = {k: 0 for k in CATEGORY_QUERIES}
    cat_next_idx: dict[str, int] = {k: 0 for k in CATEGORY_QUERIES}
    seen_urls: set[str] = {e["sourceUrl"] for e in manifest if e.get("sourceUrl")}
    seen_hashes: set[str] = set()

    for path in OUT_DIR.iterdir():
        if path.suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp"}:
            continue
        m = FILE_NAME_RE.match(path.name)
        if not m:
            continue
        cat, idx_str, url_hash, _ext = m.groups()
        cat_counts[cat] = cat_counts.get(cat, 0) + 1
        cat_next_idx[cat] = max(cat_next_idx.get(cat, 0), int(idx_str))
        seen_hashes.add(url_hash)

    for entry in manifest:
        fn = entry.get("fileName", "")
        m = FILE_NAME_RE.match(fn)
        if m:
            seen_hashes.add(m.group(3))

    return manifest, cat_counts, cat_next_idx, seen_urls, seen_hashes


def collect_candidates(per_query: int, ddg_pages: int) -> dict[str, list[dict]]:
    seen_urls: set[str] = set()
    by_category: dict[str, list[dict]] = {k: [] for k in CATEGORY_QUERIES}

    for cat, queries in CATEGORY_QUERIES.items():
        for query in queries:
            batch: list[dict] = []
            batch.extend(wikimedia_search(query, limit=per_query))
            time.sleep(0.35)
            batch.extend(ddg_image_search(query, limit=per_query, pages=ddg_pages))
            time.sleep(0.45)
            for item in batch:
                url = item["url"]
                if url in seen_urls:
                    continue
                seen_urls.add(url)
                item["query"] = query
                item["category"] = cat
                by_category[cat].append(item)
    return by_category


def scrape(per_category: int, dry_run: bool) -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest, cat_counts, cat_next_idx, seen_urls, seen_hashes = load_existing_state()
    new_entries: list[dict] = []
    saved = 0

    print(f"Target {per_category} per category (~{per_category * len(CATEGORY_QUERIES)} total).")
    print("Existing counts:", ", ".join(f"{k}={cat_counts[k]}" for k in CATEGORY_QUERIES))

    need_any = any(cat_counts[c] < per_category for c in CATEGORY_QUERIES)
    if not need_any and not dry_run:
        print("All categories already at target.")
        return 0

    per_query = max(20, min(100, per_category))
    ddg_pages = max(3, min(8, per_category // 8 + 2))
    print(f"Collecting candidates (per_query={per_query}, ddg_pages={ddg_pages})...")
    candidates = collect_candidates(per_query=per_query, ddg_pages=ddg_pages)

    for cat, items in candidates.items():
        label = CATEGORY_LABELS[cat]
        already = cat_counts.get(cat, 0)
        need = max(0, per_category - already)
        if need == 0:
            print(f"\n[{label}] already have {already}/{per_category}, skipping")
            continue

        next_idx = cat_next_idx.get(cat, 0)
        cat_saved = 0
        print(f"\n[{label}] need {need} more ({already} existing, {len(items)} candidates)")
        for item in items:
            if cat_saved >= need:
                break
            url = item["url"]
            url_hash = hashlib.sha1(url.encode()).hexdigest()[:10]
            if url in seen_urls or url_hash in seen_hashes:
                continue
            next_idx += 1
            base = f"{cat}_{next_idx:02d}_{url_hash}"
            raw_path = OUT_DIR / f"{base}_raw"
            final_name = f"{base}.jpg"
            if dry_run:
                print(f"  would try: {item['title'][:70]}")
                cat_saved += 1
                continue

            if not download_image(url, raw_path):
                continue
            raw_files = list(OUT_DIR.glob(f"{base}_raw.*"))
            if not raw_files:
                continue
            raw_file = raw_files[0]
            out_path = OUT_DIR / final_name

            analysis = run_face_filter("analyze", raw_file)
            if not analysis.get("ok"):
                raw_file.unlink(missing_ok=True)
                continue

            crop_result = run_face_filter("crop", raw_file, out_path)
            raw_file.unlink(missing_ok=True)
            if not crop_result.get("ok"):
                out_path.unlink(missing_ok=True)
                continue

            entry = {
                "fileName": final_name,
                "category": cat,
                "categoryLabel": label,
                "source": item.get("source"),
                "sourceUrl": url,
                "pageUrl": item.get("page_url"),
                "title": item.get("title"),
                "license": item.get("license"),
                "query": item.get("query"),
                "faceRatio": analysis.get("face_ratio"),
                "croppedRatio": crop_result.get("cropped_ratio"),
            }
            new_entries.append(entry)
            seen_urls.add(url)
            seen_hashes.add(url_hash)
            cat_counts[cat] = cat_counts.get(cat, 0) + 1
            saved += 1
            cat_saved += 1
            print(f"  saved {final_name} ({cat_counts[cat]}/{per_category}) — {item.get('title', '')[:55]}")

    if new_entries and not dry_run:
        manifest.extend(new_entries)
        MANIFEST_PATH.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    print(f"\nDone. Saved {saved} new face images this run.")
    print("Final counts:", ", ".join(f"{k}={cat_counts[k]}" for k in CATEGORY_QUERIES))
    print(f"Total on disk target folder: {sum(cat_counts.values())} categorized images")
    print(f"Manifest: {MANIFEST_PATH} ({len(manifest)} entries)")
    print("Import into annotator: POST /api/annotator/import-from-folder (or use the UI).")
    return saved


def main() -> None:
    parser = argparse.ArgumentParser(description="Scrape face-only annotator images")
    parser.add_argument("--per-category", type=int, default=8, help="Max images per category")
    parser.add_argument("--dry-run", action="store_true", help="List candidates only")
    args = parser.parse_args()
    scrape(per_category=max(1, args.per_category), dry_run=args.dry_run)


if __name__ == "__main__":
    main()
