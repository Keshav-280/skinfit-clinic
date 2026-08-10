"""Tiled YOLO + MediaPipe face mask + doctor grading (API-ready, no matplotlib).
"""
from __future__ import annotations

import os
from collections import Counter
from dataclasses import dataclass
from typing import Any

import cv2
import mediapipe as mp
import numpy as np

# ── defaults (override via env in main.py) ──────────────────────────
GRID = tuple(int(x) for x in os.getenv("GRID", "4,4").split(","))
OVERLAP = float(os.getenv("OVERLAP", "0.25"))
CONF = float(os.getenv("CONF", "0.3"))
IMGSZ = int(os.getenv("IMGSZ", "896"))
MERGE_IOU = float(os.getenv("MERGE_IOU", "0.45"))
MIN_FACE_OVERLAP = float(os.getenv("MIN_FACE_OVERLAP", "0.35"))

FACE_OVAL = [
    10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
    397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
    172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
]

# Non-skin regions cut out of the face mask. YOLO reliably fires on brow hair,
# eyelid/lash shadow and lip edges; those are never acne.
LEFT_EYE = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246]
RIGHT_EYE = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398]
LEFT_BROW = [70, 63, 105, 66, 107, 55, 65, 52, 53, 46]
RIGHT_BROW = [300, 293, 334, 296, 336, 285, 295, 282, 283, 276]
LIPS = [
    61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291,
    409, 270, 269, 267, 0, 37, 39, 40, 185,
]
EXCLUDE_ZONES = [LEFT_EYE, RIGHT_EYE, LEFT_BROW, RIGHT_BROW, LIPS]
# Dilate cut-outs so lashes/brow edges just outside the landmark ring are covered.
EXCLUDE_DILATE_PX = int(os.getenv("EXCLUDE_DILATE_PX", "6"))

EXCLUDED = {"dark spot"}
COMEDONAL = "blackheads+whiteheads"
COMEDONAL_PARTS = {"blackheads", "whiteheads"}
ACTIVE_PARTS = COMEDONAL_PARTS | {"papules", "pustules", "nodules"}

F2_SEV = {COMEDONAL: 2, "papules": 3, "pustules": 4, "nodules": 5}
NUM_G = {1: "A", 2: "B", 3: "C", 4: "D", 5: "E"}

CLASS_COLORS_BGR = {
    "blackheads": (51, 51, 255),
    "whiteheads": (0, 170, 255),
    "papules": (51, 255, 51),
    "pustules": (255, 51, 255),
    "nodules": (255, 51, 51),
}


def det_color_bgr(name: str) -> tuple[int, int, int]:
    if name in COMEDONAL_PARTS:
        return (0, 110, 255)
    return CLASS_COLORS_BGR.get(name, (255, 255, 255))


@dataclass
class Det:
    name: str
    conf: float
    x1: float
    y1: float
    x2: float
    y2: float

    def to_dict(self) -> dict[str, Any]:
        w, h = self.x2 - self.x1, self.y2 - self.y1
        return {
            "class": self.name,
            "display_class": COMEDONAL if self.name in COMEDONAL_PARTS else self.name,
            "confidence": round(self.conf, 4),
            "bbox": [round(self.x1, 1), round(self.y1, 1), round(self.x2, 1), round(self.y2, 1)],
            "center": [round((self.x1 + self.x2) / 2, 1), round((self.y1 + self.y2) / 2, 1)],
            "size_px": [round(w, 1), round(h, 1)],
        }


def is_active(name: str) -> bool:
    return name not in EXCLUDED and name in ACTIVE_PARTS


def normalize_counts(by_class: dict[str, int]) -> dict[str, int]:
    out: dict[str, int] = {}
    comed = 0
    for k, v in by_class.items():
        if k in EXCLUDED or v <= 0:
            continue
        if k in COMEDONAL_PARTS:
            comed += v
        else:
            out[k] = out.get(k, 0) + v
    if comed > 0:
        out[COMEDONAL] = comed
    return out


def decode_image(data: bytes) -> np.ndarray:
    arr = np.frombuffer(data, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_UNCHANGED)
    if img is None:
        raise ValueError("Could not decode image (use jpg/png)")
    if img.ndim == 3 and img.shape[2] == 4:
        img = cv2.cvtColor(img, cv2.COLOR_BGRA2BGR)
    return img


