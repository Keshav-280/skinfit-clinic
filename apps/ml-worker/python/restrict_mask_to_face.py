#!/usr/bin/env python3
"""
Clip heatmap overlays to the face boundary only.

Uses MediaPipe Face Mesh for a face-region mask.
- Acne: inside = original mask, outside = source photo.
- Wrinkle: inside = original mask, outside = black (screen blend makes black invisible).

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

# Top arc — extend upward toward hairline (matches facePortraitBox.ts).
FOREHEAD_TOP_INDICES = [10, 338, 297, 332, 284, 251]
FOREHEAD_EXTEND_FRAC = 0.12
NECK_TRIM_FRAC = 0.035


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


def face_height_px(landmarks: Any, fh: int) -> tuple[int, int, int]:
    """Chin y, top-of-oval y, and face height in pixels."""
    chin_y = int(landmarks[152].y * fh)
    top_y = int(min(landmarks[i].y for i in FOREHEAD_TOP_INDICES) * fh)
    face_h = max(8, chin_y - top_y)
    return chin_y, top_y, face_h


def extend_oval_forehead(
    landmarks: Any, oval_pts: np.ndarray, fh: int
) -> np.ndarray:
    """Shift top-arc oval points upward toward the hairline."""
    _, top_y, face_h = face_height_px(landmarks, fh)
    extend_px = int(face_h * FOREHEAD_EXTEND_FRAC)
    top_threshold = top_y + int(face_h * 0.15)

    out = oval_pts.copy()
    for i in range(len(FACE_OVAL)):
        if out[i][1] <= top_threshold:
            out[i][1] = max(0, int(out[i][1]) - extend_px)
    return out


def trim_neck_from_mask(
    mask: np.ndarray, landmarks: Any, fh: int
) -> np.ndarray:
    """Mask out a small band below the chin to avoid neck bleed."""
    chin_y, _, face_h = face_height_px(landmarks, fh)
    neck_start = min(fh, chin_y + int(face_h * NECK_TRIM_FRAC))
    if neck_start < fh:
        mask[neck_start:, :] = 0
    return mask


def feather_mask_alpha(mask_binary: np.ndarray, fw: int, fh: int) -> np.ndarray:
    """Distance-transform alpha ramp for a smooth boundary blend."""
    binary = (mask_binary > 127).astype(np.uint8)
    dist = cv2.distanceTransform(binary, cv2.DIST_L2, 5)
    feather_px = max(14, min(48, int(min(fw, fh) * 0.022)))
    alpha = np.clip(dist / float(feather_px), 0.0, 1.0)
    return (alpha * 255.0).astype(np.uint8)


def build_acne_face_clip_mask(bgr: np.ndarray) -> np.ndarray | None:
    """Face oval extended to hairline with soft alpha boundary."""
    mesh = face_mesh_context()
    if mesh is None:
        return None
    fh, fw = bgr.shape[:2]
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    with mesh as face_mesh:
        res = face_mesh.process(rgb)
        if not res.multi_face_landmarks:
            return None

    landmarks = res.multi_face_landmarks[0].landmark
    mask = np.zeros((fh, fw), dtype=np.uint8)
    oval_pts = landmarks_to_points(landmarks, FACE_OVAL, fw, fh)
    oval_pts = extend_oval_forehead(landmarks, oval_pts, fh)
    cv2.fillPoly(mask, [oval_pts], 255)
    trim_neck_from_mask(mask, landmarks, fh)
    return feather_mask_alpha(mask, fw, fh)


def fallback_ellipse_mask(bgr: np.ndarray) -> np.ndarray:
    """Centre-weighted ellipse when Face Mesh is unavailable."""
    fh, fw = bgr.shape[:2]
    mask = np.zeros((fh, fw), dtype=np.uint8)
    cx, cy = fw // 2, int(fh * 0.44)
    ax, ay = int(fw * 0.36), int(fh * 0.40)
    cv2.ellipse(mask, (cx, cy), (ax, ay), 0, 0, 360, 255, -1)
    return feather_mask_alpha(mask, fw, fh)


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


def clip_wrinkle_mask_to_face(mask_bgr: np.ndarray, source_bgr: np.ndarray) -> np.ndarray:
    """
    Zero out wrinkle mask outside the face boundary.
    Wrinkle masks are rendered with screen blend — black = invisible.
    """
    fh, fw = mask_bgr.shape[:2]
    source = cv2.resize(source_bgr, (fw, fh), interpolation=cv2.INTER_AREA)

    skin = build_acne_face_clip_mask(source)
    if skin is None:
        skin = fallback_ellipse_mask(source)

    alpha = skin.astype(np.float32) / 255.0
    alpha3 = np.stack([alpha, alpha, alpha], axis=-1)

    out = mask_bgr.astype(np.float32) * alpha3
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

    if kind not in ("acne", "wrinkle"):
        print(json.dumps({"ok": False, "error": f"unknown kind: {kind}"}))
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
        if kind == "wrinkle":
            out = clip_wrinkle_mask_to_face(mask, source)
        else:
            out = clip_acne_mask_to_face(mask, source)
        print(json.dumps({"ok": True, "jpeg_b64": encode_jpeg_b64(out)}))
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e)}))


if __name__ == "__main__":
    main()
