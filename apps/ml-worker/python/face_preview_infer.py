#!/usr/bin/env python3
"""
Live capture preview: RetinaFace (ONNX) + blink/smile classifier (ONNX).

Reads JPEG bytes from stdin; writes one JSON line to stdout.
Models (optional): models/capture/retinaface.onnx, models/capture/expression_blink_smile.onnx

Requires: pip install onnxruntime opencv-python-headless numpy Pillow
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any

import numpy as np

try:
    import cv2
except ImportError:
    cv2 = None  # type: ignore

try:
    import onnxruntime as ort
except ImportError:
    ort = None  # type: ignore


def models_dir() -> Path:
    raw = os.environ.get("FACE_CAPTURE_MODELS_DIR", "models/capture")
    p = Path(raw)
    if not p.is_absolute():
        root = os.environ.get("PROJECT_ROOT", os.getcwd())
        p = Path(root) / p
    return p


def clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def head_pose_from_five(
    le: tuple[float, float],
    re: tuple[float, float],
    nose: tuple[float, float],
    lm: tuple[float, float],
    rm: tuple[float, float],
) -> dict[str, float]:
    eye_mid_x = (le[0] + re[0]) / 2
    eye_mid_y = (le[1] + re[1]) / 2
    inter = max(1e-6, ((re[0] - le[0]) ** 2 + (re[1] - le[1]) ** 2) ** 0.5)
    mouth_mid_y = (lm[1] + rm[1]) / 2
    yaw = ((nose[0] - eye_mid_x) / inter) * 42
    pitch = ((nose[1] - eye_mid_y) / inter) * 38 - 8
    roll = np.degrees(np.arctan2(re[1] - le[1], re[0] - le[0]))
    face_h = max(0.08, mouth_mid_y - eye_mid_y)
    pitch += (nose[1] - mouth_mid_y) / face_h * 12
    return {
        "yaw": float(clamp(yaw, -55, 55)),
        "pitch": float(clamp(pitch, -40, 40)),
        "roll": float(clamp(roll, -35, 35)),
    }


def portrait_box(x1: float, y1: float, x2: float, y2: float, fw: int, fh: int) -> dict[str, float]:
    w = max(1.0, x2 - x1)
    h = max(1.0, y2 - y1)
    pad_x = w * 0.04
    pad_top = h * 0.12
    pad_bottom = h * 0.04
    nx = max(0.0, (x1 - pad_x) / fw)
    ny = max(0.0, (y1 - pad_top) / fh)
    nw = min(1.0 - nx, (w + pad_x * 2) / fw)
    nh = min(1.0 - ny, (h + pad_top + pad_bottom) / fh)
    return {"x": nx, "y": ny, "width": nw, "height": nh}


class RetinaFaceOnnx:
    def __init__(self, path: Path):
        if ort is None or cv2 is None:
            raise RuntimeError("onnxruntime and opencv required for RetinaFace")
        self.session = ort.InferenceSession(
            str(path), providers=["CPUExecutionProvider"]
        )
        self.input_name = self.session.get_inputs()[0].name
        shape = self.session.get_inputs()[0].shape
        self.size = int(shape[2]) if len(shape) > 2 and shape[2] else 640

    def detect(self, bgr: np.ndarray) -> tuple[dict[str, float] | None, dict[str, float] | None]:
        fh, fw = bgr.shape[:2]
        blob = cv2.dnn.blobFromImage(
            bgr, 1.0, (self.size, self.size), (104.0, 117.0, 123.0), swapRB=True
        )
        outs = self.session.run(None, {self.input_name: blob})
        if not outs:
            return None, None

        flat = outs[0]
        if isinstance(flat, list):
            flat = np.array(flat)
        flat = np.squeeze(flat)
        if flat.ndim == 1:
            flat = flat.reshape(1, -1)
        if flat.ndim != 2 or flat.shape[1] < 5:
            return None, None

        best_score = -1.0
        best = None
        for row in flat:
            score = float(row[4]) if row.shape[0] > 4 else 1.0
            if score < 0.5 or score <= best_score:
                continue
            if row.shape[0] >= 15:
                x1, y1, x2, y2 = float(row[0]), float(row[1]), float(row[2]), float(row[3])
                sx, sy = fw / self.size, fh / self.size
                x1, x2 = x1 * sx, x2 * sx
                y1, y2 = y1 * sy, y2 * sy
                le = (float(row[5]) * sx, float(row[6]) * sy)
                re = (float(row[7]) * sx, float(row[8]) * sy)
                nose = (float(row[9]) * sx, float(row[10]) * sy)
                lm = (float(row[11]) * sx, float(row[12]) * sy)
                rm = (float(row[13]) * sx, float(row[14]) * sy)
            elif row.shape[0] >= 4:
                cx, cy, bw, bh = float(row[0]), float(row[1]), float(row[2]), float(row[3])
                sx, sy = fw / self.size, fh / self.size
                x1 = (cx - bw / 2) * sx
                x2 = (cx + bw / 2) * sx
                y1 = (cy - bh / 2) * sy
                y2 = (cy + bh / 2) * sy
                le = re = nose = lm = rm = None
            else:
                continue
            best_score = score
            best = (x1, y1, x2, y2, le, re, nose, lm, rm)

        if best is None:
            return None, None

        x1, y1, x2, y2, le, re, nose, lm, rm = best
        box = portrait_box(x1, y1, x2, y2, fw, fh)
        pose = None
        if le and re and nose and lm and rm:
            pose = head_pose_from_five(le, re, nose, lm, rm)
        return box, pose


class ExpressionClassifierOnnx:
    def __init__(self, path: Path):
        if ort is None or cv2 is None:
            raise RuntimeError("onnxruntime and opencv required for expression classifier")
        self.session = ort.InferenceSession(
            str(path), providers=["CPUExecutionProvider"]
        )
        self.input_name = self.session.get_inputs()[0].name
        shape = self.session.get_inputs()[0].shape
        self.size = int(shape[2]) if len(shape) > 2 and shape[2] else 96

    def predict(self, bgr: np.ndarray, box: dict[str, float]) -> dict[str, float]:
        fh, fw = bgr.shape[:2]
        x = int(box["x"] * fw)
        y = int(box["y"] * fh)
        w = int(box["width"] * fw)
        h = int(box["height"] * fh)
        x2 = min(fw, x + max(8, w))
        y2 = min(fh, y + max(8, h))
        crop = bgr[y:y2, x:x2]
        if crop.size == 0:
            return {"blink": 0.0, "smile": 0.0}
        crop = cv2.resize(crop, (self.size, self.size))
        rgb = cv2.cvtColor(crop, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
        chw = np.transpose(rgb, (2, 0, 1))[np.newaxis, ...]
        out = self.session.run(None, {self.input_name: chw})[0]
        flat = np.squeeze(out).astype(float)
        if flat.size >= 2:
            blink = 1.0 / (1.0 + np.exp(-flat[0]))
            smile = 1.0 / (1.0 + np.exp(-flat[1]))
        else:
            blink = smile = float(flat.reshape(-1)[0]) if flat.size else 0.0
        return {"blink": float(blink), "smile": float(smile)}


def decode_jpeg(data: bytes) -> np.ndarray | None:
    if cv2 is None:
        return None
    arr = np.frombuffer(data, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    return img


def main() -> None:
    data = sys.stdin.buffer.read()
    if not data:
        print(json.dumps({"ok": False, "error": "empty input"}))
        return

    img = decode_jpeg(data)
    if img is None:
        print(json.dumps({"ok": False, "error": "jpeg decode failed"}))
        return

    mdir = models_dir()
    retina_path = mdir / "retinaface.onnx"
    expr_path = mdir / "expression_blink_smile.onnx"

    detector_available = retina_path.is_file() and ort is not None and cv2 is not None
    expression_available = expr_path.is_file() and ort is not None and cv2 is not None

    result: dict[str, Any] = {
        "ok": True,
        "detector": "retinaface",
        "expressionBackend": "classifier",
        "detectorAvailable": detector_available,
        "expressionAvailable": expression_available,
        "box": None,
        "pose": None,
        "expression": None,
    }

    warnings: list[str] = []
    if not detector_available:
        warnings.append(f"retinaface.onnx missing under {mdir}")
    if not expression_available:
        warnings.append(f"expression_blink_smile.onnx missing under {mdir}")
    if warnings:
        result["warning"] = "; ".join(warnings)

    box: dict[str, float] | None = None
    pose: dict[str, float] | None = None

    if detector_available:
        try:
            det = RetinaFaceOnnx(retina_path)
            box, pose = det.detect(img)
            result["box"] = box
            result["pose"] = pose
        except Exception as e:
            result["detectorAvailable"] = False
            result["warning"] = (result.get("warning") or "") + f"; retinaface error: {e}"

    if expression_available and box:
        try:
            clf = ExpressionClassifierOnnx(expr_path)
            result["expression"] = clf.predict(img, box)
        except Exception as e:
            result["expressionAvailable"] = False
            result["warning"] = (result.get("warning") or "") + f"; classifier error: {e}"

    print(json.dumps(result))


if __name__ == "__main__":
    main()