def build_face_mask(bgr: np.ndarray) -> tuple[np.ndarray, int, bool]:
    h, w = bgr.shape[:2]
    mask = np.zeros((h, w), dtype=np.uint8)
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    with mp.solutions.face_mesh.FaceMesh(
        static_image_mode=True,
        max_num_faces=1,
        refine_landmarks=True,
        min_detection_confidence=0.5,
    ) as mesh:
        res = mesh.process(rgb)
    if not res.multi_face_landmarks:
        mask[:] = 255
        return mask, h * w, False
    lm = res.multi_face_landmarks[0].landmark

    def poly(indices: list[int]) -> np.ndarray:
        return np.array(
            [(int(lm[i].x * w), int(lm[i].y * h)) for i in indices if i < len(lm)],
            dtype=np.int32,
        )

    # fillPoly (not fillConvexPoly): the face oval is concave around the jaw and
    # temples, and a convex hull spills into hair, ears and neck.
    cv2.fillPoly(mask, [poly(FACE_OVAL)], 255)

    cut = np.zeros((h, w), dtype=np.uint8)
    for zone in EXCLUDE_ZONES:
        pts = poly(zone)
        if pts.shape[0] >= 3:
            cv2.fillPoly(cut, [pts], 255)
    if EXCLUDE_DILATE_PX > 0:
        k = 2 * EXCLUDE_DILATE_PX + 1
        cut = cv2.dilate(cut, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))
    mask[cut > 0] = 0

    return mask, int(cv2.countNonZero(mask)), True


def bbox_mask_overlap(d: Det, mask: np.ndarray) -> float:
    h, w = mask.shape
    x1, y1 = max(0, int(d.x1)), max(0, int(d.y1))
    x2, y2 = min(w, int(d.x2)), min(h, int(d.y2))
    if x2 <= x1 or y2 <= y1:
        return 0.0
    patch = mask[y1:y2, x1:x2]
    return float(np.count_nonzero(patch)) / ((x2 - x1) * (y2 - y1))


def bbox_mask_area(d: Det, mask: np.ndarray) -> int:
    h, w = mask.shape
    x1, y1 = max(0, int(d.x1)), max(0, int(d.y1))
    x2, y2 = min(w, int(d.x2)), min(h, int(d.y2))
    if x2 <= x1 or y2 <= y1:
        return 0
    return int(np.count_nonzero(mask[y1:y2, x1:x2]))


def filter_by_face_mask(dets: list[Det], mask: np.ndarray) -> tuple[list[Det], list[dict]]:
    kept, dropped = [], []
    for d in dets:
        ov = bbox_mask_overlap(d, mask)
        if ov >= MIN_FACE_OVERLAP:
            kept.append(d)
        else:
            dropped.append({**d.to_dict(), "face_overlap": round(ov, 3)})
    return kept, dropped


def grade_f1(n: int) -> tuple[str, int]:
    if n == 0:
        return "A", 1
    if n <= 2:
        return "B", 2
    if n <= 9:
        return "C", 3
    if n <= 20:
        return "D", 4
    return "E", 5


def grade_f2(by: dict[str, int]) -> tuple[str, int, str]:
    by = normalize_counts(by)
    if not by:
        return "A", 1, "none"
    w = max(by.keys(), key=lambda c: F2_SEV[c])
    return NUM_G[F2_SEV[w]], F2_SEV[w], w


def grade_f3(pct: float) -> tuple[str, int]:
    if pct <= 0:
        return "A", 1
    if pct < 5:
        return "B", 2
    if pct <= 15:
        return "C", 3
    if pct <= 30:
        return "D", 4
    return "E", 5


def to_letter(s: float) -> str:
    if s <= 1.5:
        return "A"
    if s <= 2.5:
        return "B"
    if s <= 3.5:
        return "C"
    if s <= 4.5:
        return "D"
    return "E"


