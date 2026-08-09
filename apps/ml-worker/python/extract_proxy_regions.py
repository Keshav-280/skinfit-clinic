#!/usr/bin/env python3
"""
Landmark + DINOv2-attention proxy spatial regions for parameters without
pixel-level detectors (pigmentation, acne scars, under-eye, sagging).

Input (stdin JSON):
  {
    "source_b64": "<jpeg>",
    "scores": {
      "pigmentation": 1-5,
      "acne_scars": 1-5,
      "under_eye": 1-5,
      "sagging_volume": 1-5
    },
    # Optional: precomputed 16x16 (or flat 256) L2 / attention map from the
    # scoring backbone — preferred so we do not load DINOv2 twice.
    "patch_activations": [[...16...], ...] | [...256...]
  }

Output (stdout JSON):
  { "ok": true, "proxy_regions": [ ... ], "attention_used": bool }
  or { "ok": false, "error": "..." }

Gating:
  score 1     → never emit
  score 2     → only if patch attention confirms the zone
  score 3–5   → emit zones that beat face-wide activation * 1.2
  max 8 regions total; diffuse full-face fallback when 3+ but no zone passes
"""

from __future__ import annotations

import base64
import json
import os
import sys
from pathlib import Path
from typing import Any

import cv2
import numpy as np

try:
    import mediapipe as mp
except ImportError:
    mp = None  # type: ignore


# ── landmark zones ──────────────────────────────────────────────────
PIGMENT_LEFT_CHEEK = [234, 93, 132, 58, 172, 136, 150, 149, 176, 148, 152]
PIGMENT_RIGHT_CHEEK = [454, 323, 361, 288, 397, 365, 379, 378, 400, 377]
PIGMENT_FOREHEAD = [10, 338, 297, 332, 284, 251, 21, 54, 103, 67, 109]

SCAR_LEFT_CHEEK = [234, 93, 132, 58, 172]
SCAR_RIGHT_CHEEK = [454, 323, 361, 288, 397]
SCAR_JAW = [152, 148, 176, 149, 150, 136, 172, 58]

UNDER_EYE_LEFT = [33, 7, 163, 144, 145, 153, 154, 155, 133]
UNDER_EYE_RIGHT = [362, 382, 381, 380, 374, 373, 390, 249, 263]

SAG_LEFT_NASOLABIAL = [36, 205, 206, 207, 187]
SAG_RIGHT_NASOLABIAL = [266, 425, 426, 427, 411]
SAG_JAWLINE = [
    132, 58, 172, 136, 150, 149, 176, 148, 152,
    377, 400, 378, 379, 365, 397, 288, 361, 323,
]

FACE_OVAL = [
    10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
    397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
    172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
]

GRID = 16
INPUT_SIZE = 224
PATCH = INPUT_SIZE // GRID  # 14
MAX_PROXY_REGIONS = 8
ZONE_VS_FACE_RATIO = 1.2
LANDMARK_CONF_MIN = 0.7
TOP_K_PATCHES = 5
ATTN_BLEND = 0.55  # weight toward attention centroid vs landmark centroid

# Conservative opacity by severity (frontend may use this directly)
OPACITY_BY_SCORE = {2: 0.35, 3: 0.55, 4: 0.75, 5: 0.90}
DIFFUSE_OPACITY = 0.3


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
        # Stricter gate: unreliable landmarking → empty proxy regions.
        min_detection_confidence=0.7,
    )


def decode_jpeg_b64(data: str) -> np.ndarray | None:
    try:
        raw = base64.b64decode(data)
    except Exception:
        return None
    arr = np.frombuffer(raw, dtype=np.uint8)
    return cv2.imdecode(arr, cv2.IMREAD_COLOR)


def clamp_score(v: Any) -> float | None:
    try:
        n = float(v)
    except (TypeError, ValueError):
        return None
    if not np.isfinite(n):
        return None
    return max(1.0, min(5.0, n))


def score_int(score: float) -> int:
    return int(max(1, min(5, round(score))))


def opacity_for_score(score: float, *, diffuse: bool = False) -> float:
    if diffuse:
        return DIFFUSE_OPACITY
    return float(OPACITY_BY_SCORE.get(score_int(score), 0.55))


def score_scale(score: float) -> float:
    return 0.8 + score * 0.1


