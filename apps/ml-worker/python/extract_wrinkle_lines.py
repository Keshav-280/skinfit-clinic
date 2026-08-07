#!/usr/bin/env python3
"""
Extract wrinkle polylines from a wrinkle-mask JPEG vs the source face photo.

Input (stdin JSON):
  { "mask_b64": "<jpeg>", "source_b64": "<jpeg>" }

Output (stdout JSON):
  { "ok": true, "wrinkle_lines": [ { "type": "polyline", "class": "wrinkles",
      "points_pct": [[x,y], ...], "length_pct": float }, ... ] }
  or { "ok": false, "error": "..." }
"""

from __future__ import annotations

import base64
import json
import sys
from typing import Any

import cv2
import numpy as np


def decode_jpeg_b64(data: str) -> np.ndarray | None:
    try:
        raw = base64.b64decode(data)
    except Exception:
        return None
    arr = np.frombuffer(raw, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    return img


def skeletonize_fallback(binary: np.ndarray) -> np.ndarray:
    skel = np.zeros_like(binary)
    element = cv2.getStructuringElement(cv2.MORPH_CROSS, (3, 3))
    img = binary.copy()
    while True:
        eroded = cv2.erode(img, element)
        temp = cv2.dilate(eroded, element)
        temp = cv2.subtract(img, temp)
        skel = cv2.bitwise_or(skel, temp)
        img = eroded.copy()
        if cv2.countNonZero(img) == 0:
            break
    return skel


def skeletonize(binary: np.ndarray) -> np.ndarray:
    try:
        ximgproc = getattr(cv2, "ximgproc", None)
        if ximgproc is not None and hasattr(ximgproc, "thinning"):
            return ximgproc.thinning(binary)
    except Exception:
        pass
    return skeletonize_fallback(binary)


def extract_wrinkle_lines(
    wrinkle_mask_bgr: np.ndarray, source_bgr: np.ndarray
) -> list[dict[str, Any]]:
    """Isolate wrinkle highlights and return percentage-based polylines."""
    if wrinkle_mask_bgr is None or source_bgr is None:
        return []

    h, w = source_bgr.shape[:2]
    if h < 8 or w < 8:
        return []

    mask = wrinkle_mask_bgr
    if mask.shape[0] != h or mask.shape[1] != w:
        mask = cv2.resize(mask, (w, h), interpolation=cv2.INTER_LINEAR)

    mask_gray = cv2.cvtColor(mask, cv2.COLOR_BGR2GRAY)
    source_gray = cv2.cvtColor(source_bgr, cv2.COLOR_BGR2GRAY)

    diff = cv2.absdiff(mask_gray, source_gray)
    _, binary = cv2.threshold(diff, 25, 255, cv2.THRESH_BINARY)

    # Clean speckles before skeletonization
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel, iterations=1)

    skel = skeletonize(binary)
    contours, _ = cv2.findContours(skel, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)

    max_dim = float(max(h, w)) or 1.0
    lines: list[dict[str, Any]] = []

    for contour in contours:
        arc = float(cv2.arcLength(contour, closed=False))
        if arc < 15.0:
            continue
        approx = cv2.approxPolyDP(contour, epsilon=2.0, closed=False)
        if approx is None or len(approx) < 2:
            continue

        points_pct: list[list[float]] = []
        for pt in approx.reshape(-1, 2):
            x = float(pt[0]) / w * 100.0
            y = float(pt[1]) / h * 100.0
            points_pct.append([round(x, 2), round(y, 2)])

        if len(points_pct) < 2:
            continue

        lines.append(
            {
                "type": "polyline",
                "class": "wrinkles",
                "points_pct": points_pct,
                "length_pct": round(arc / max_dim * 100.0, 2),
            }
        )

    # Prefer longer lines first for stable frontend merging
    lines.sort(key=lambda x: -float(x.get("length_pct") or 0))
    return lines


def main() -> int:
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
    except Exception as e:
        print(json.dumps({"ok": False, "error": f"invalid_json: {e}"}))
        return 0

    mask_b64 = payload.get("mask_b64")
    source_b64 = payload.get("source_b64")
    if not isinstance(mask_b64, str) or not isinstance(source_b64, str):
        print(json.dumps({"ok": False, "error": "mask_b64 and source_b64 required"}))
        return 0

    mask = decode_jpeg_b64(mask_b64)
    source = decode_jpeg_b64(source_b64)
    if mask is None or source is None:
        print(json.dumps({"ok": False, "error": "failed to decode jpeg"}))
        return 0

    try:
        lines = extract_wrinkle_lines(mask, source)
        print(json.dumps({"ok": True, "wrinkle_lines": lines}))
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e)}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