def compute_grade(by_class: dict[str, int], dets: list[Det], face_mask_area: int, mask: np.ndarray) -> dict:
    by_class = normalize_counts(by_class)
    active_n = sum(by_class.values())
    lesion_area = sum(bbox_mask_area(d, mask) for d in dets if is_active(d.name))
    pct = min(100.0, lesion_area / face_mask_area * 100) if face_mask_area else 0.0

    f1_l, f1_n = grade_f1(active_n)
    f2_l, f2_n, worst = grade_f2(by_class)
    f3_l, f3_n = grade_f3(pct)

    def weighted(w1: float, w2: float, w3: float) -> dict[str, Any]:
        raw = w1 * f1_n + w2 * f2_n + w3 * f3_n
        score = raw
        capped = False
        if f2_n == 5 and score < 4.0:
            score = 4.0
            capped = True
        w1_pct, w2_pct, w3_pct = int(w1 * 100), int(w2 * 100), int(w3 * 100)
        return {
            "final_grade": to_letter(score),
            "score": round(score, 2),
            "formula": f"0.{w1_pct:02d}×{f1_n} + 0.{w2_pct:02d}×{f2_n} + 0.{w3_pct:02d}×{f3_n} = {round(score, 2)}",
            "weights": {"f1": w1, "f2": w2, "f3": w3},
            "nodule_cap_applied": capped,
        }

    doctor = weighted(0.40, 0.35, 0.25)
    area_score = weighted(0.30, 0.30, 0.40)

    return {
        "final_grade": doctor["final_grade"],
        "score": doctor["score"],
        "f1": {"letter": f1_l, "numeric": f1_n, "active_lesion_count": active_n},
        "f2": {"letter": f2_l, "numeric": f2_n, "worst_type": worst},
        "f3": {"letter": f3_l, "numeric": f3_n, "area_percent": round(pct, 1)},
        "lesion_area_px": lesion_area,
        "face_mask_px": face_mask_area,
        "counts": by_class,
        "formula": doctor["formula"],
        "weights": doctor["weights"],
        "nodule_cap_applied": doctor["nodule_cap_applied"],
        "grade_alt": {
            **area_score,
            "label": "Area-weighted score",
        },
    }


def make_tiles(img: np.ndarray, grid: tuple[int, int] = GRID, overlap: float = OVERLAP):
    h, w = img.shape[:2]
    rows, cols = grid
    th, tw = h / rows, w / cols
    sy, sx = th * (1 - overlap), tw * (1 - overlap)
    tiles, y = [], 0.0
    while y < h:
        y1, y2 = int(y), int(min(h, y + th))
        if y2 - y1 < 16:
            break
        x = 0.0
        while x < w:
            x1, x2 = int(x), int(min(w, x + tw))
            if x2 - x1 < 16:
                break
            tiles.append((img[y1:y2, x1:x2].copy(), x1, y1))
            x += sx
            if x2 >= w:
                break
        y += sy
        if y2 >= h:
            break
    return tiles


def iou(a: Det, b: Det) -> float:
    ix1, iy1 = max(a.x1, b.x1), max(a.y1, b.y1)
    ix2, iy2 = min(a.x2, b.x2), min(a.y2, b.y2)
    inter = max(0, ix2 - ix1) * max(0, iy2 - iy1)
    if inter <= 0:
        return 0.0
    ua = (a.x2 - a.x1) * (a.y2 - a.y1) + (b.x2 - b.x1) * (b.y2 - b.y1) - inter
    return inter / (ua + 1e-6)


