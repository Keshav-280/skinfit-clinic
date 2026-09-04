"""
spot_v18_zoned.py — Precision blemish, acne, and melasma detector.
Changes from v17:
  - Circles are now drawn dashed instead of solid.
  - Slightly more sensitive detection: lower dark/red thresholds and a smaller
    min_cluster so faint/pinpoint marks that were borderline before now clear
    the bar. Tune these back up if it starts overcalling.
Changes from v16 (carried over):
  - Adaptive (sampled) skin color model instead of fixed HSV/YCrCb thresholds,
    so brown/brownish-red skin tones are modeled from the actual photo.
  - Texture-based hair rejection (Sobel edge density) to catch dark brown/black
    hair that the color mask alone can't distinguish from skin.
  - Tighter hairline ellipse + slightly larger eyebrow/nose/lip exclusion pad.
  - Finer cell_size, stricter merge distance, soft per-zone cap instead of a
    hard truncation, so real detections stop getting dropped or fused together.
"""

import argparse
import base64
import json
import os
import sys
import urllib.request
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

# -------------------------------------------------------------------------
# 1. MediaPipe Model Setup & Landmark Extraction
# -------------------------------------------------------------------------
MODEL_PATH = str(Path(__file__).resolve().parent / "face_landmarker.task")
_LANDMARKER_URL = (
    "https://storage.googleapis.com/mediapipe-models/face_landmarker/"
    "face_landmarker/float16/1/face_landmarker.task"
)
_landmarker = None


def _get_landmarker():
    global _landmarker
    if _landmarker is not None:
        return _landmarker
    if not os.path.exists(MODEL_PATH):
        print("Downloading face landmarker model...", file=sys.stderr)
        urllib.request.urlretrieve(_LANDMARKER_URL, MODEL_PATH)
    base_options = python.BaseOptions(model_asset_path=MODEL_PATH)
    options = vision.FaceLandmarkerOptions(base_options=base_options, num_faces=1)
    _landmarker = vision.FaceLandmarker.create_from_options(options)
    return _landmarker


def get_landmarks(bgr_img):
    img_rgb = cv2.cvtColor(bgr_img, cv2.COLOR_BGR2RGB)
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=img_rgb)
    results = _get_landmarker().detect(mp_image)
    if not results.face_landmarks:
        return None
    h, w = bgr_img.shape[:2]
    return [(int(lm.x * w), int(lm.y * h)) for lm in results.face_landmarks[0]]


# Average adult interpupillary distance - used to convert this photo's pixel
# scale to real-world centimeters so circle sizes are capped in cm, not just
# pixels (a close-up phone selfie and a farther one shouldn't cap differently).
_AVG_INTERPUPILLARY_CM = 6.3


def estimate_px_per_cm(pts):
    """Iris-center distance (landmarks 468/473 from the Tasks API's 478-point
    mesh) as a physical ruler for this photo. Falls back to a face-width
    heuristic (~14cm average adult face width) if iris points are missing."""
    P = np.array(pts, dtype=np.float32)
    if P.shape[0] >= 474:
        left_iris = P[468]
        right_iris = P[473]
        interpupillary_px = float(np.hypot(*(left_iris - right_iris)))
        if interpupillary_px > 1:
            return interpupillary_px / _AVG_INTERPUPILLARY_CM

    FACE_OVAL = [
        10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
        397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
        172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109
    ]
    face_width_px = float(P[FACE_OVAL][:, 0].max() - P[FACE_OVAL][:, 0].min())
    return max(1.0, face_width_px) / 14.0


