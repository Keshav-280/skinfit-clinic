#!/usr/bin/env python3
"""Render the first pages of a PDF to PNG images (stdin bytes -> JSON stdout).

Used as an OCR fallback: when text extraction fails (scanned / image-only /
unknown-layout skin reports), we rasterise the pages and let a vision model read
them. Reuses PyMuPDF (fitz), already required by the QR decoder.
"""

from __future__ import annotations

import base64
import json
import sys

try:
    import fitz
except ImportError as exc:
    print(json.dumps({"error": f"missing dependency: {exc}"}))
    sys.exit(2)

MAX_PAGES = 3
SCALE = 3.0


def render_pdf(pdf_bytes: bytes) -> list[str]:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    images: list[str] = []
    page_count = min(doc.page_count, MAX_PAGES)
    for index in range(page_count):
        page = doc[index]
        pix = page.get_pixmap(matrix=fitz.Matrix(SCALE, SCALE))
        images.append(base64.b64encode(pix.tobytes("png")).decode("ascii"))
    doc.close()
    return images


def main() -> int:
    pdf_bytes = sys.stdin.buffer.read()
    if not pdf_bytes:
        print(json.dumps({"error": "empty input"}))
        return 1
    try:
        images = render_pdf(pdf_bytes)
    except Exception as exc:  # noqa: BLE001 - surface any render failure as JSON
        print(json.dumps({"error": str(exc)}))
        return 1
    print(json.dumps({"images": images}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
