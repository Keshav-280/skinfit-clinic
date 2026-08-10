#!/usr/bin/env python3
"""
Extract wrinkle polylines from a wrinkle-mask JPEG vs the source face photo.

Input (stdin JSON):
  { "mask_b64": "<jpeg>", "source_b64": "<jpeg>" }

Output (stdout JSON):
  { "ok": true, "wrinkle_lines": [ { "type": "polyline", "class": "wrinkles",
      "points_pct": [[x,y], ...], "length_pct": float }, ... ] }
  or { "ok": false, "error": "..." }

Diffs are restricted to the MediaPipe face oval so hair/glasses/background
edges do not become false wrinkle lines. Tuned for smiling-pose masks.
"""

from __future__ import annotations

import base64
import json
import sys
from typing import Any

import cv2
import numpy as np

try:
    import mediapipe as mp
except ImportError:
    mp = None  # type: ignore


# Face oval — same indices as extract_proxy_regions / restrict_mask_to_face.
FACE_OVAL = [
    10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
    397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
    172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
]

DIFF_THRESHOLD = 70
MIN_ARC_PX = 50.0
MAX_WRINKLE_LINES = 8
MIN_LENGTH_PCT = 2.5


def face_mesh_context():
    if mp is None:
        return None
    solutions = getattr(mp, "solutions", None)
    if solutions is None:
        return None
    return solutions.face_mesh.FaceMesh(
        static_image_mode=True,
        max_num_faces=1,
        refine_landmarks=True,
        min_detection_confidence=0.5,
    )


def decode_jpeg_b64(data: str) -> np.ndarray | None:
    try:
        raw = base64.b64decode(data)
    except Exception:
        return None
    arr = np.frombuffer(raw, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    return img


def build_face_oval_mask(source_bgr: np.ndarray) -> np.ndarray | None:
    """Binary mask (255 inside face oval, 0 outside). None if Face Mesh fails."""
    mesh = face_mesh_context()
    if mesh is None:
        return None
    h, w = source_bgr.shape[:2]
    rgb = cv2.cvtColor(source_bgr, cv2.COLOR_BGR2RGB)
    with mesh as face_mesh:
        res = face_mesh.process(rgb)
    if not res.multi_face_landmarks:
        return None
    landmarks = res.multi_face_landmarks[0].landmark
    pts = []
    for idx in FACE_OVAL:
        if idx < 0 or idx >= len(landmarks):
            continue
        lm = landmarks[idx]
        pts.append([float(lm.x) * w, float(lm.y) * h])
    if len(pts) < 3:
        return None
    mask = np.zeros((h, w), dtype=np.uint8)
    cv2.fillConvexPoly(
        mask, cv2.convexHull(np.array(pts, dtype=np.float32)).astype(np.int32), 255
    )
    return mask


def fallback_ellipse_mask(h: int, w: int) -> np.ndarray:
    """Centre-weighted ellipse when Face Mesh is unavailable."""
    mask = np.zeros((h, w), dtype=np.uint8)
    cx, cy = w // 2, int(h * 0.44)
    ax, ay = int(w * 0.34), int(h * 0.38)
    cv2.ellipse(mask, (cx, cy), (ax, ay), 0, 0, 360, 255, -1)
    return mask


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

    # Zero out everything outside the face BEFORE diffing so glasses frames,
    # hair edges, and background lighting cannot become polylines.
    face_mask = build_face_oval_mask(source_bgr)
    if face_mask is None:
        face_mask = fallback_ellipse_mask(h, w)
    # Always apply face mask — no more conditional
    source_bgr = cv2.bitwise_and(source_bgr, source_bgr, mask=face_mask)
    mask = cv2.bitwise_and(mask, mask, mask=face_mask)

    mask_gray = cv2.cvtColor(mask, cv2.COLOR_BGR2GRAY)
    source_gray = cv2.cvtColor(source_bgr, cv2.COLOR_BGR2GRAY)

    diff = cv2.absdiff(mask_gray, source_gray)
    _, binary = cv2.threshold(diff, DIFF_THRESHOLD, 255, cv2.THRESH_BINARY)

    # Clean speckles, then bridge real wrinkle segments
    open_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, open_kernel, iterations=1)
    close_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, close_kernel, iterations=1)

    binary = cv2.bitwise_and(binary, face_mask)

    skel = skeletonize(binary)
    contours, _ = cv2.findContours(skel, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)

    max_dim = float(max(h, w)) or 1.0
    lines: list[dict[str, Any]] = []

    for contour in contours:
        arc = float(cv2.arcLength(contour, closed=False))
        if arc < MIN_ARC_PX:
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

        length_pct = round(arc / max_dim * 100.0, 2)
        if length_pct < MIN_LENGTH_PCT:
            continue

        lines.append(
            {
                "type": "polyline",
                "class": "wrinkles",
                "points_pct": points_pct,
                "length_pct": length_pct,
            }
        )

    # Prefer longer lines; hard cap noise volume
    lines.sort(key=lambda x: -float(x.get("length_pct") or 0))
    return lines[:MAX_WRINKLE_LINES]


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
