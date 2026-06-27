#!/usr/bin/env python3
"""
Extract a face embedding for scan identity verification (InsightFace buffalo_sc).

Reads JPEG bytes from stdin; writes one JSON line to stdout:
  {"ok": true, "embedding": [float, ...], "faceDetected": true}
  {"ok": false, "error": "...", "faceDetected": false}

Requires: pip install -r apps/ml-worker/python/requirements-identity.txt
"""

from __future__ import annotations

import json
import sys
from typing import Any

import numpy as np

try:
    import cv2
except ImportError:
    cv2 = None  # type: ignore

_APP = None


def _get_app():
    global _APP
    if _APP is not None:
        return _APP
    try:
        from insightface.app import FaceAnalysis
    except ImportError as exc:
        raise RuntimeError(
            "insightface is not installed. Run: pip install -r apps/ml-worker/python/requirements-identity.txt"
        ) from exc
    if cv2 is None:
        raise RuntimeError("opencv-python-headless is required for face identity")
    app = FaceAnalysis(name="buffalo_sc", providers=["CPUExecutionProvider"])
    app.prepare(ctx_id=-1, det_size=(640, 640))
    _APP = app
    return _APP


def _decode_jpeg(data: bytes) -> np.ndarray:
    if cv2 is None:
        raise RuntimeError("opencv required")
    arr = np.frombuffer(data, dtype=np.uint8)
    # IMREAD_COLOR | IMREAD_IGNORE_ORIENTATION would ignore EXIF; we want to
    # respect it so uploaded photos are upright (camera captures have no EXIF).
    bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if bgr is None:
        raise ValueError("invalid_jpeg")
    # Apply EXIF orientation if present. cv2.imdecode ignores EXIF rotation,
    # so uploaded gallery photos may arrive rotated/flipped.
    bgr_oriented = _apply_exif_orientation(data, bgr)
    return bgr_oriented


def _apply_exif_orientation(data: bytes, bgr: np.ndarray) -> np.ndarray:
    """Rotate/flip BGR image according to EXIF orientation tag in JPEG data."""
    try:
        # Parse EXIF orientation from raw bytes (avoid PIL dependency).
        # JPEG starts with FF D8; APP1 (EXIF) marker is FF E1.
        orientation = _read_exif_orientation(data)
    except Exception:
        return bgr
    if orientation is None or orientation <= 1:
        return bgr
    if orientation == 2:
        return cv2.flip(bgr, 1)
    elif orientation == 3:
        return cv2.rotate(bgr, cv2.ROTATE_180)
    elif orientation == 4:
        return cv2.flip(bgr, 0)
    elif orientation == 5:
        return cv2.flip(cv2.rotate(bgr, cv2.ROTATE_90_COUNTERCLOCKWISE), 1)
    elif orientation == 6:
        return cv2.rotate(bgr, cv2.ROTATE_90_CLOCKWISE)
    elif orientation == 7:
        return cv2.flip(cv2.rotate(bgr, cv2.ROTATE_90_CLOCKWISE), 1)
    elif orientation == 8:
        return cv2.rotate(bgr, cv2.ROTATE_90_COUNTERCLOCKWISE)
    return bgr


def _read_exif_orientation(data: bytes) -> int | None:
    """Minimal EXIF orientation parser (no external deps needed)."""
    if len(data) < 14 or data[0:2] != b"\xff\xd8":
        return None
    offset = 2
    while offset < len(data) - 4:
        if data[offset] != 0xFF:
            break
        marker = data[offset + 1]
        if marker == 0xE1:  # APP1
            seg_len = int.from_bytes(data[offset + 2 : offset + 4], "big")
            seg_data = data[offset + 4 : offset + 2 + seg_len]
            return _parse_orientation_from_app1(seg_data)
        elif marker in (0xD0, 0xD1, 0xD2, 0xD3, 0xD4, 0xD5, 0xD6, 0xD7, 0xD8, 0xD9):
            offset += 2
        else:
            seg_len = int.from_bytes(data[offset + 2 : offset + 4], "big")
            offset += 2 + seg_len
    return None


def _parse_orientation_from_app1(seg: bytes) -> int | None:
    if not seg.startswith(b"Exif\x00\x00"):
        return None
    tiff = seg[6:]
    if len(tiff) < 8:
        return None
    if tiff[0:2] == b"II":
        endian = "little"
    elif tiff[0:2] == b"MM":
        endian = "big"
    else:
        return None
    ifd_offset = int.from_bytes(tiff[4:8], endian)
    if ifd_offset + 2 > len(tiff):
        return None
    num_entries = int.from_bytes(tiff[ifd_offset : ifd_offset + 2], endian)
    for i in range(num_entries):
        entry_off = ifd_offset + 2 + i * 12
        if entry_off + 12 > len(tiff):
            break
        tag = int.from_bytes(tiff[entry_off : entry_off + 2], endian)
        if tag == 0x0112:  # Orientation tag
            value = int.from_bytes(tiff[entry_off + 8 : entry_off + 10], endian)
            return value
    return None


def _center_crop_square(bgr: np.ndarray) -> np.ndarray:
    """Center-crop to the largest inscribed square (mimics the face guide crop)."""
    h, w = bgr.shape[:2]
    if h == w:
        return bgr
    side = min(h, w)
    y0 = (h - side) // 2
    x0 = (w - side) // 2
    return bgr[y0 : y0 + side, x0 : x0 + side]


def _largest_face(faces: list[Any]) -> Any | None:
    if not faces:
        return None

    def area(face: Any) -> float:
        x1, y1, x2, y2 = face.bbox
        return max(0.0, float(x2 - x1)) * max(0.0, float(y2 - y1))

    return max(faces, key=area)


def extract_embedding(jpeg: bytes) -> dict[str, Any]:
    try:
        bgr = _decode_jpeg(jpeg)
    except ValueError:
        return {"ok": False, "faceDetected": False, "error": "invalid_jpeg"}

    app = _get_app()
    faces = app.get(bgr)
    face = _largest_face(faces)

    # Retry with center-crop if no face found on the full image.
    # Uploaded gallery photos may have the face as a smaller portion of frame
    # compared to camera captures that use the face guide crop.
    if face is None or getattr(face, "embedding", None) is None:
        cropped = _center_crop_square(bgr)
        if cropped.shape != bgr.shape:
            faces = app.get(cropped)
            face = _largest_face(faces)

    if face is None or getattr(face, "embedding", None) is None:
        return {"ok": False, "faceDetected": False, "error": "no_face_detected"}

    emb = np.asarray(face.embedding, dtype=np.float32)
    if emb.ndim != 1 or emb.size < 8:
        return {"ok": False, "faceDetected": False, "error": "bad_embedding"}

    norm = float(np.linalg.norm(emb))
    if norm < 1e-6:
        return {"ok": False, "faceDetected": False, "error": "zero_embedding"}
    emb = emb / norm

    return {
        "ok": True,
        "faceDetected": True,
        "embedding": [float(x) for x in emb.tolist()],
        "dim": int(emb.size),
    }


def main() -> int:
    data = sys.stdin.buffer.read()
    if not data:
        out = {"ok": False, "faceDetected": False, "error": "empty_input"}
        print(json.dumps(out))
        return 1
    try:
        out = extract_embedding(data)
    except Exception as exc:  # noqa: BLE001
        out = {"ok": False, "faceDetected": False, "error": str(exc)}
    print(json.dumps(out))
    return 0 if out.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
