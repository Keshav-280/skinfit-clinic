#!/usr/bin/env python3
"""Detect, validate, and crop face portraits for annotator training images."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import cv2
import numpy as np

MIN_FACE_AREA_RATIO = 0.035
MAX_FACE_AREA_RATIO = 0.92
MAX_FACE_CENTER_Y_RATIO = 0.72
MIN_CROPPED_FACE_RATIO = 0.18
PADDING_X = 0.45
PADDING_TOP = 0.55
PADDING_BOTTOM = 0.35


def _load_cascades() -> tuple[cv2.CascadeClassifier, cv2.CascadeClassifier]:
    frontal = cv2.CascadeClassifier(
        cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    )
    profile = cv2.CascadeClassifier(
        cv2.data.haarcascades + "haarcascade_profileface.xml"
    )
    return frontal, profile


def _detect_faces(gray: np.ndarray, frontal, profile) -> list[tuple[int, int, int, int]]:
    faces: list[tuple[int, int, int, int]] = []
    for cascade in (frontal, profile):
        found = cascade.detectMultiScale(
            gray,
            scaleFactor=1.08,
            minNeighbors=4,
            minSize=(48, 48),
        )
        for x, y, w, h in found:
            faces.append((int(x), int(y), int(w), int(h)))
    if not faces:
        return []
    # Merge overlapping boxes, keep largest regions.
    faces.sort(key=lambda b: b[2] * b[3], reverse=True)
    deduped: list[tuple[int, int, int, int]] = []
    for box in faces:
        x, y, w, h = box
        cx, cy = x + w / 2, y + h / 2
        if any(
            abs(cx - (dx + dw / 2)) < min(w, dw) * 0.35
            and abs(cy - (dy + dh / 2)) < min(h, dh) * 0.35
            for dx, dy, dw, dh in deduped
        ):
            continue
        deduped.append(box)
    return deduped


def _crop_face(img: np.ndarray, face: tuple[int, int, int, int]) -> np.ndarray:
    h, w = img.shape[:2]
    x, y, fw, fh = face
    pad_l = int(fw * PADDING_X)
    pad_r = int(fw * PADDING_X)
    pad_t = int(fh * PADDING_TOP)
    pad_b = int(fh * PADDING_BOTTOM)
    x1 = max(0, x - pad_l)
    y1 = max(0, y - pad_t)
    x2 = min(w, x + fw + pad_r)
    y2 = min(h, y + fh + pad_b)
    return img[y1:y2, x1:x2]


def analyze_face_image(path: Path) -> dict:
    frontal, profile = _load_cascades()
    img = cv2.imread(str(path))
    if img is None:
        return {"ok": False, "reason": "unreadable"}

    h, w = img.shape[:2]
    if h < 120 or w < 120:
        return {"ok": False, "reason": "too_small"}

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    faces = _detect_faces(gray, frontal, profile)
    if not faces:
        return {"ok": False, "reason": "no_face"}

    x, y, fw, fh = faces[0]
    face_area = fw * fh
    image_area = w * h
    face_ratio = face_area / image_area
    center_y = (y + fh / 2) / h
    aspect = h / max(w, 1)

    if face_ratio < MIN_FACE_AREA_RATIO:
        return {"ok": False, "reason": "face_too_small_full_body", "face_ratio": face_ratio}
    if face_ratio > MAX_FACE_AREA_RATIO:
        return {"ok": False, "reason": "face_too_large", "face_ratio": face_ratio}
    if center_y > MAX_FACE_CENTER_Y_RATIO and aspect > 1.25:
        return {"ok": False, "reason": "body_visible", "face_ratio": face_ratio}
    if aspect > 2.0 and face_ratio < 0.12:
        return {"ok": False, "reason": "tall_body_shot", "face_ratio": face_ratio}

    cropped = _crop_face(img, faces[0])
    ch, cw = cropped.shape[:2]
    cgray = cv2.cvtColor(cropped, cv2.COLOR_BGR2GRAY)
    cfaces = _detect_faces(cgray, frontal, profile)
    if not cfaces:
        return {"ok": False, "reason": "crop_lost_face"}
    cx, cy, cfw, cfh = cfaces[0]
    cropped_ratio = (cfw * cfh) / max(ch * cw, 1)
    if cropped_ratio < MIN_CROPPED_FACE_RATIO:
        return {"ok": False, "reason": "crop_face_too_small", "cropped_ratio": cropped_ratio}

    return {
        "ok": True,
        "face_ratio": round(face_ratio, 4),
        "cropped_ratio": round(cropped_ratio, 4),
        "crop_size": [int(cw), int(ch)],
        "pose": "profile" if faces[0] in _detect_faces(cgray, profile, profile) else "frontal",
    }


def crop_face_image(path: Path, out_path: Path) -> dict:
    frontal, profile = _load_cascades()
    img = cv2.imread(str(path))
    if img is None:
        return {"ok": False, "reason": "unreadable"}

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    faces = _detect_faces(gray, frontal, profile)
    if not faces:
        return {"ok": False, "reason": "no_face"}

    cropped = _crop_face(img, faces[0])
    out_path.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(out_path), cropped, [int(cv2.IMWRITE_JPEG_QUALITY), 92])
    return analyze_face_image(out_path)


def main() -> None:
    if len(sys.argv) < 2:
        print(json.dumps({"ok": False, "reason": "usage"}))
        sys.exit(1)
    cmd = sys.argv[1]
    path = Path(sys.argv[2])
    if cmd == "analyze":
        print(json.dumps(analyze_face_image(path)))
    elif cmd == "crop":
        out = Path(sys.argv[3])
        print(json.dumps(crop_face_image(path, out)))
    else:
        print(json.dumps({"ok": False, "reason": "unknown_cmd"}))
        sys.exit(1)


if __name__ == "__main__":
    main()
