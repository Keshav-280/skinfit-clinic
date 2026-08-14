"""Grid-based dark-spot detector — compares each skin tile to its neighbors in LAB.

Standalone CV module (no YOLO / DINO). Flags tiles with a sudden drop in L*
vs surrounding grids, then merges into red-circle regions for overlay.
"""
from __future__ import annotations

import base64
import json
import os
import sys
from dataclasses import dataclass
from typing import Any

import cv2
import mediapipe as mp
import numpy as np

# ── tunables (override via env) ─────────────────────────────────────
TILE_PX = int(os.getenv("TILE_PX", "18"))
NEIGHBOR_RING = int(os.getenv("NEIGHBOR_RING", "2"))
MIN_DELTA_L = float(os.getenv("MIN_DELTA_L", "11"))
MIN_DARKER_NEIGHBORS = float(os.getenv("MIN_DARKER_NEIGHBORS", "0.55"))
MIN_SKIN_FRAC = float(os.getenv("MIN_SKIN_FRAC", "0.52"))
MIN_BLOB_TILES = int(os.getenv("MIN_BLOB_TILES", "2"))
MAX_DETECTIONS = int(os.getenv("MAX_DETECTIONS", "48"))
MERGE_TILE_DIST = float(os.getenv("MERGE_TILE_DIST", "2.5"))

FACE_OVAL = [
    10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
    397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
    172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
]
LEFT_EYE = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246]
RIGHT_EYE = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398]
LEFT_BROW = [70, 63, 105, 66, 107, 55, 65, 52, 53, 46]
RIGHT_BROW = [300, 293, 334, 296, 336, 285, 295, 282, 283, 276]
LIPS = [
    61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291,
    409, 270, 269, 267, 0, 37, 39, 40, 185,
]
EXCLUDE_ZONES = [LEFT_EYE, RIGHT_EYE, LEFT_BROW, RIGHT_BROW, LIPS]
EXCLUDE_DILATE_PX = int(os.getenv("EXCLUDE_DILATE_PX", "8"))


@dataclass
class TileStat:
    row: int
    col: int
    cx: float
    cy: float
    l_mean: float
    a_mean: float
    b_mean: float
    skin_frac: float


@dataclass
class SpotBlob:
    tiles: list[TileStat]
    cx: float
    cy: float
    radius: float
    confidence: float
    delta_l: float


def decode_image(data: bytes) -> np.ndarray:
    arr = np.frombuffer(data, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_UNCHANGED)
    if img is None:
        raise ValueError("Could not decode image (use jpg/png)")
    if img.ndim == 3 and img.shape[2] == 4:
        img = cv2.cvtColor(img, cv2.COLOR_BGRA2BGR)
    return img


def build_face_mask(bgr: np.ndarray) -> tuple[np.ndarray, bool]:
    h, w = bgr.shape[:2]
    mask = np.zeros((h, w), dtype=np.uint8)
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    with mp.solutions.face_mesh.FaceMesh(
        static_image_mode=True,
        max_num_faces=1,
        refine_landmarks=True,
        min_detection_confidence=0.45,
    ) as mesh:
        res = mesh.process(rgb)
    if not res.multi_face_landmarks:
        mask[:] = 255
        return mask, False
    lm = res.multi_face_landmarks[0].landmark

    def poly(indices: list[int]) -> np.ndarray:
        return np.array(
            [(int(lm[i].x * w), int(lm[i].y * h)) for i in indices if i < len(lm)],
            dtype=np.int32,
        )

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
    return mask, True


def tile_stats_grid(
    bgr: np.ndarray, face_mask: np.ndarray
) -> tuple[list[list[TileStat | None]], int, int]:
    h, w = bgr.shape[:2]
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
    n_rows = max(1, int(np.ceil(h / TILE_PX)))
    n_cols = max(1, int(np.ceil(w / TILE_PX)))
    grid: list[list[TileStat | None]] = [[None] * n_cols for _ in range(n_rows)]

    for r in range(n_rows):
        y0 = r * TILE_PX
        y1 = min(h, (r + 1) * TILE_PX)
        for c in range(n_cols):
            x0 = c * TILE_PX
            x1 = min(w, (c + 1) * TILE_PX)
            m = face_mask[y0:y1, x0:x1]
            area = m.size
            if area < 4:
                continue
            skin = int(np.count_nonzero(m))
            skin_frac = skin / area
            if skin_frac < MIN_SKIN_FRAC:
                continue
            patch = lab[y0:y1, x0:x1]
            skin_mask = m > 0
            l_vals = patch[:, :, 0][skin_mask]
            a_vals = patch[:, :, 1][skin_mask]
            b_vals = patch[:, :, 2][skin_mask]
            if l_vals.size < 3:
                continue
            grid[r][c] = TileStat(
                row=r,
                col=c,
                cx=(x0 + x1) / 2,
                cy=(y0 + y1) / 2,
                l_mean=float(np.mean(l_vals)),
                a_mean=float(np.mean(a_vals)),
                b_mean=float(np.mean(b_vals)),
                skin_frac=skin_frac,
            )
    return grid, n_rows, n_cols