# -------------------------------------------------------------------------
# 2. Adaptive Skin Color Model
# -------------------------------------------------------------------------
def _sample_skin_patches(bgr, P):
    """Grab small patches from spots that are reliably skin (not brow/eye/nose/lip)
    regardless of the person's skin tone, and use them to build a model for THIS photo."""
    h, w = bgr.shape[:2]
    ycrcb = cv2.cvtColor(bgr, cv2.COLOR_BGR2YCrCb)
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)

    # Landmark indices that sit on flat, unambiguous skin.
    sample_idx = {
        "forehead": 151,
        "left_cheek": 50,
        "right_cheek": 280,
        "chin": 175,
        "left_cheek2": 137,
        "right_cheek2": 366,
    }

    samples_ycrcb, samples_hsv = [], []
    half = max(3, int(min(h, w) * 0.012))
    for idx in sample_idx.values():
        cx, cy = P[idx]
        y1, y2 = max(0, cy - half), min(h, cy + half)
        x1, x2 = max(0, cx - half), min(w, cx + half)
        if y2 <= y1 or x2 <= x1:
            continue
        samples_ycrcb.append(ycrcb[y1:y2, x1:x2].reshape(-1, 3))
        samples_hsv.append(hsv[y1:y2, x1:x2].reshape(-1, 3))

    samples_ycrcb = np.concatenate(samples_ycrcb, axis=0).astype(np.float32)
    samples_hsv = np.concatenate(samples_hsv, axis=0).astype(np.float32)
    return samples_ycrcb, samples_hsv


def _adaptive_skin_mask(bgr, P):
    """Build a skin range from patches sampled off THIS face instead of a fixed
    global threshold. Generalizes across skin tones (light to deep brown) far
    better than a hardcoded hue band."""
    ycrcb = cv2.cvtColor(bgr, cv2.COLOR_BGR2YCrCb)
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)

    s_ycrcb, s_hsv = _sample_skin_patches(bgr, P)

    cr_mean, cb_mean = s_ycrcb[:, 1].mean(), s_ycrcb[:, 2].mean()
    cr_std, cb_std = s_ycrcb[:, 1].std(), s_ycrcb[:, 2].std()
    h_mean = s_hsv[:, 0].mean()
    h_std = max(s_hsv[:, 0].std(), 4.0)

    k = 3.2  # widened band around the sampled mean
    cr_lo, cr_hi = cr_mean - k * cr_std - 4, cr_mean + k * cr_std + 4
    cb_lo, cb_hi = cb_mean - k * cb_std - 4, cb_mean + k * cb_std + 4

    cr = ycrcb[:, :, 1].astype(np.float32)
    cb = ycrcb[:, :, 2].astype(np.float32)
    mask_ycrcb = ((cr >= cr_lo) & (cr <= cr_hi) & (cb >= cb_lo) & (cb <= cb_hi)).astype(np.uint8) * 255

    hue = hsv[:, :, 0].astype(np.float32)
    sat = hsv[:, :, 1].astype(np.float32)
    mask_hue = ((np.abs(hue - h_mean) <= k * h_std) & (sat >= 15)).astype(np.uint8) * 255

    skin = cv2.bitwise_or(mask_ycrcb, mask_hue)
    kern = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    return cv2.morphologyEx(skin, cv2.MORPH_CLOSE, kern, iterations=2)


def _hair_texture_mask(bgr):
    """Hair (any color) has much higher local edge density than skin. Flags
    high-texture, mid/low-lightness regions as hair regardless of hue — this is
    what catches dark brown/black hair the color model alone lets through."""
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY).astype(np.float32)
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)
    L = lab[:, :, 0].astype(np.float32)

    gx = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
    edge_mag = cv2.magnitude(gx, gy)
    edge_density = cv2.boxFilter(edge_mag, -1, (9, 9))

    # High local edge energy + not bright (rules out specular highlights) -> hair.
    hair_like = (edge_density > 55.0) & (L < 150.0)
    return (hair_like.astype(np.uint8)) * 255


