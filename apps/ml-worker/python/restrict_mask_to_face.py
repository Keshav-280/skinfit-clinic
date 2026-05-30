#!/usr/bin/env python3
"""
Clip inference mask overlays (acne heatmap / wrinkle tint) to face skin only.

Uses MediaPipe Face Mesh for a skin-region mask (face oval minus eyes/lips/brows).
Reads JSON from stdin, writes JSON to stdout (last line).

Input:
  { "mask_b64": "<jpeg>", "source_b64": "<jpeg>", "kind": "acne"|"wrinkle" }

Output:
  { "ok": true, "jpeg_b64": "<jpeg>" }  or  { "ok": false, "error": "..." }

Requires: pip install mediapipe opencv-python-headless numpy Pillow
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

# Face oval — inner skin boundary (excludes most hair / neck).
FACE_OVAL = [
    10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
    397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
    172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
]

# Regions to punch out (not skin for heatmaps).
EXCLUDE_LOOPS = [
    [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246, 33],
    [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398, 362],
    [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185, 61],
    [70, 63, 105, 66, 107, 55, 65, 52, 53, 46, 70],
    [300, 293, 334, 296, 336, 285, 295, 282, 283, 276, 300],
]


def decode_jpeg_b64(data: str) -> np.ndarray | None:
    try:
        raw = base64.b64decode(data)
    except Exception:
        return None
    arr = np.frombuffer(raw, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    return img


def encode_jpeg_b64(img: np.ndarray, quality: int = 88) -> str:
    ok, buf = cv2.imencode(".jpg", img, [int(cv2.IMWRITE_JPEG_QUALITY), quality])
    if not ok:
        raise RuntimeError("jpeg encode failed")
    return base64.b64encode(buf.tobytes()).decode("ascii")


def landmarks_to_points(
    landmarks: Any, indices: list[int], w: int, h: int
) -> np.ndarray:
    pts = []
    for idx in indices:
        lm = landmarks[idx]
        pts.append([int(lm.x * w), int(lm.y * h)])
    return np.array(pts, dtype=np.int32)


def build_face_skin_mask(bgr: np.ndarray, kind: str = "acne") -> np.ndarray | None:
    if mp is None:
        return None
    fh, fw = bgr.shape[:2]
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    with mp.solutions.face_mesh.FaceMesh(
        static_image_mode=True,
        max_num_faces=1,
        refine_landmarks=True,
        min_detection_confidence=0.5,
    ) as face_mesh:
        res = face_mesh.process(rgb)
        if not res.multi_face_landmarks:
            return None
        lm = res.multi_face_landmarks[0].landmark

    mask = np.zeros((fh, fw), dtype=np.uint8)
    oval_pts = landmarks_to_points(lm, FACE_OVAL, fw, fh)
    cv2.fillPoly(mask, [oval_pts], 255)

    for loop in EXCLUDE_LOOPS:
        hole = landmarks_to_points(lm, loop, fw, fh)
        cv2.fillPoly(mask, [hole], 0)

    if kind == "acne":
        # Tighter skin region — acne heatmaps bleed onto hair without this.
        k = max(5, int(min(fw, fh) * 0.018)) | 1
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k))
        mask = cv2.erode(mask, kernel, iterations=2)

        cx, cy = fw // 2, int(fh * 0.46)
        scale = 0.90
        M = cv2.getRotationMatrix2D((cx, cy), 0, scale)
        mask = cv2.warpAffine(
            mask, M, (fw, fh), flags=cv2.INTER_LINEAR, borderValue=0
        )

        brow_y = int((lm[107].y + lm[336].y) * 0.5 * fh)
        top_y = int(min(lm[10].y, lm[338].y) * fh)
        if brow_y > top_y + 8:
            fade = np.linspace(0.0, 1.0, brow_y - top_y, dtype=np.float32)
            mask_f = mask.astype(np.float32)
            mask_f[top_y:brow_y, :] *= fade[:, None]
            mask = np.clip(mask_f, 0, 255).astype(np.uint8)
    else:
        k = max(3, int(min(fw, fh) * 0.012)) | 1
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k))
        mask = cv2.erode(mask, kernel, iterations=1)

    k_blur = max(3, int(min(fw, fh) * 0.012)) | 1
    mask = cv2.GaussianBlur(mask, (k_blur, k_blur), 0)
    return mask


def fallback_ellipse_mask(bgr: np.ndarray) -> np.ndarray:
    """Centre-weighted ellipse when Face Mesh is unavailable."""
    fh, fw = bgr.shape[:2]
    mask = np.zeros((fh, fw), dtype=np.uint8)
    cx, cy = fw // 2, int(fh * 0.42)
    ax, ay = int(fw * 0.34), int(fh * 0.38)
    cv2.ellipse(mask, (cx, cy), (ax, ay), 0, 0, 360, 255, -1)
    return cv2.GaussianBlur(mask, (21, 21), 0)


def restrict_overlay(
    mask_bgr: np.ndarray, source_bgr: np.ndarray, kind: str
) -> np.ndarray:
    fh, fw = mask_bgr.shape[:2]
    source = cv2.resize(source_bgr, (fw, fh), interpolation=cv2.INTER_AREA)

    skin = build_face_skin_mask(source, kind)
    if skin is None:
        skin = fallback_ellipse_mask(source)

    alpha = skin.astype(np.float32) / 255.0
    alpha3 = np.stack([alpha, alpha, alpha], axis=-1)

    mask_f = mask_bgr.astype(np.float32)
    source_f = source.astype(np.float32)
    overlay = mask_f - source_f

    # Suppress low-contrast diff noise outside real heatmap/tint.
    if kind == "acne":
        warm = np.maximum(0.0, overlay[:, :, 2] - np.maximum(overlay[:, :, 1], overlay[:, :, 0]) - 8.0)
        strength = np.clip(warm / 80.0, 0.0, 1.0)
    else:
        mag = np.linalg.norm(np.maximum(overlay, 0.0), axis=-1)
        strength = np.clip(mag / 70.0, 0.0, 1.0)

    strength3 = np.stack([strength, strength, strength], axis=-1)
    gated_overlay = overlay * strength3 * alpha3
    out = np.clip(source_f + gated_overlay, 0, 255).astype(np.uint8)
    return out


def main() -> None:
    try:
        payload = json.loads(sys.stdin.read() or "{}")
    except json.JSONDecodeError:
        print(json.dumps({"ok": False, "error": "invalid json"}))
        return

    mask_b64 = payload.get("mask_b64")
    source_b64 = payload.get("source_b64")
    kind = str(payload.get("kind") or "acne")

    if not isinstance(mask_b64, str) or not isinstance(source_b64, str):
        print(json.dumps({"ok": False, "error": "mask_b64 and source_b64 required"}))
        return

    mask = decode_jpeg_b64(mask_b64)
    source = decode_jpeg_b64(source_b64)
    if mask is None or source is None:
        print(json.dumps({"ok": False, "error": "jpeg decode failed"}))
        return

    try:
        out = restrict_overlay(mask, source, kind)
        print(json.dumps({"ok": True, "jpeg_b64": encode_jpeg_b64(out)}))
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e)}))


if __name__ == "__main__":
    main()