def neighbor_tiles(
    grid: list[list[TileStat | None]], r: int, c: int, ring: int
) -> list[TileStat]:
    out: list[TileStat] = []
    n_rows, n_cols = len(grid), len(grid[0])
    for dr in range(-ring, ring + 1):
        for dc in range(-ring, ring + 1):
            if dr == 0 and dc == 0:
                continue
            nr, nc = r + dr, c + dc
            if 0 <= nr < n_rows and 0 <= nc < n_cols:
                t = grid[nr][nc]
                if t is not None:
                    out.append(t)
    return out


def is_sudden_dark_tile(tile: TileStat, neighbors: list[TileStat]) -> tuple[bool, float]:
    if len(neighbors) < 4:
        return False, 0.0
    n_l = np.array([n.l_mean for n in neighbors], dtype=np.float64)
    n_a = np.array([n.a_mean for n in neighbors], dtype=np.float64)
    n_b = np.array([n.b_mean for n in neighbors], dtype=np.float64)

    baseline_l = float(np.median(n_l))
    delta_l = baseline_l - tile.l_mean
    if delta_l < MIN_DELTA_L:
        return False, delta_l

    # Must be darker than most neighbors (sudden local drop, not smooth gradient).
    darker_count = int(np.sum(tile.l_mean < n_l - 4))
    if darker_count < max(3, int(len(neighbors) * MIN_DARKER_NEIGHBORS)):
        return False, delta_l

    # Brown / hyperpigment: slightly elevated b* vs neighbors (OpenCV LAB b channel).
    baseline_b = float(np.median(n_b))
    b_dev = tile.b_mean - baseline_b
    # Reject flat gray shadows (low chroma change) unless very dark.
    a_dev = tile.a_mean - float(np.median(n_a))
    chroma_dev = float(np.hypot(a_dev, b_dev))
    if delta_l < MIN_DELTA_L + 4 and chroma_dev < 2.5:
        return False, delta_l

    # Accept strong darkness OR brownish shift.
    brownish = b_dev > -2 or a_dev > 1
    if not brownish and delta_l < MIN_DELTA_L + 5:
        return False, delta_l

    return True, delta_l


def find_dark_tiles(
    grid: list[list[TileStat | None]],
) -> list[tuple[TileStat, float]]:
    flagged: list[tuple[TileStat, float]] = []
    n_rows, n_cols = len(grid), len(grid[0])
    for r in range(n_rows):
        for c in range(n_cols):
            tile = grid[r][c]
            if tile is None:
                continue
            neighbors = neighbor_tiles(grid, r, c, NEIGHBOR_RING)
            ok, delta_l = is_sudden_dark_tile(tile, neighbors)
            if ok:
                flagged.append((tile, delta_l))
    return flagged


def cluster_tiles(flagged: list[tuple[TileStat, float]]) -> list[SpotBlob]:
    if not flagged:
        return []
    used = [False] * len(flagged)
    blobs: list[SpotBlob] = []

    for i, (seed, seed_dl) in enumerate(flagged):
        if used[i]:
            continue
        used[i] = True
        cluster_tiles: list[TileStat] = [seed]
        cluster_dl = [seed_dl]
        stack = [i]
        while stack:
            idx = stack.pop()
            base = flagged[idx][0]
            for j, (other, odl) in enumerate(flagged):
                if used[j]:
                    continue
                dist = np.hypot(base.cx - other.cx, base.cy - other.cy) / TILE_PX
                if dist <= MERGE_TILE_DIST:
                    used[j] = True
                    cluster_tiles.append(other)
                    cluster_dl.append(odl)
                    stack.append(j)
        if len(cluster_tiles) < MIN_BLOB_TILES:
            continue
        cx = float(np.mean([t.cx for t in cluster_tiles]))
        cy = float(np.mean([t.cy for t in cluster_tiles]))
        dists = [float(np.hypot(t.cx - cx, t.cy - cy)) for t in cluster_tiles]
        radius = max(float(np.max(dists)) + TILE_PX * 0.65, TILE_PX * 0.85)
        mean_dl = float(np.mean(cluster_dl))
        conf = float(np.clip(0.45 + mean_dl / 40.0, 0.45, 0.98))
        blobs.append(
            SpotBlob(
                tiles=cluster_tiles,
                cx=cx,
                cy=cy,
                radius=radius,
                confidence=conf,
                delta_l=mean_dl,
            )
        )

    blobs.sort(key=lambda b: (-b.confidence, -b.delta_l))
    return blobs[:MAX_DETECTIONS]


