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
    bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if bgr is None:
        raise ValueError("invalid_jpeg")
    return bgr


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
