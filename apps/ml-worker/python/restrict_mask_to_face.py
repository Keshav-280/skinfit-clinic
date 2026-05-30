#!/usr/bin/env python3
"""
Clip acne heatmap overlays to the face boundary only.

Uses MediaPipe Face Mesh for a face-region mask. Inside the face: keeps the
original inference mask pixels unchanged. Outside: replaces with the source photo
(no heatmap on hair/background).

Wrinkle masks are not processed here — callers should skip them.

Input:
  { "mask_b64": "<jpeg>", "source_b64": "<jpeg>", "kind": "acne"|"wrinkle" }

Output:
  { "ok": true, "jpeg_b64": "<jpeg>" }  or  { "ok": false, "error": "..." }
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


def face_mesh_context():
    """Legacy Face Mesh via mp.solutions (not available on newer mediapipe wheels)."""
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


# Face oval — skin boundary for clipping (includes forehead/cheeks/chin).
FACE_OVAL = [
    10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
    397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
    172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
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


def build_acne_face_clip_mask(bgr: np.ndarray) -> np.ndarray | None:
    """Full face oval for acne — no threshold gating, minimal edge trim for hair."""
    mesh = face_mesh_context()
    if mesh is None:
        return None
    fh, fw = bgr.shape[:2]
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    with mesh as face_mesh:
        res = face_mesh.process(rgb)
        if not res.multi_face_landmarks:
            return None

    mask = np.zeros((fh, fw), dtype=np.uint8)
    oval_pts = landmarks_to_points(
        res.multi_face_landmarks[0].landmark, FACE_OVAL, fw, fh
    )
    cv2.fillPoly(mask, [oval_pts], 255)

    # Slight edge erosion — trims hair/neck fringe only, keeps full facial coverage.
    k = max(3, int(min(fw, fh) * 0.006)) | 1
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k))
    mask = cv2.erode(mask, kernel, iterations=1)

    # Narrow soft edge at the boundary (anti-alias), not a strength cutoff.
    k_blur = max(3, int(min(fw, fh) * 0.005)) | 1
    mask = cv2.GaussianBlur(mask, (k_blur, k_blur), 0)
    return mask


def fallback_ellipse_mask(bgr: np.ndarray) -> np.ndarray:
    """Centre-weighted ellipse when Face Mesh is unavailable."""
    fh, fw = bgr.shape[:2]
    mask = np.zeros((fh, fw), dtype=np.uint8)
    cx, cy = fw // 2, int(fh * 0.44)
    ax, ay = int(fw * 0.36), int(fh * 0.40)
    cv2.ellipse(mask, (cx, cy), (ax, ay), 0, 0, 360, 255, -1)
    return cv2.GaussianBlur(mask, (11, 11), 0)


def clip_acne_mask_to_face(mask_bgr: np.ndarray, source_bgr: np.ndarray) -> np.ndarray:
    """
    Hard clip at face boundary: inside = original mask pixels, outside = source photo.
    No overlay-diff thresholding — preserves inference heatmap identity on skin.
    """
    fh, fw = mask_bgr.shape[:2]
    source = cv2.resize(source_bgr, (fw, fh), interpolation=cv2.INTER_AREA)

    skin = build_acne_face_clip_mask(source)
    if skin is None:
        skin = fallback_ellipse_mask(source)

    alpha = skin.astype(np.float32) / 255.0
    alpha3 = np.stack([alpha, alpha, alpha], axis=-1)

    mask_f = mask_bgr.astype(np.float32)
    source_f = source.astype(np.float32)
    out = mask_f * alpha3 + source_f * (1.0 - alpha3)
    return np.clip(out, 0, 255).astype(np.uint8)


def main() -> None:
    try:
        payload = json.loads(sys.stdin.read() or "{}")
    except json.JSONDecodeError:
        print(json.dumps({"ok": False, "error": "invalid json"}))
        return

    mask_b64 = payload.get("mask_b64")
    source_b64 = payload.get("source_b64")
    kind = str(payload.get("kind") or "acne")

    if kind != "acne":
        print(json.dumps({"ok": False, "error": "only acne masks are clipped"}))
        return

    if not isinstance(mask_b64, str) or not isinstance(source_b64, str):
        print(json.dumps({"ok": False, "error": "mask_b64 and source_b64 required"}))
        return

    mask = decode_jpeg_b64(mask_b64)
    source = decode_jpeg_b64(source_b64)
    if mask is None or source is None:
        print(json.dumps({"ok": False, "error": "jpeg decode failed"}))
        return

    try:
        out = clip_acne_mask_to_face(mask, source)
        print(json.dumps({"ok": True, "jpeg_b64": encode_jpeg_b64(out)}))
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e)}))


if __name__ == "__main__":
    main()