def blobs_to_regions(blobs: list[SpotBlob], w: int, h: int) -> list[dict[str, Any]]:
    max_dim = max(w, h) or 1
    out: list[dict[str, Any]] = []
    for i, b in enumerate(blobs):
        cx_pct = round(b.cx / w * 100, 2)
        cy_pct = round(b.cy / h * 100, 2)
        r_pct = round(b.radius / max_dim * 100, 2)
        x1 = max(0.0, b.cx - b.radius)
        y1 = max(0.0, b.cy - b.radius)
        x2 = min(float(w), b.cx + b.radius)
        y2 = min(float(h), b.cy + b.radius)
        out.append(
            {
                "class": "dark_spot",
                "display_class": "pigmentation",
                "confidence": round(b.confidence, 4),
                "center_pct": [cx_pct, cy_pct],
                "radius_pct": r_pct,
                "bbox_pct": [
                    round(x1 / w * 100, 2),
                    round(y1 / h * 100, 2),
                    round(x2 / w * 100, 2),
                    round(y2 / h * 100, 2),
                ],
                "delta_l": round(b.delta_l, 2),
                "tile_count": len(b.tiles),
            }
        )
    return out


def render_annotated_jpeg_base64(
    bgr: np.ndarray, blobs: list[SpotBlob], max_side: int = 1400
) -> str:
    vis = bgr.copy()
    for b in blobs:
        center = (int(round(b.cx)), int(round(b.cy)))
        radius = max(4, int(round(b.radius)))
        cv2.circle(vis, center, radius, (0, 0, 255), 2, lineType=cv2.LINE_AA)
        cv2.circle(vis, center, 2, (0, 0, 255), -1, lineType=cv2.LINE_AA)

    hh, ww = vis.shape[:2]
    if max(hh, ww) > max_side:
        s = max_side / max(hh, ww)
        vis = cv2.resize(vis, (int(ww * s), int(hh * s)), interpolation=cv2.INTER_AREA)

    ok, buf = cv2.imencode(".jpg", vis, [int(cv2.IMWRITE_JPEG_QUALITY), 92])
    if not ok:
        raise RuntimeError("Failed to encode annotated image")
    return base64.b64encode(buf.tobytes()).decode("ascii")


def analyze_dark_spots(bgr: np.ndarray, *, include_image: bool = True) -> dict[str, Any]:
    face_mask, mp_ok = build_face_mask(bgr)
    grid, n_rows, n_cols = tile_stats_grid(bgr, face_mask)
    flagged = find_dark_tiles(grid)
    blobs = cluster_tiles(flagged)
    h, w = bgr.shape[:2]

    result: dict[str, Any] = {
        "spot_count": len(blobs),
        "detection_regions": blobs_to_regions(blobs, w, h),
        "meta": {
            "image_size": [w, h],
            "face_mesh_ok": mp_ok,
            "grid_tiles": [n_rows, n_cols],
            "tile_px": TILE_PX,
            "neighbor_ring": NEIGHBOR_RING,
            "flagged_tiles": len(flagged),
            "config": {
                "min_delta_l": MIN_DELTA_L,
                "min_skin_frac": MIN_SKIN_FRAC,
                "min_blob_tiles": MIN_BLOB_TILES,
            },
        },
    }
    if include_image:
        result["annotated_image_jpeg_base64"] = render_annotated_jpeg_base64(
            bgr, blobs
        )
    return result


def main() -> int:
    """CLI: read base64 jpeg from stdin JSON, write JSON result to stdout."""
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
    except Exception as e:
        print(json.dumps({"ok": False, "error": f"invalid_json: {e}"}))
        return 0

    source_b64 = payload.get("source_b64")
    if not isinstance(source_b64, str):
        print(json.dumps({"ok": False, "error": "source_b64 required"}))
        return 0

    try:
        data = base64.b64decode(source_b64)
        bgr = decode_image(data)
        out = analyze_dark_spots(bgr, include_image=True)
        print(json.dumps({"ok": True, **out}))
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e)}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