def pts_from_indices(landmarks: Any, indices: list[int], w: int, h: int) -> np.ndarray:
    pts = []
    for idx in indices:
        if idx < 0 or idx >= len(landmarks):
            continue
        lm = landmarks[idx]
        pts.append([float(lm.x) * w, float(lm.y) * h])
    return np.array(pts, dtype=np.float64) if pts else np.zeros((0, 2), dtype=np.float64)


def zone_landmark_confidence(landmarks: Any, indices: list[int]) -> float:
    """Mean MediaPipe visibility/presence; 1.0 if fields unavailable."""
    vals: list[float] = []
    for idx in indices:
        if idx < 0 or idx >= len(landmarks):
            continue
        lm = landmarks[idx]
        v = getattr(lm, "visibility", None)
        p = getattr(lm, "presence", None)
        if v is not None and np.isfinite(float(v)):
            vals.append(float(v))
        elif p is not None and np.isfinite(float(p)):
            vals.append(float(p))
    if not vals:
        return 1.0
    return float(np.mean(vals))


def parse_patch_activations(raw: Any) -> np.ndarray | None:
    """Accept 16x16 nested list, flat 256, or numpy-like list → (16,16) float."""
    if raw is None:
        return None
    try:
        arr = np.asarray(raw, dtype=np.float64)
    except Exception:
        return None
    if arr.size == GRID * GRID:
        return arr.reshape(GRID, GRID)
    if arr.ndim == 2 and arr.shape == (GRID, GRID):
        return arr.astype(np.float64)
    return None


def compute_dino_patch_l2(source_bgr: np.ndarray) -> np.ndarray | None:
    """
    Optional local DINOv2 forward → per-patch L2 norm (16x16).
    Soft-fail if torch/weights unavailable. Prefer passing patch_activations
    from the scoring run to avoid loading the backbone twice.
    """
    enable = os.environ.get("PROXY_USE_DINO", "").strip().lower() in (
        "1",
        "true",
        "yes",
    )
    weights = os.environ.get("DINO_LOCAL_WEIGHTS", "").strip()
    if not enable and not (weights and Path(weights).is_file()):
        return None

    try:
        import torch
        from torchvision import transforms as T
    except ImportError:
        return None

    try:
        # Import sibling backbone_offline when running from ml-worker/python
        here = Path(__file__).resolve().parent
        if str(here) not in sys.path:
            sys.path.insert(0, str(here))
        from backbone_offline import DINOBackbone  # type: ignore
    except Exception:
        return None

    try:
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        backbone = DINOBackbone(
            os.environ.get("DINO_MODEL_NAME", "dinov2_vitl14_reg").strip()
            or "dinov2_vitl14_reg"
        )
        backbone.eval()
        backbone.to(device)

        rgb = cv2.cvtColor(source_bgr, cv2.COLOR_BGR2RGB)
        pil_t = T.Compose(
            [
                T.ToPILImage(),
                T.Resize((INPUT_SIZE, INPUT_SIZE)),
                T.ToTensor(),
                T.Normalize(
                    mean=(0.485, 0.456, 0.406),
                    std=(0.229, 0.224, 0.225),
                ),
            ]
        )
        x = pil_t(rgb).unsqueeze(0).to(device)
        with torch.no_grad():
            tokens = backbone(x)  # (1, N, D)
        tokens = tokens[0].detach().float().cpu().numpy()  # (N, D)
        # dinov2_vitl14_reg may include register tokens; take last 256 as patches
        if tokens.shape[0] >= GRID * GRID:
            tokens = tokens[-GRID * GRID :]
        elif tokens.shape[0] != GRID * GRID:
            return None
        norms = np.linalg.norm(tokens, axis=1).reshape(GRID, GRID)
        return norms.astype(np.float64)
    except Exception:
        return None