def merge_overlapping(dets: list[Det], iou_thresh: float = MERGE_IOU) -> list[Det]:
    if not dets:
        return []
    parent = list(range(len(dets)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    def union(i, j):
        ri, rj = find(i), find(j)
        if ri != rj:
            parent[rj] = ri

    for i in range(len(dets)):
        for j in range(i + 1, len(dets)):
            if dets[i].name == dets[j].name and iou(dets[i], dets[j]) >= iou_thresh:
                union(i, j)

    clusters: dict[int, list[Det]] = {}
    for i, d in enumerate(dets):
        clusters.setdefault(find(i), []).append(d)

    merged = []
    for group in clusters.values():
        merged.append(
            Det(
                group[0].name,
                max(g.conf for g in group),
                min(g.x1 for g in group),
                min(g.y1 for g in group),
                max(g.x2 for g in group),
                max(g.y2 for g in group),
            )
        )
    return merged


def render_annotated_jpeg_base64(bgr: np.ndarray, dets_active: list[Det], max_side: int = 1400) -> str:
    """Draw active lesion boxes; return base64 JPEG for the web UI."""
    import base64

    vis = bgr.copy()
    for d in dets_active:
        color = (0, 0, 255) # Pure red in BGR
        x1, y1, x2, y2 = int(d.x1), int(d.y1), int(d.x2), int(d.y2)
        cv2.rectangle(vis, (x1, y1), (x2, y2), color, 1) # Thinner boxes (thickness 1)

    h, w = vis.shape[:2]
    if max(h, w) > max_side:
        s = max_side / max(h, w)
        vis = cv2.resize(vis, (int(w * s), int(h * s)), interpolation=cv2.INTER_AREA)

    ok, buf = cv2.imencode(".jpg", vis, [int(cv2.IMWRITE_JPEG_QUALITY), 90])
    if not ok:
        raise RuntimeError("Failed to encode annotated image")
    return base64.b64encode(buf.tobytes()).decode("ascii")


def analyze_face(model, bgr: np.ndarray, *, include_image: bool = True) -> dict[str, Any]:
    """Run full pipeline on a BGR numpy image. Model is ultralytics YOLO (loaded once)."""
    face_mask, face_mask_area, mp_ok = build_face_mask(bgr)

    raw: list[Det] = []
    tiles = make_tiles(bgr)
    for tile, ox, oy in tiles:
        res = model.predict(tile, imgsz=IMGSZ, conf=CONF, verbose=False)[0]
        for box in res.boxes:
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            raw.append(
                Det(
                    res.names[int(box.cls)],
                    float(box.conf),
                    x1 + ox,
                    y1 + oy,
                    x2 + ox,
                    y2 + oy,
                )
            )

    dets_merged = merge_overlapping(raw)
    dets_face, dropped_face = filter_by_face_mask(dets_merged, face_mask)
    dets_active = [d for d in dets_face if is_active(d.name)]
    dets_excluded = [d for d in dets_face if not is_active(d.name)]

    by_class = normalize_counts(dict(Counter(d.name for d in dets_active)))
    grade = compute_grade(by_class, dets_active, face_mask_area, face_mask)

    result: dict[str, Any] = {
        "grade": grade,
        "detections": {
            "active": [d.to_dict() for d in sorted(dets_active, key=lambda x: -x.conf)],
            "excluded_on_face": [d.to_dict() for d in dets_excluded],
            "dropped_out_of_face": dropped_face,
        },
        "meta": {
            "image_size": [bgr.shape[1], bgr.shape[0]],
            "face_mesh_ok": mp_ok,
            "face_mask_px": face_mask_area,
            "face_mask_percent": round(face_mask_area / (bgr.shape[0] * bgr.shape[1]) * 100, 1),
            "num_tiles": len(tiles),
            "raw_detections": len(raw),
            "merged_detections": len(dets_merged),
            "config": {
                "grid": list(GRID),
                "overlap": OVERLAP,
                "conf": CONF,
                "imgsz": IMGSZ,
                "merge_iou": MERGE_IOU,
            },
        },
    }
    h_img, w_img = int(bgr.shape[0]), int(bgr.shape[1])
    max_dim = max(h_img, w_img) or 1
    # Drawn markers are held to a higher bar than grading: a 0.3-confidence hit is
    # useful signal in aggregate but reads as a false positive when circled on a
    # patient's face. Grade still counts every detection above CONF.
    REGION_CONF_MIN = float(os.getenv("REGION_CONF_MIN", "0.5"))
    # Without landmarks the mask is the whole frame, so detections on hair,
    # clothing and background would be drawn as lesions. Grade keeps them.
    region_source = dets_active if mp_ok else []
    result["detection_regions"] = [
        {
            "class": d.name,
            "display_class": "comedonal" if d.name in COMEDONAL_PARTS else d.name,
            "confidence": round(d.conf, 4),
            "center_pct": [
                round(((d.x1 + d.x2) / 2) / w_img * 100, 2),
                round(((d.y1 + d.y2) / 2) / h_img * 100, 2),
            ],
            "radius_pct": round(
                max(d.x2 - d.x1, d.y2 - d.y1) / 2 / max_dim * 100, 2
            ),
            "bbox_pct": [
                round(d.x1 / w_img * 100, 2),
                round(d.y1 / h_img * 100, 2),
                round(d.x2 / w_img * 100, 2),
                round(d.y2 / h_img * 100, 2),
            ],
        }
        for d in region_source
        if d.conf >= REGION_CONF_MIN
    ]

    if include_image:
        result["annotated_image_jpeg_base64"] = render_annotated_jpeg_base64(bgr, dets_active)
    return result