# -------------------------------------------------------------------------
# 3. Zone Mask Construction
# -------------------------------------------------------------------------
def build_zone_masks(bgr):
    h, w = bgr.shape[:2]
    pts = get_landmarks(bgr)
    if pts is None:
        return None, None, None

    P = np.array(pts, dtype=np.int32)
    base = np.zeros((h, w), dtype=np.uint8)

    FACE_OVAL = [
        10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
        397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
        172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109
    ]
    cv2.fillPoly(base, [P[FACE_OVAL]], 255)

    face_top = int(P[FACE_OVAL][:, 1].min())
    face_bot = int(P[FACE_OVAL][:, 1].max())
    face_height = max(1, face_bot - face_top)
    face_width = max(1, int(P[FACE_OVAL][:, 0].max()) - int(P[FACE_OVAL][:, 0].min()))
    pad = int(face_height * 0.05)  # widened slightly from 0.04

    # Forehead hairline: smaller, tighter than v16 so it doesn't reach into hair.
    forehead_cx = int(P[10][0])
    forehead_cy = int(P[10][1])
    hair_top_shift = int(face_height * 0.045)  # was 0.06
    cv2.ellipse(
        base,
        (forehead_cx, forehead_cy),
        (int(face_width * 0.32), hair_top_shift),  # was 0.38
        0, 180, 360, 255, -1,
    )

    # Eyebrow/eye exclusion
    l_eye_brow = [70, 63, 105, 66, 107, 55, 193, 245, 128, 114, 217, 236, 130, 247, 30, 29, 27, 56, 46, 53, 52, 65]
    r_eye_brow = [336, 296, 334, 293, 300, 276, 283, 417, 465, 357, 343, 437, 456, 359, 467, 260, 259, 257, 285, 295, 282]
    eyes_mask = np.zeros((h, w), dtype=np.uint8)
    cv2.fillPoly(eyes_mask, [cv2.convexHull(P[l_eye_brow])], 255)
    cv2.fillPoly(eyes_mask, [cv2.convexHull(P[r_eye_brow])], 255)
    eyes_mask = cv2.dilate(eyes_mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (int(pad * 2.4) + 1, int(pad * 2.4) + 1)))
    base[eyes_mask > 0] = 0

    # Nose exclusion
    nose_pts = [168, 6, 197, 195, 5, 4, 1, 19, 94, 2, 98, 97, 327, 326, 278, 48, 219, 439, 238, 458]
    nose_mask = np.zeros((h, w), dtype=np.uint8)
    cv2.fillPoly(nose_mask, [cv2.convexHull(P[nose_pts])], 255)
    nose_mask = cv2.dilate(nose_mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (int(pad * 2.2) + 1, int(pad * 2.2) + 1)))
    base[nose_mask > 0] = 0

    # Lip exclusion
    outer_lips = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95]
    lip_mask = np.zeros((h, w), dtype=np.uint8)
    cv2.fillPoly(lip_mask, [cv2.convexHull(P[outer_lips])], 255)
    lip_mask = cv2.dilate(lip_mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (int(pad * 2.2) + 1, int(pad * 2.2) + 1)))
    base[lip_mask > 0] = 0

    # Trim sideburns/temple hair
    l_border = int(P[FACE_OVAL][:, 0].min()) + int(face_width * 0.06)  # was 0.05
    r_border = int(P[FACE_OVAL][:, 0].max()) - int(face_width * 0.06)
    base[:, :l_border] = 0
    base[:, r_border:] = 0

    # Apply adaptive skin color model, then knock out anything texture-flagged as hair.
    skin_color = _adaptive_skin_mask(bgr, P)
    hair_tex = _hair_texture_mask(bgr)
    base = cv2.bitwise_and(base, skin_color)
    base[hair_tex > 0] = 0

    # Clean up small holes/specks left by the hair knockout.
    base = cv2.morphologyEx(base, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)))

    # Zone partitioning
    brow_top = int(min(P[i][1] for i in [70, 63, 105, 66, 107, 336, 296, 334, 293, 300]))
    lip_bottom = int(max(P[i][1] for i in [17, 84, 181, 91, 314, 405, 321]))
    nose_center_x = int(P[1][0])

    zones = {}
    forehead_mask = np.zeros((h, w), np.uint8)
    forehead_mask[:brow_top, :] = 255
    zones["forehead"] = cv2.bitwise_and(base, forehead_mask)

    left_cheek_mask = np.zeros((h, w), np.uint8)
    left_cheek_mask[brow_top:lip_bottom, :nose_center_x] = 255
    zones["left_cheek"] = cv2.bitwise_and(base, left_cheek_mask)

    right_cheek_mask = np.zeros((h, w), np.uint8)
    right_cheek_mask[brow_top:lip_bottom, nose_center_x:] = 255
    zones["right_cheek"] = cv2.bitwise_and(base, right_cheek_mask)

    chin_mask = np.zeros((h, w), np.uint8)
    chin_bottom = min(h, face_bot + int(face_height * 0.06))  # bounded, was unbounded to image edge
    chin_mask[lip_bottom:chin_bottom, :] = 255
    zones["chin"] = cv2.bitwise_and(base, chin_mask)

    combined = np.zeros((h, w), dtype=np.uint8)
    for m in zones.values():
        combined = cv2.bitwise_or(combined, m)

    return zones, combined, pts


