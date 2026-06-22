#!/usr/bin/env python3
"""Decode QR code URL from page 1 of an sdetect skin report PDF (stdin bytes -> JSON stdout)."""

from __future__ import annotations

import json
import sys

try:
    import cv2
    import fitz
    import numpy as np
except ImportError as exc:
    print(json.dumps({"error": f"missing dependency: {exc}"}))
    sys.exit(2)


def decode_qr_from_pdf(pdf_bytes: bytes) -> str | None:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    if doc.page_count < 1:
        return None
    page = doc[0]
    for scale in (8, 6, 4):
        pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale))
        channels = pix.n
        img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, channels)
        if channels == 4:
            img = cv2.cvtColor(img, cv2.COLOR_RGBA2BGR)
        elif channels == 1:
            img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
        detector = cv2.QRCodeDetector()
        data, _, _ = detector.detectAndDecode(img)
        if data:
            return data
        h, w = img.shape[:2]
        crop = img[int(h * 0.10) : int(h * 0.38), int(w * 0.76) :]
        data, _, _ = detector.detectAndDecode(crop)
        if data:
            return data
    return None


def main() -> int:
    pdf_bytes = sys.stdin.buffer.read()
    if not pdf_bytes:
        print(json.dumps({"error": "empty input"}))
        return 1
    url = decode_qr_from_pdf(pdf_bytes)
    print(json.dumps({"url": url}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