def image_to_patch_rc(x: float, y: float, w: int, h: int) -> tuple[int, int]:
    """Map image pixel → patch row/col on the 224-normalized grid."""
    if w < 1 or h < 1:
        return 0, 0
    px = (x / w) * INPUT_SIZE
    py = (y / h) * INPUT_SIZE
    c = int(np.clip(px // PATCH, 0, GRID - 1))
    r = int(np.clip(py // PATCH, 0, GRID - 1))
    return r, c


def patch_center_xy(r: int, c: int, w: int, h: int) -> tuple[float, float]:
    """Center of patch (r,c) in original image pixels."""
    cx224 = (c + 0.5) * PATCH
    cy224 = (r + 0.5) * PATCH
    return (cx224 / INPUT_SIZE) * w, (cy224 / INPUT_SIZE) * h


def patches_in_bbox(
    x0: float, y0: float, x1: float, y1: float, w: int, h: int
) -> list[tuple[int, int]]:
    r0, c0 = image_to_patch_rc(x0, y0, w, h)
    r1, c1 = image_to_patch_rc(x1, y1, w, h)
    rr0, rr1 = min(r0, r1), max(r0, r1)
    cc0, cc1 = min(c0, c1), max(c0, c1)
    return [(r, c) for r in range(rr0, rr1 + 1) for c in range(cc0, cc1 + 1)]


def face_patch_mask(landmarks: Any, w: int, h: int) -> np.ndarray:
    """Boolean (16,16): patches whose centers lie inside the face oval hull."""
    pts = pts_from_indices(landmarks, FACE_OVAL, w, h)
    mask = np.zeros((GRID, GRID), dtype=bool)
    if pts.shape[0] < 3:
        mask[:] = True
        return mask
    hull = cv2.convexHull(pts.astype(np.float32))
    for r in range(GRID):
        for c in range(GRID):
            x, y = patch_center_xy(r, c, w, h)
            inside = cv2.pointPolygonTest(hull, (float(x), float(y)), False)
            mask[r, c] = inside >= 0
    if not mask.any():
        mask[:] = True
    return mask


def zone_bbox(pts: np.ndarray) -> tuple[float, float, float, float] | None:
    if pts.shape[0] < 1:
        return None
    pad_x = max(float(np.std(pts[:, 0])) * 0.35, 4.0) if pts.shape[0] > 1 else 8.0
    pad_y = max(float(np.std(pts[:, 1])) * 0.35, 4.0) if pts.shape[0] > 1 else 8.0
    return (
        float(pts[:, 0].min()) - pad_x,
        float(pts[:, 1].min()) - pad_y,
        float(pts[:, 0].max()) + pad_x,
        float(pts[:, 1].max()) + pad_y,
    )


def zone_activation_stats(
    activations: np.ndarray | None,
    face_mask: np.ndarray,
    pts: np.ndarray,
    w: int,
    h: int,
) -> dict[str, Any] | None:
    if activations is None:
        return None
    bb = zone_bbox(pts)
    if bb is None:
        return None
    patches = patches_in_bbox(*bb, w, h)
    if not patches:
        return None
    zone_vals = np.array(
        [activations[r, c] for r, c in patches], dtype=np.float64
    )
    face_vals = activations[face_mask]
    if face_vals.size == 0:
        face_vals = activations.ravel()
    face_mean = float(np.mean(face_vals))
    zone_mean = float(np.mean(zone_vals))
    zone_max = float(np.max(zone_vals))
    p60 = float(np.percentile(face_vals, 60))
    # Top-K patches within zone
    order = np.argsort(-zone_vals)[:TOP_K_PATCHES]
    top_coords = [patches[int(i)] for i in order]
    top_xy = np.array(
        [patch_center_xy(r, c, w, h) for r, c in top_coords], dtype=np.float64
    )
    return {
        "zone_mean": zone_mean,
        "zone_max": zone_max,
        "face_mean": face_mean,
        "p60": p60,
        "top_xy": top_xy,
        "passes_vs_face": zone_mean >= face_mean * ZONE_VS_FACE_RATIO,
        "passes_score2": zone_max >= p60,
    }


def zone_allowed(
    score: float,
    stats: dict[str, Any] | None,
) -> bool:
    """Strict gating: score 1 never; score 2 needs attention; no-attn needs ≥3.5."""
    if score <= 1:
        return False
    if stats is None:
        # No DINOv2 map: require clearer severity so mild issues don't look like FPs.
        return score >= 3.5
    if not stats["passes_vs_face"]:
        return False
    if score < 3:
        return bool(stats["passes_score2"])
    return True


def face_oval_confidence(landmarks: Any) -> float:
    """Mean visibility/presence over face oval; 1.0 if fields unavailable."""
    return zone_landmark_confidence(landmarks, FACE_OVAL)


def blend_center(
    landmark_cx: float,
    landmark_cy: float,
    stats: dict[str, Any] | None,
) -> tuple[float, float]:
    if stats is None or stats["top_xy"].shape[0] == 0:
        return landmark_cx, landmark_cy
    ax = float(np.mean(stats["top_xy"][:, 0]))
    ay = float(np.mean(stats["top_xy"][:, 1]))
    t = ATTN_BLEND
    return (1 - t) * landmark_cx + t * ax, (1 - t) * landmark_cy + t * ay


def radii_from_attention(
    base_rx: float,
    base_ry: float,
    stats: dict[str, Any] | None,
    w: int,
    h: int,
    score: float,
) -> tuple[float, float]:
    """Clustered high-activation patches → smaller ellipse; spread → larger."""
    scale = score_scale(score)
    rx, ry = base_rx * scale, base_ry * scale
    if stats is not None and stats["top_xy"].shape[0] >= 2:
        sx = float(np.std(stats["top_xy"][:, 0])) / max(w, 1) * 100.0
        sy = float(np.std(stats["top_xy"][:, 1])) / max(h, 1) * 100.0
        # Map spread into a multiplier ~0.75–1.35
        spread = (sx + sy) / 2.0
        mult = float(np.clip(0.75 + spread * 0.12, 0.75, 1.35))
        rx *= mult
        ry *= mult
    return rx, ry


def make_ellipse(
    *,
    cls: str,
    score: float,
    cx: float,
    cy: float,
    rx_pct: float,
    ry_pct: float,
    w: int,
    h: int,
    zone_mean: float | None = None,
    diffuse: bool = False,
    label: str | None = None,
) -> dict[str, Any]:
    rx_pct = max(1.0, min(22.0 if diffuse else 18.0, rx_pct))
    ry_pct = max(1.0, min(28.0 if diffuse else 16.0, ry_pct))
    out: dict[str, Any] = {
        "type": "ellipse",
        "class": cls,
        "center_pct": [
            round(float(np.clip(cx / w * 100.0, 0, 100)), 2),
            round(float(np.clip(cy / h * 100.0, 0, 100)), 2),
        ],
        "rx_pct": round(rx_pct, 2),
        "ry_pct": round(ry_pct, 2),
        "score": round(score, 2),
        "opacity": opacity_for_score(score, diffuse=diffuse),
        "proxy": True,
    }
    if zone_mean is not None:
        out["zone_activation"] = round(zone_mean, 4)
    if diffuse:
        out["diffuse"] = True
        out["label"] = label or f"Diffuse {cls.replace('_', ' ')}"
    return out


def make_polyline(
    *,
    cls: str,
    score: float,
    points_pct: list[list[float]],
    zone_mean: float | None = None,
) -> dict[str, Any]:
    out: dict[str, Any] = {
        "type": "polyline",
        "class": cls,
        "points_pct": points_pct,
        "score": round(score, 2),
        "opacity": opacity_for_score(score),
        "proxy": True,
    }
    if zone_mean is not None:
        out["zone_activation"] = round(zone_mean, 4)
    return out


def base_radii_from_pts(
    pts: np.ndarray,
    w: int,
    h: int,
    *,
    base_rx_pct: float | None = None,
    base_ry_pct: float | None = None,
) -> tuple[float, float]:
    if base_rx_pct is not None and base_ry_pct is not None:
        return base_rx_pct, base_ry_pct
    rx_px = float(np.std(pts[:, 0]) * 1.85) if pts.shape[0] > 1 else w * 0.04
    ry_px = float(np.std(pts[:, 1]) * 1.85) if pts.shape[0] > 1 else h * 0.04
    return (rx_px / w) * 100.0, (ry_px / h) * 100.0


def try_zone_ellipse(
    landmarks: Any,
    indices: list[int],
    w: int,
    h: int,
    *,
    cls: str,
    score: float,
    activations: np.ndarray | None,
    face_mask: np.ndarray,
    base_rx_pct: float | None = None,
    base_ry_pct: float | None = None,
    min_rx: float = 2.0,
    min_ry: float = 1.5,
) -> dict[str, Any] | None:
    if zone_landmark_confidence(landmarks, indices) < LANDMARK_CONF_MIN:
        return None
    pts = pts_from_indices(landmarks, indices, w, h)
    if pts.shape[0] < 2:
        return None
    stats = zone_activation_stats(activations, face_mask, pts, w, h)
    if not zone_allowed(score, stats):
        return None

    lm_cx, lm_cy = float(np.mean(pts[:, 0])), float(np.mean(pts[:, 1]))
    cx, cy = blend_center(lm_cx, lm_cy, stats)
    brx, bry = base_radii_from_pts(
        pts, w, h, base_rx_pct=base_rx_pct, base_ry_pct=base_ry_pct
    )
    rx, ry = radii_from_attention(brx, bry, stats, w, h, score)
    rx = max(min_rx, rx)
    ry = max(min_ry, ry)
    return make_ellipse(
        cls=cls,
        score=score,
        cx=cx,
        cy=cy,
        rx_pct=rx,
        ry_pct=ry,
        w=w,
        h=h,
        zone_mean=None if stats is None else float(stats["zone_mean"]),
    )


def try_zone_polyline(
    landmarks: Any,
    indices: list[int],
    w: int,
    h: int,
    *,
    cls: str,
    score: float,
    activations: np.ndarray | None,
    face_mask: np.ndarray,
) -> dict[str, Any] | None:
    if zone_landmark_confidence(landmarks, indices) < LANDMARK_CONF_MIN:
        return None
    pts = pts_from_indices(landmarks, indices, w, h)
    if pts.shape[0] < 2:
        return None
    stats = zone_activation_stats(activations, face_mask, pts, w, h)
    if not zone_allowed(score, stats):
        return None

    # Mild shift of polyline toward attention centroid (keep shape)
    points = pts.copy()
    if stats is not None and stats["top_xy"].shape[0] > 0:
        ax = float(np.mean(stats["top_xy"][:, 0]))
        ay = float(np.mean(stats["top_xy"][:, 1]))
        lmx, lmy = float(np.mean(pts[:, 0])), float(np.mean(pts[:, 1]))
        dx = (ax - lmx) * 0.35
        dy = (ay - lmy) * 0.35
        points[:, 0] += dx
        points[:, 1] += dy

    points_pct = [
        [
            round(float(np.clip(p[0] / w * 100.0, 0, 100)), 2),
            round(float(np.clip(p[1] / h * 100.0, 0, 100)), 2),
        ]
        for p in points
    ]
    return make_polyline(
        cls=cls,
        score=score,
        points_pct=points_pct,
        zone_mean=None if stats is None else float(stats["zone_mean"]),
    )


def diffuse_face_ellipse(
    landmarks: Any,
    w: int,
    h: int,
    *,
    cls: str,
    score: float,
) -> dict[str, Any] | None:
    pts = pts_from_indices(landmarks, FACE_OVAL, w, h)
    if pts.shape[0] < 3:
        return None
    cx, cy = float(np.mean(pts[:, 0])), float(np.mean(pts[:, 1]))
    rx = float(np.std(pts[:, 0]) * 2.2) / w * 100.0
    ry = float(np.std(pts[:, 1]) * 2.2) / h * 100.0
    return make_ellipse(
        cls=cls,
        score=score,
        cx=cx,
        cy=cy,
        rx_pct=max(rx, 18.0),
        ry_pct=max(ry, 22.0),
        w=w,
        h=h,
        diffuse=True,
        label=f"Diffuse {cls.replace('_', ' ')}",
    )


def extract_proxy_regions(
    source_bgr: np.ndarray,
    scores: dict[str, Any],
    patch_activations: np.ndarray | None = None,
) -> tuple[list[dict[str, Any]], bool]:
    mesh = face_mesh_context()
    if mesh is None:
        raise RuntimeError("mediapipe Face Mesh unavailable")

    h, w = source_bgr.shape[:2]
    rgb = cv2.cvtColor(source_bgr, cv2.COLOR_BGR2RGB)
    with mesh as face_mesh:
        res = face_mesh.process(rgb)
    if not res.multi_face_landmarks:
        raise RuntimeError("no face landmarks detected")

    landmarks = res.multi_face_landmarks[0].landmark
    # Global safety: weak landmark confidence → wrong zones; skip entirely.
    if face_oval_confidence(landmarks) < LANDMARK_CONF_MIN:
        return [], False

    face_mask = face_patch_mask(landmarks, w, h)

    activations = patch_activations
    attention_used = activations is not None
    if activations is None:
        activations = compute_dino_patch_l2(source_bgr)
        attention_used = activations is not None

    # Diffuse fallback needs clearer severity when attention is unavailable.
    diffuse_min = 3.5 if not attention_used else 3.0

    candidates: list[dict[str, Any]] = []

    # ── Pigmentation: per-cheek + forehead independently ──
    pig = clamp_score(scores.get("pigmentation"))
    if pig is not None and pig > 1:
        pig_zones_before = len(candidates)
        cheek_zones = (PIGMENT_LEFT_CHEEK, PIGMENT_RIGHT_CHEEK)
        for idxs in cheek_zones:
            ell = try_zone_ellipse(
                landmarks,
                idxs,
                w,
                h,
                cls="pigmentation",
                score=pig,
                activations=activations,
                face_mask=face_mask,
            )
            if ell:
                candidates.append(ell)
        # Forehead only for heavy pigmentation (score ≥ 4).
        if pig >= 4:
            ell = try_zone_ellipse(
                landmarks,
                PIGMENT_FOREHEAD,
                w,
                h,
                cls="pigmentation",
                score=pig,
                activations=activations,
                face_mask=face_mask,
                min_rx=3.0,
                min_ry=2.0,
            )
            if ell:
                ell["rx_pct"] = round(max(ell["rx_pct"], 5.0), 2)
                candidates.append(ell)
        if len(candidates) == pig_zones_before and pig >= diffuse_min:
            diff = diffuse_face_ellipse(
                landmarks, w, h, cls="pigmentation", score=pig
            )
            if diff:
                candidates.append(diff)

    # ── Acne scars ──
    scars = clamp_score(scores.get("acne_scars"))
    if scars is not None and scars > 1:
        before = len(candidates)
        for idxs in (SCAR_LEFT_CHEEK, SCAR_RIGHT_CHEEK, SCAR_JAW):
            ell = try_zone_ellipse(
                landmarks,
                idxs,
                w,
                h,
                cls="acne_scars",
                score=scars,
                activations=activations,
                face_mask=face_mask,
            )
            if ell:
                candidates.append(ell)
        if len(candidates) == before and scars >= diffuse_min:
            diff = diffuse_face_ellipse(
                landmarks, w, h, cls="acne_scars", score=scars
            )
            if diff:
                candidates.append(diff)

    # ── Under eye ──
    under = clamp_score(scores.get("under_eye"))
    if under is not None and under > 1:
        before = len(candidates)
        for idxs in (UNDER_EYE_LEFT, UNDER_EYE_RIGHT):
            ell = try_zone_ellipse(
                landmarks,
                idxs,
                w,
                h,
                cls="under_eye",
                score=under,
                activations=activations,
                face_mask=face_mask,
                base_rx_pct=2.4,
                base_ry_pct=1.2,
                min_rx=1.6,
                min_ry=0.8,
            )
            if ell:
                candidates.append(ell)
        if len(candidates) == before and under >= diffuse_min:
            diff = diffuse_face_ellipse(
                landmarks, w, h, cls="under_eye", score=under
            )
            if diff:
                candidates.append(diff)

    # ── Sagging & volume (polylines) ──
    sag = clamp_score(scores.get("sagging_volume"))
    if sag is not None and sag > 1:
        before = len(candidates)
        for idxs in (SAG_LEFT_NASOLABIAL, SAG_RIGHT_NASOLABIAL, SAG_JAWLINE):
            line = try_zone_polyline(
                landmarks,
                idxs,
                w,
                h,
                cls="sagging_volume",
                score=sag,
                activations=activations,
                face_mask=face_mask,
            )
            if line:
                candidates.append(line)
        if len(candidates) == before and sag >= diffuse_min:
            diff = diffuse_face_ellipse(
                landmarks, w, h, cls="sagging_volume", score=sag
            )
            if diff:
                candidates.append(diff)

    # Cap at 8 — keep highest score, then highest zone activation
    def sort_key(r: dict[str, Any]) -> tuple[float, float]:
        return (
            float(r.get("score") or 0),
            float(r.get("zone_activation") or 0),
        )

    candidates.sort(key=sort_key, reverse=True)
    return candidates[:MAX_PROXY_REGIONS], attention_used


def main() -> int:
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
    except Exception as e:
        print(json.dumps({"ok": False, "error": f"invalid_json: {e}"}))
        return 0

    source_b64 = payload.get("source_b64")
    scores = payload.get("scores")
    if not isinstance(source_b64, str) or not isinstance(scores, dict):
        print(json.dumps({"ok": False, "error": "source_b64 and scores required"}))
        return 0

    source = decode_jpeg_b64(source_b64)
    if source is None:
        print(json.dumps({"ok": False, "error": "failed to decode jpeg"}))
        return 0

    patch = parse_patch_activations(payload.get("patch_activations"))

    try:
        regions, attention_used = extract_proxy_regions(
            source, scores, patch_activations=patch
        )
        print(
            json.dumps(
                {
                    "ok": True,
                    "proxy_regions": regions,
                    "attention_used": attention_used,
                }
            )
        )
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e)}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