# -------------------------------------------------------------------------
# 4. Multi-Scale Dual-Window Blemish & Melasma Detector
# -------------------------------------------------------------------------
def detect_blemishes_zoned(
    bgr,
    zones,
    cell_size=3,               # was 4 — finer localization
    dark_threshold=7.6,        # was 8.5 — catches fainter dark marks
    red_threshold=5.8,         # was 6.5 — catches fainter red/acne
    scar_threshold=4.5,
    melasma_threshold=6.0,     # new — diffuse-patch detection vs zone baseline
    chroma_threshold=3.2,      # new — min A/B color shift to confirm pigmentation vs shadow
    black_l_floor=42.0,
    min_cluster=2,             # was 3 — lets tiny pinpoint marks through
    max_spots_per_zone=8,      # soft cap, was a hard 5
    merge_factor=0.55,         # was 0.7 — stops distinct blemishes fusing
    max_radius_px=65,          # circle radius cap, e.g. from a 1cm-diameter limit
    max_total_spots=15,        # global cap across the whole face, by confidence
):
    h, w = bgr.shape[:2]
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    L = lab[:, :, 0].astype(np.float32)
    A = lab[:, :, 1].astype(np.float32)
    Bc = lab[:, :, 2].astype(np.float32)
    S = hsv[:, :, 1].astype(np.float32)

    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY).astype(np.float32)
    gray_blur = cv2.GaussianBlur(gray, (3, 3), 0)
    laplacian = np.abs(cv2.Laplacian(gray_blur, cv2.CV_32F, ksize=5))

    rows, cols = h // cell_size, w // cell_size
    final_detections = []

    for zone_name, zone_mask in zones.items():
        if np.count_nonzero(zone_mask) < 200:
            continue

        cell_L = np.full((rows, cols), np.nan, np.float32)
        cell_A = np.full((rows, cols), np.nan, np.float32)
        cell_B = np.full((rows, cols), np.nan, np.float32)
        cell_S = np.full((rows, cols), np.nan, np.float32)
        cell_Lap = np.full((rows, cols), np.nan, np.float32)
        cell_ok = np.zeros((rows, cols), bool)

        for r in range(rows):
            for c in range(cols):
                y1, y2 = r * cell_size, (r + 1) * cell_size
                x1, x2 = c * cell_size, (c + 1) * cell_size
                sp = zone_mask[y1:y2, x1:x2]
                if sp.mean() / 255.0 < 0.6:
                    continue

                sw = sp > 0
                mean_l = L[y1:y2, x1:x2][sw].mean()
                mean_s = S[y1:y2, x1:x2][sw].mean()

                if mean_l < black_l_floor or (mean_s < 20.0 and mean_l > 120.0):
                    continue

                cell_ok[r, c] = True
                cell_L[r, c] = mean_l
                cell_A[r, c] = A[y1:y2, x1:x2][sw].mean()
                cell_B[r, c] = Bc[y1:y2, x1:x2][sw].mean()
                cell_S[r, c] = mean_s
                cell_Lap[r, c] = laplacian[y1:y2, x1:x2][sw].mean()

        pad_s = 4
        pad_m = 12

        # Zone-wide "clear skin" baseline: the brighter end of this zone's own
        # lightness distribution. Local/macro windows fail on large diffuse
        # patches (melasma) because the neighborhood is dark too — this
        # baseline isn't local, so it still catches them.
        zone_L_vals = cell_L[cell_ok]
        zone_ref_L = float(np.percentile(zone_L_vals, 70)) if zone_L_vals.size > 20 else None
        # Typical (median) A/B for this zone — used to confirm a true color
        # shift (pigmentation) rather than a pure brightness dip (shadow from
        # a fold, hollow, or crease). Shadows darken L without moving A/B much;
        # melasma/pigmentation moves both.
        zone_ref_A = float(np.median(cell_A[cell_ok])) if zone_L_vals.size > 20 else None
        zone_ref_B = float(np.median(cell_B[cell_ok])) if zone_L_vals.size > 20 else None

        dark_score = np.zeros((rows, cols), np.float32)
        red_score = np.zeros((rows, cols), np.float32)
        scar_score = np.zeros((rows, cols), np.float32)

        for r in range(rows):
            for c in range(cols):
                if not cell_ok[r, c]:
                    continue

                r1, r2 = max(0, r - pad_s), min(rows, r + pad_s + 1)
                c1, c2 = max(0, c - pad_s), min(cols, c + pad_s + 1)
                nm_s = cell_ok[r1:r2, c1:c2]

                mr1, mr2 = max(0, r - pad_m), min(rows, r + pad_m + 1)
                mc1, mc2 = max(0, c - pad_m), min(cols, c + pad_m + 1)
                nm_m = cell_ok[mr1:mr2, mc1:mc2]

                if nm_s.sum() < 5 or nm_m.sum() < 12:
                    continue

                nl_local = np.nanmean(cell_L[r1:r2, c1:c2][nm_s])
                nl_macro = np.nanmean(cell_L[mr1:mr2, mc1:mc2][nm_m])

                diff_l = max(nl_local - cell_L[r, c], (nl_macro - cell_L[r, c]) * 0.85)

                if zone_ref_L is not None:
                    diff_ref = zone_ref_L - cell_L[r, c]
                    if diff_ref > melasma_threshold:
                        chroma_dev = abs(cell_A[r, c] - zone_ref_A) + abs(cell_B[r, c] - zone_ref_B)
                        if chroma_dev > chroma_threshold:
                            diff_l = max(diff_l, diff_ref)

                if diff_l > dark_threshold:
                    dark_score[r, c] = diff_l

                na = np.nanmean(cell_A[r1:r2, c1:c2][nm_s])
                diff_a = cell_A[r, c] - na
                if diff_a > red_threshold:
                    red_score[r, c] = diff_a

                nlap = np.nanmean(cell_Lap[r1:r2, c1:c2][nm_s])
                diff_lap = cell_Lap[r, c] - nlap
                if diff_lap > scar_threshold and diff_l > 3.0:
                    scar_score[r, c] = diff_lap + diff_l * 0.5

        zone_candidates = []
        for scores, stype in [(dark_score, "dark"), (red_score, "acne"), (scar_score, "scar")]:
            binary = (scores > 0).astype(np.uint8) * 255
            binary = cv2.dilate(binary, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)))
            nl, lb, st, _ = cv2.connectedComponentsWithStats(binary, connectivity=8)

            for i in range(1, nl):
                area = st[i, cv2.CC_STAT_AREA]
                if area < min_cluster:
                    continue

                bw, bh = st[i, cv2.CC_STAT_WIDTH], st[i, cv2.CC_STAT_HEIGHT]
                aspect = min(bw, bh) / max(bw, bh) if max(bw, bh) > 0 else 0
                # Wrinkle/fold lines trip the scar detector (dark + high edge
                # response) but are long and thin even when chopped into
                # blob-ish segments by the cell grid — hold them to a
                # stricter roundness bar than acne/dark spots.
                min_aspect = 0.4 if stype == "scar" else 0.25
                if aspect < min_aspect:
                    continue

                bx, by = st[i, cv2.CC_STAT_LEFT], st[i, cv2.CC_STAT_TOP]
                comp_mask = lb[by : by + bh, bx : bx + bw] == i

                # Axis-aligned bbox aspect misses DIAGONAL thin lines (a
                # 45-degree strand-shadow can have a near-square bbox even
                # though the blob itself is a thin streak). A rotated
                # min-area rect catches true elongation at any angle —
                # important for hairline shadows crossing the forehead.
                blob_pts = np.argwhere(comp_mask)
                if blob_pts.shape[0] >= 5:
                    xy_pts = blob_pts[:, ::-1].astype(np.float32)  # (row,col) -> (x,y)
                    (_, (rw, rh), _) = cv2.minAreaRect(xy_pts)
                    true_aspect = min(rw, rh) / max(rw, rh) if max(rw, rh) > 0 else 1.0
                    true_min_aspect = 0.45 if stype == "scar" else (0.3 if stype == "dark" else 0.2)
                    if true_aspect < true_min_aspect:
                        continue
                blob_scores = scores[by : by + bh, bx : bx + bw]
                severity = float(blob_scores[comp_mask].mean())

                # Center on the strongest cell in the blob rather than its
                # geometric centroid — tighter, more accurate placement.
                local_scores = np.where(comp_mask, blob_scores, -np.inf)
                peak_idx = np.unravel_index(np.argmax(local_scores), local_scores.shape)
                cy_cell, cx_cell = peak_idx
                cx = int((bx + cx_cell) * cell_size + cell_size / 2)
                cy = int((by + cy_cell) * cell_size + cell_size / 2)

                equiv_radius = np.sqrt(area / np.pi) * cell_size
                computed_r = max(14, int(equiv_radius * 1.15))
                computed_r = min(computed_r, max_radius_px)

                zone_candidates.append({"cx": cx, "cy": cy, "r": computed_r, "score": severity, "type": stype})

        zone_candidates.sort(key=lambda d: d["score"], reverse=True)
        merged = []
        for c in zone_candidates:
            matched = False
            for m in merged:
                dist = np.hypot(c["cx"] - m["cx"], c["cy"] - m["cy"])
                if dist < (c["r"] + m["r"]) * merge_factor:
                    m["cx"] = int((m["cx"] + c["cx"]) / 2)
                    m["cy"] = int((m["cy"] + c["cy"]) / 2)
                    m["r"] = min(max_radius_px, max(m["r"], c["r"]))
                    m["score"] = max(m["score"], c["score"])
                    matched = True
                    break
            if not matched:
                merged.append(c)

        final_detections.extend(merged[:max_spots_per_zone])

    # Global cap by confidence across the whole face - a per-zone cap alone
    # still let a busy face show 4 zones x 8 = up to 32 circles.
    final_detections.sort(key=lambda d: d["score"], reverse=True)
    return final_detections[:max_total_spots]


# -------------------------------------------------------------------------
# 5. Dashed Circle Drawing
# -------------------------------------------------------------------------
def draw_dashed_circle(img, center, radius, color, thickness=3, dash_px=7, gap_px=5):
    """Draw a circle outline as arc dashes instead of a solid stroke.
    Dash count scales with radius so dash length stays visually consistent
    across small and large circles."""
    circumference = 2 * np.pi * max(radius, 1)
    period_deg = (dash_px + gap_px) / circumference * 360.0
    dash_deg = dash_px / circumference * 360.0
    n_dashes = max(6, int(360.0 / period_deg))

    angle = 0.0
    for _ in range(n_dashes):
        cv2.ellipse(img, center, (radius, radius), 0, angle, angle + dash_deg, color, thickness)
        angle += period_deg


# -------------------------------------------------------------------------
# 6. Service + CLI
# -------------------------------------------------------------------------
MAX_SPOT_DIAMETER_CM = 1.0
MAX_TOTAL_SPOTS = 15


def analyze(bgr):
    """FastAPI / CLI contract: (annotated BGR image, spot dicts). No kAI scores."""
    h, w = bgr.shape[:2]
    dim = max(1, min(h, w))
    zones, _skin_mask, pts = build_zone_masks(bgr)
    if zones is None or pts is None:
        return bgr.copy(), []

    px_per_cm = estimate_px_per_cm(pts)
    max_radius_px = max(14, int(px_per_cm * MAX_SPOT_DIAMETER_CM / 2))

    dets = detect_blemishes_zoned(
        bgr,
        zones,
        max_radius_px=max_radius_px,
        max_total_spots=MAX_TOTAL_SPOTS,
    )
    out = bgr.copy()
    for d in dets:
        draw_dashed_circle(out, (d["cx"], d["cy"]), d["r"], (0, 0, 255), 3, 7, 5)

    spots = []
    for d in dets:
        stype = d["type"]
        api_type = "red" if stype == "acne" else "dark"
        spots.append(
            {
                "x": int(d["cx"]),
                "y": int(d["cy"]),
                "r": int(d["r"]),
                "x_pct": round(d["cx"] / w * 100, 2),
                "y_pct": round(d["cy"] / h * 100, 2),
                "r_pct": round(d["r"] / dim * 100, 2),
                "type": api_type,
                "kind": stype,
                "severity": round(float(d["score"]), 2),
            }
        )
    return out, spots


def analyze_from_b64(image_b64: str):
    """Decode a JPEG/PNG base64 photo, run v18, return JSON-safe dict."""
    raw = base64.b64decode(image_b64)
    buf = np.frombuffer(raw, np.uint8)
    bgr = cv2.imdecode(buf, cv2.IMREAD_COLOR)
    if bgr is None:
        return {"ok": False, "error": "could_not_decode_image"}
    annotated, spots = analyze(bgr)
    _, jpeg = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 92])
    return {
        "ok": True,
        "annotated_b64": base64.b64encode(jpeg.tobytes()).decode(),
        "spots": spots,
        "summary": {
            "total": len(spots),
            "dark": sum(1 for s in spots if s.get("kind") == "dark"),
            "red": sum(1 for s in spots if s.get("kind") == "acne"),
            "scar": sum(1 for s in spots if s.get("kind") == "scar"),
        },
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("input", help="Path to input photo")
    ap.add_argument("--output", "-o", default=None)
    ap.add_argument("--cell", type=int, default=3)
    ap.add_argument("--dark-thresh", type=float, default=7.6)
    ap.add_argument("--red-thresh", type=float, default=5.8)
    ap.add_argument("--scar-thresh", type=float, default=4.5)
    ap.add_argument("--melasma-thresh", type=float, default=6.0)
    ap.add_argument("--chroma-thresh", type=float, default=3.2)
    ap.add_argument("--black-floor", type=float, default=42.0)
    ap.add_argument("--max-per-zone", type=int, default=8)
    ap.add_argument("--max-total", type=int, default=MAX_TOTAL_SPOTS)
    ap.add_argument("--max-diameter-cm", type=float, default=MAX_SPOT_DIAMETER_CM)
    ap.add_argument("--thickness", type=int, default=3)
    ap.add_argument("--dash-px", type=int, default=7)
    ap.add_argument("--gap-px", type=int, default=5)
    ap.add_argument("--debug-mask", action="store_true")
    args = ap.parse_args()

    bgr = cv2.imread(str(args.input))
    if bgr is None:
        print(f"Cannot read: {args.input}")
        sys.exit(1)

    zones, skin_mask, pts = build_zone_masks(bgr)
    if zones is None:
        print("No face detected.")
        sys.exit(1)

    if args.debug_mask:
        vis = bgr.copy()
        vis[skin_mask == 0] = vis[skin_mask == 0] // 3
        mask_out = Path(args.input).stem + "_v17_mask.jpg"
        cv2.imwrite(mask_out, vis)
        print(f"Debug mask saved: {mask_out}")

    px_per_cm = estimate_px_per_cm(pts)
    max_radius_px = max(14, int(px_per_cm * args.max_diameter_cm / 2))

    dets = detect_blemishes_zoned(
        bgr,
        zones,
        cell_size=args.cell,
        dark_threshold=args.dark_thresh,
        red_threshold=args.red_thresh,
        scar_threshold=args.scar_thresh,
        melasma_threshold=args.melasma_thresh,
        chroma_threshold=args.chroma_thresh,
        black_l_floor=args.black_floor,
        max_spots_per_zone=args.max_per_zone,
        max_radius_px=max_radius_px,
        max_total_spots=args.max_total,
    )

    out = bgr.copy()
    for d in dets:
        cx, cy, r = d["cx"], d["cy"], d["r"]
        draw_dashed_circle(out, (cx, cy), r, (0, 0, 255), args.thickness, args.dash_px, args.gap_px)

    out_path = args.output or (Path(args.input).stem + "_v18_detected.jpg")
    cv2.imwrite(out_path, out)
    print(f"Saved balanced detection result ({len(dets)} marks detected): {out_path}")


if __name__ == "__main__":
    if not sys.stdin.isatty() and (
        len(sys.argv) == 1 or (len(sys.argv) > 1 and sys.argv[1] == "--stdin")
    ):
        try:
            payload = json.loads(sys.stdin.read() or "{}")
            b64 = payload.get("image_b64") or payload.get("source_b64")
            if not b64:
                print(json.dumps({"ok": False, "error": "missing_image_b64"}))
                sys.exit(0)
            print(json.dumps(analyze_from_b64(str(b64))))
        except Exception as exc:
            print(json.dumps({"ok": False, "error": str(exc)}))
        sys.exit(0)
    main()