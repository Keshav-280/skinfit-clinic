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
import tempfile

import sys
import urllib.request
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np
import torch
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
from PIL import Image
from transformers import SegformerImageProcessor, SegformerForSemanticSegmentation

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


# -------------------------------------------------------------------------
# 1b. Face-parsing model (skin/hair/eyebrows/eyes/lips/ears/nose classes)
# -------------------------------------------------------------------------
# Replaces the old hand-tuned polygon+dilation cutouts and the adaptive-
# skin-color/hair-texture heuristics for everything except facial hair (see
# the beard-exclusion block below) - a trained model classifying real pixels
# is far more precise at the eyebrow/eye/lip/hairline boundary than anything
# we can hand-tune, and unlike a generative model it can't hallucinate,
# since it only ever labels pixels that already exist in the photo.
_FACE_PARSE_MODEL_ID = "jonathandinu/face-parsing"
_face_parse_processor = None
_face_parse_model = None

# CelebAMask-HQ class ids this model was trained on.
FACE_PARSE_SKIN = 1
FACE_PARSE_NOSE = 2
# "Skin-eligible" = skin + nose (the nose is real skin, just a separate
# class in this model's labeling - the nostril holes get a small, precise
# manual cut below, same as before).
FACE_PARSE_SKIN_CLASSES = (FACE_PARSE_SKIN, FACE_PARSE_NOSE)


def _get_face_parser():
    global _face_parse_processor, _face_parse_model
    if _face_parse_model is not None:
        return _face_parse_processor, _face_parse_model
    print("Loading face-parsing model...", file=sys.stderr)
    _face_parse_processor = SegformerImageProcessor.from_pretrained(_FACE_PARSE_MODEL_ID)
    _face_parse_model = SegformerForSemanticSegmentation.from_pretrained(_FACE_PARSE_MODEL_ID)
    _face_parse_model.eval()
    return _face_parse_processor, _face_parse_model


def parse_face_classes(bgr):
    """Per-pixel CelebAMask-HQ class id map, same H x W as the input photo."""
    processor, model = _get_face_parser()
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    image = Image.fromarray(rgb)
    inputs = processor(images=image, return_tensors="pt")
    with torch.no_grad():
        outputs = model(**inputs)
    h, w = bgr.shape[:2]
    upsampled = torch.nn.functional.interpolate(
        outputs.logits, size=(h, w), mode="bilinear", align_corners=False
    )
    return upsampled.argmax(dim=1)[0].numpy()


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

    # Pull the eligible area in from the OUTER face-oval/hairline/jaw
    # silhouette only, before any internal cutouts exist yet - cells right
    # at that outer edge often carry shadow/hair-fringe gradients that the
    # detector misreads as a mark. Eroding this early (rather than the whole
    # mask at the end) means it can't also eat into skin sitting close to an
    # internal cutout (e.g. a mole a few px below the lip exclusion), since
    # those cutouts haven't been carved out yet.
    edge_erode_px = max(2, int(face_height * 0.016))
    base = cv2.erode(
        base,
        cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (edge_erode_px * 2 + 1, edge_erode_px * 2 + 1)),
    )

    # Skin/hair/eyebrows/eyes/lips/ears classification from the trained
    # face-parsing model, replacing the old hand-tuned eyebrow/eye/lip
    # polygons and the crude sideburn x-trim - the model's own hairline/
    # sideburn boundary is pixel-accurate per photo instead of a flat 4.5%
    # face-width guess, and eyebrows/eyes/lips are simply never "skin" in
    # its output, so no dilation padding needs tuning for them at all.
    parsed = parse_face_classes(bgr)
    skin_eligible = np.isin(parsed, FACE_PARSE_SKIN_CLASSES).astype(np.uint8) * 255
    # A small buffer around every non-skin boundary (eyes, eyebrows, lips,
    # hairline) - the model's own edge is precise, but the real photo still
    # has a shadow/highlight transition right at that edge (e.g. the
    # under-eye tear-trough shadow butting up against the eye) that reads as
    # a mark with zero margin. Shrink the eligible mask in from every class
    # boundary instead of just the outer face-oval one.
    non_skin = cv2.bitwise_not(skin_eligible)
    parse_buffer_px = max(8, int(pad * 0.55))
    non_skin = cv2.dilate(non_skin, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (parse_buffer_px * 2 + 1, parse_buffer_px * 2 + 1)))
    skin_eligible = cv2.bitwise_not(non_skin)
    base = cv2.bitwise_and(base, skin_eligible)

    # Nose exclusion - only the nostril openings themselves (genuinely not
    # skin), not the whole nose bridge/tip/sides. The parsing model's "nose"
    # class includes the nostril holes as part of the same blob, so this
    # still needs its own precise cut - same as before.
    nostril_pts = [98, 97, 2, 326, 327, 439, 219]
    nose_mask = np.zeros((h, w), dtype=np.uint8)
    cv2.fillPoly(nose_mask, [cv2.convexHull(P[nostril_pts])], 255)
    # Enough padding to also swallow the shadow ring right around the
    # nostril opening - too little (1.1x pad measured ~24px) still left
    # detections landing 5-20px past the boundary, right where the nostril
    # shadow gradient fades into normal nose-tip skin.
    nose_mask = cv2.dilate(nose_mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (int(pad * 2.0) + 1, int(pad * 2.0) + 1)))
    base[nose_mask > 0] = 0

    # Beard exclusion: the face-parsing model's training data (CelebAMask-HQ)
    # skews clean-shaven, so it reliably calls facial hair "skin" instead of
    # "hair" - unlike scalp hair/sideburns, which it handles well. Keep our
    # own landmark-region + texture density check for this one gap, cutting
    # the whole mustache/chin/jaw region out - but only when this photo
    # actually shows facial hair growth there, so clean-shaven users keep
    # chin/jaw detection.
    mustache_top_y = int(P[2][1]) - int(face_height * 0.02)  # just above the upper lip
    beard_face_pts = np.array(
        [pt for pt in P[FACE_OVAL] if pt[1] >= mustache_top_y], dtype=np.int32
    )
    if beard_face_pts.shape[0] >= 3:
        beard_region = np.zeros((h, w), dtype=np.uint8)
        cv2.fillPoly(beard_region, [cv2.convexHull(beard_face_pts)], 255)

        # Facial hair detector relaxed vs. the scalp-hair one: gray/white
        # beard hair is desaturated but not necessarily dark, so gate on low
        # saturation (any lightness) in addition to plain edge density.
        hsv_full = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
        sat_full = hsv_full[:, :, 1].astype(np.float32)
        gray_full = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY).astype(np.float32)
        gx_f = cv2.Sobel(gray_full, cv2.CV_32F, 1, 0, ksize=3)
        gy_f = cv2.Sobel(gray_full, cv2.CV_32F, 0, 1, ksize=3)
        edge_density_full = cv2.boxFilter(cv2.magnitude(gx_f, gy_f), -1, (9, 9))
        beard_hair_like = ((edge_density_full > 40.0) & (sat_full < 60.0)).astype(np.uint8) * 255

        beard_area_px = int(np.count_nonzero(beard_region))
        if beard_area_px > 200:
            beard_hair_px = int(
                np.count_nonzero(cv2.bitwise_and(beard_region, beard_hair_like))
            )
            # A clean-shaven chin still has some texture (stubble shadow,
            # jaw contour) - require a clear majority before calling it beard.
            if beard_hair_px / beard_area_px > 0.22:
                base[beard_region > 0] = 0

    # Clean up small holes/specks left by the cutouts above.
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
    black_l_floor=15.0,  # was 42 - excluded genuinely dark moles/pigmentation from scoring entirely
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
    rank_threshold = {"dark": dark_threshold, "acne": red_threshold, "scar": scar_threshold}

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

                # black_l_floor only exists to drop near-black leftovers
                # (deep shadow crease, hair residue that survived the earlier
                # masks) - it must NOT reject genuinely dark pigmented skin
                # (moles, deep melasma), or those never get a chance to be
                # scored as a "dark" mark at all. Keep it low.
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
        # Cutoff for "notably redder/browner than the rest of this zone" -
        # a percentile of this zone's own A/B spread, not a fixed absolute
        # LAB number, since that range shifts a lot with camera/lighting.
        # Only the top slice of the zone's own redness variation counts, and
        # a floor keeps a very uniform (flat) zone from flagging noise.
        zone_dev_cutoff = None
        if zone_ref_A is not None:
            _a = cell_A[cell_ok] - zone_ref_A
            _b = cell_B[cell_ok] - zone_ref_B
            zone_dev_all = _a + np.maximum(0.0, _b) * 0.4
            zone_dev_cutoff = max(2.0, float(np.percentile(zone_dev_all, 88)))

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

                # Zone-wide redness/pigmentation baseline - same idea as the
                # melasma check above, but for the A channel. A local-only
                # comparison misses a broad flush or a wide brown patch
                # because its own neighborhood is elevated too; comparing
                # against the zone's own top-decile redness spread instead
                # still catches it, and bumping diff_a (not overwriting with
                # raw zone_dev) keeps the severity on the same scale as
                # locally-detected marks so it isn't out-ranked by them.
                if zone_dev_cutoff is not None:
                    diff_a_zone = cell_A[r, c] - zone_ref_A
                    diff_b_zone = cell_B[r, c] - zone_ref_B
                    zone_dev = diff_a_zone + max(0.0, diff_b_zone) * 0.4
                    if zone_dev > zone_dev_cutoff:
                        diff_a = max(diff_a, red_threshold + (zone_dev - zone_dev_cutoff))

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

                # Rank relative to that type's own threshold, not raw
                # magnitude - dark/scar scores run several times larger than
                # redness (LAB A-channel) scores by nature, so comparing raw
                # severity across types would always crowd out redness/acne.
                rank = severity / rank_threshold[stype]

                zone_candidates.append(
                    {"cx": cx, "cy": cy, "r": computed_r, "score": severity, "rank": rank, "type": stype}
                )

        zone_candidates.sort(key=lambda d: d["rank"], reverse=True)
        merged = []
        for c in zone_candidates:
            matched = False
            for m in merged:
                dist = np.hypot(c["cx"] - m["cx"], c["cy"] - m["cy"])
                if dist < (c["r"] + m["r"]) * merge_factor:
                    m["cx"] = int((m["cx"] + c["cx"]) / 2)
                    m["cy"] = int((m["cy"] + c["cy"]) / 2)
                    m["r"] = min(max_radius_px, max(m["r"], c["r"]))
                    if c["rank"] > m["rank"]:
                        m["score"] = c["score"]
                        m["rank"] = c["rank"]
                    matched = True
                    break
            if not matched:
                merged.append(c)

        final_detections.extend(merged[:max_spots_per_zone])

    # Confidence floor - max_total_spots is a CEILING, not a target. Normal
    # skin texture (pores, faint stubble shadow) routinely clears the raw
    # per-cell thresholds by a small margin, especially on the edge-response
    # ("scar") channel - a rank of ~1.0-1.5x threshold is not a reliable mark,
    # it's just texture. Empirically (checked against real capture photos),
    # candidates only start meaningfully thinning out past ~2.5x threshold,
    # so that's the bar for "confident enough to circle."
    MIN_CONFIDENT_RANK = 2.5
    final_detections = [d for d in final_detections if d["rank"] >= MIN_CONFIDENT_RANK]

    # Global cap by confidence across the whole face - a per-zone cap alone
    # still let a busy face show 4 zones x 8 = up to 32 circles.
    #
    # "scar" severity (Laplacian edge response) naturally runs to much
    # higher multiples of its own threshold than "dark"/"acne" (LAB-channel
    # diffs) do of theirs, so ranking every candidate on one shared scale
    # would let scar detections crowd out redness/pigmentation entirely even
    # after per-type threshold normalization. Reserve a minimum number of
    # slots per type (when that type has any candidates) before filling the
    # rest by rank, so a busy face still shows its redness, not just texture.
    # This no longer forces weak candidates in just to hit the reservation -
    # the confidence floor above already ran, so a type with nothing solid
    # simply contributes 0 slots here.
    MIN_SLOTS_PER_TYPE = 3
    by_type: dict = {}
    for d in final_detections:
        by_type.setdefault(d["type"], []).append(d)
    for lst in by_type.values():
        lst.sort(key=lambda d: d["rank"], reverse=True)

    selected = []
    for lst in by_type.values():
        selected.extend(lst[:MIN_SLOTS_PER_TYPE])

    selected_ids = {id(d) for d in selected}
    remaining_pool = sorted(
        (d for d in final_detections if id(d) not in selected_ids),
        key=lambda d: d["rank"],
        reverse=True,
    )
    for d in remaining_pool:
        if len(selected) >= max_total_spots:
            break
        selected.append(d)

    selected.sort(key=lambda d: d["rank"], reverse=True)
    return selected[:max_total_spots]


# -------------------------------------------------------------------------
# 5. Dashed Circle Drawing
# -------------------------------------------------------------------------
def _smooth_curve(points, num=200):
    """Interpolate points into a smooth curve."""
    pts = np.array(points, dtype=np.float64)
    if len(pts) < 2:
        return pts.astype(np.int32)
    from scipy.interpolate import make_interp_spline
    t = np.linspace(0, 1, len(pts))
    t_smooth = np.linspace(0, 1, num)
    try:
        k = min(3, len(pts) - 1)
        sx = make_interp_spline(t, pts[:, 0], k=k)
        sy = make_interp_spline(t, pts[:, 1], k=k)
        return np.column_stack([sx(t_smooth), sy(t_smooth)]).astype(np.int32)
    except Exception:
        return pts.astype(np.int32)


def _draw_dashed_polyline(img, smooth_pts, color, thickness, dash_px, gap_px):
    """Walk along a polyline drawing dashes."""
    drawing = True
    seg_start = 0
    budget = float(dash_px)
    for i in range(1, len(smooth_pts)):
        dist = np.hypot(float(smooth_pts[i][0] - smooth_pts[i-1][0]),
                        float(smooth_pts[i][1] - smooth_pts[i-1][1]))
        budget -= dist
        if budget <= 0:
            if drawing:
                cv2.polylines(img, [smooth_pts[seg_start:i+1]], False, color, thickness, cv2.LINE_AA)
            seg_start = i
            drawing = not drawing
            budget = float(gap_px if not drawing else dash_px)
    if drawing and seg_start < len(smooth_pts) - 1:
        cv2.polylines(img, [smooth_pts[seg_start:]], False, color, thickness, cv2.LINE_AA)


def draw_dashed_crescent(img, upper_pts, color, thickness=3, dash_px=7, gap_px=5):
    """Draw a dashed crescent shape: upper eyelid curve + a lower arc bulging down."""
    upper = _smooth_curve(upper_pts, 200)
    if len(upper) < 2:
        return

    # Build lower arc: same start/end as upper curve but bowed downward
    start = upper[0].astype(np.float64)
    end = upper[-1].astype(np.float64)
    mid_x = (start[0] + end[0]) / 2
    mid_y = (start[1] + end[1]) / 2
    # Sag = how far below the midpoint the arc dips
    span = np.hypot(end[0] - start[0], end[1] - start[1])
    sag = max(18, span * 0.4)
    lower_ctrl = np.array([
        start,
        [start[0] * 0.6 + mid_x * 0.4, mid_y + sag * 0.7],
        [mid_x, mid_y + sag],
        [end[0] * 0.6 + mid_x * 0.4, mid_y + sag * 0.7],
        end,
    ])
    lower = _smooth_curve(lower_ctrl, 200)

    _draw_dashed_polyline(img, upper, color, thickness, dash_px, gap_px)
    _draw_dashed_polyline(img, lower, color, thickness, dash_px, gap_px)


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
# 6. ML-based Detection (YOLO acne + Roboflow mole/scar workflow)
# -------------------------------------------------------------------------
_YOLO_MODEL_PATH = str(Path(__file__).resolve().parent / "best.pt")
_yolo_model = None

_ROBOFLOW_API_KEY = os.environ.get("ROBOFLOW_API_KEY", "ejZGvesMl2RGypEhgjO8")
_ROBOFLOW_WORKSPACE = "keshav-goyal-bjss4"
_ROBOFLOW_WORKFLOW = "face-skin-findings"


def _get_yolo_model():
    global _yolo_model
    if _yolo_model is not None:
        return _yolo_model
    if not os.path.exists(_YOLO_MODEL_PATH):
        print(f"YOLO model not found at {_YOLO_MODEL_PATH}, skipping", file=sys.stderr)
        return None
    try:
        from ultralytics import YOLO
        _yolo_model = YOLO(_YOLO_MODEL_PATH)
        print("Loaded YOLO acne model", file=sys.stderr)
        return _yolo_model
    except Exception as e:
        print(f"Failed to load YOLO model: {e}", file=sys.stderr)
        return None


def detect_with_yolo(bgr, conf=0.15):
    model = _get_yolo_model()
    if model is None:
        return []
    results = model.predict(bgr, conf=conf, verbose=False)
    detections = []
    for r in results:
        for box in r.boxes:
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            cx = (x1 + x2) / 2
            cy = (y1 + y2) / 2
            bw = x2 - x1
            bh = y2 - y1
            radius = max(20, int(max(bw, bh) / 2 * 1.6))
            detections.append({
                "cx": int(cx), "cy": int(cy), "r": radius,
                "score": float(box.conf[0]),
                "rank": float(box.conf[0]) * 10,
                "type": "acne",
                "kind": "acne",
                "source": "yolo",
            })
    return detections


def detect_with_roboflow(bgr, conf=0.15):
    try:
        from inference_sdk import InferenceHTTPClient, InferenceConfiguration
    except ImportError:
        print("inference-sdk not installed, skipping Roboflow", file=sys.stderr)
        return []

    tmp_path = os.path.join(tempfile.gettempdir(), f"rf_{os.getpid()}.jpg")
    try:
        cv2.imwrite(tmp_path, bgr)
        client = InferenceHTTPClient(
            api_url="https://serverless.roboflow.com",
            api_key=_ROBOFLOW_API_KEY,
        ).configure(InferenceConfiguration(api_key_transport="header"))

        result = client.run_workflow(
            workspace_name=_ROBOFLOW_WORKSPACE,
            workflow_id=_ROBOFLOW_WORKFLOW,
            images={"image": tmp_path},
            parameters={
                "confidence": conf,
                "iou_threshold": 0.3,
                "class_agnostic_nms": False,
                "max_detections": 100,
            },
            use_cache=True,
        )
    except Exception as e:
        print(f"Roboflow API error: {e}", file=sys.stderr)
        return []
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass

    detections = []
    if not result or "predictions" not in result[0]:
        return detections

    preds = result[0]["predictions"].get("predictions", [])
    class_map = {
        "acne scar": ("scar", "acne_scar"),
        "mole on face": ("dark", "mole"),
        "dark spot": ("dark", "dark_spot"),
        "dark circle": ("dark", "dark_circle"),
        "scar": ("scar", "scar"),
        "mole": ("dark", "mole"),
    }
    img_h, img_w = bgr.shape[:2]
    max_box = min(img_h, img_w) * 0.15
    for p in preds:
        bw = int(p["width"])
        bh = int(p["height"])
        if max(bw, bh) > max_box:
            continue
        cls_name = p.get("class", "").lower()
        api_type, kind = class_map.get(cls_name, ("dark", cls_name.replace(" ", "_")))
        cx = int(p["x"])
        cy = int(p["y"])
        radius = max(20, int(max(bw, bh) / 2 * 1.6))
        detections.append({
            "cx": cx, "cy": cy, "r": radius,
            "score": float(p["confidence"]),
            "rank": float(p["confidence"]) * 10,
            "type": api_type,
            "kind": kind,
            "source": "roboflow",
        })
    return detections


def detect_dark_circles(bgr, pts):
    """Detect dark circles by comparing under-eye luminance to forehead/upper-cheek baseline."""
    if pts is None or len(pts) < 474:
        return []
    P = np.array(pts, dtype=np.int32)
    h, w = bgr.shape[:2]
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)
    L = lab[:, :, 0].astype(np.float32)

    # Lower eyelid contour landmarks (ordered left-to-right for smooth curve)
    LEFT_LOWER_LID = [33, 7, 163, 144, 145, 153, 154, 155, 133]
    RIGHT_LOWER_LID = [263, 249, 390, 373, 374, 380, 381, 382, 362]
    # Under-eye area landmarks for luminance sampling
    LEFT_UNDER = [111, 117, 118, 119, 120, 121, 128, 245]
    RIGHT_UNDER = [340, 346, 347, 348, 349, 350, 357, 465]
    # Reference: nose bridge + forehead center (well-lit, consistent)
    REF_IDS = [8, 9, 10, 151, 108, 337, 69, 299]

    ref_mask = np.zeros((h, w), dtype=np.uint8)
    cv2.fillPoly(ref_mask, [cv2.convexHull(P[REF_IDS])], 255)
    ref_L = L[ref_mask > 0].mean() if np.count_nonzero(ref_mask) > 50 else 0
    if ref_L <= 0:
        return []

    detections = []
    sides_info = [
        ("left", LEFT_UNDER, LEFT_LOWER_LID),
        ("right", RIGHT_UNDER, RIGHT_LOWER_LID),
    ]
    detected_sides = []
    for side, under_ids, lid_ids in sides_info:
        under_pts = P[under_ids]
        under_mask = np.zeros((h, w), dtype=np.uint8)
        cv2.fillPoly(under_mask, [cv2.convexHull(under_pts)], 255)
        under_mask = cv2.dilate(under_mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15)))

        under_L = L[under_mask > 0].mean() if np.count_nonzero(under_mask) > 20 else 0
        darkness = ref_L - under_L
        if darkness > 5:
            lid_contour = P[lid_ids].copy()
            eye_height = int(lid_contour[:, 1].max() - lid_contour[:, 1].min())
            offset = max(8, int(eye_height * 0.6))
            lid_contour[:, 1] += offset

            cx = int(under_pts[:, 0].mean())
            cy = int(under_pts[:, 1].mean())
            spread = int(np.hypot(
                under_pts[:, 0].max() - under_pts[:, 0].min(),
                under_pts[:, 1].max() - under_pts[:, 1].min(),
            ) / 2)
            radius = max(25, int(spread * 1.5))
            conf = min(0.95, darkness / 25.0)
            detections.append({
                "cx": cx, "cy": cy, "r": radius,
                "score": round(conf, 2),
                "rank": conf * 10,
                "type": "dark",
                "kind": "dark_circle",
                "source": "landmark",
                "contour": lid_contour.tolist(),
            })
            detected_sides.append(side)

    # Bilateral mirror: if only one eye detected, add the other eye too
    if len(detected_sides) == 1:
        missing_side = "right" if detected_sides[0] == "left" else "left"
        for side, under_ids, lid_ids in sides_info:
            if side != missing_side:
                continue
            under_pts = P[under_ids]
            lid_contour = P[lid_ids].copy()
            eye_height = int(lid_contour[:, 1].max() - lid_contour[:, 1].min())
            offset = max(8, int(eye_height * 0.6))
            lid_contour[:, 1] += offset
            cx = int(under_pts[:, 0].mean())
            cy = int(under_pts[:, 1].mean())
            existing = detections[0]
            detections.append({
                "cx": cx, "cy": cy, "r": existing["r"],
                "score": round(existing["score"] * 0.85, 2),
                "rank": existing["rank"] * 0.85,
                "type": "dark",
                "kind": "dark_circle",
                "source": "landmark_mirror",
                "contour": lid_contour.tolist(),
            })

    return detections


def detect_ml(bgr, skin_mask=None, max_radius_px=65, pts=None):
    yolo_dets = detect_with_yolo(bgr)
    roboflow_dets = detect_with_roboflow(bgr)
    dc_dets = detect_dark_circles(bgr, pts)

    all_dets = yolo_dets + roboflow_dets + dc_dets
    h, w = bgr.shape[:2]

    # Filter to skin-only regions if mask available
    # Skip filtering for dark_circle/acne_scar — they sit near eyes where
    # the face-parsing model marks non-skin
    if skin_mask is not None:
        filtered = []
        for d in all_dets:
            kind = d.get("kind", "")
            if kind in ("dark_circle", "acne_scar"):
                filtered.append(d)
                continue
            cx, cy = d["cx"], d["cy"]
            if 0 <= cy < h and 0 <= cx < w:
                y1 = max(0, cy - d["r"])
                y2 = min(h, cy + d["r"])
                x1 = max(0, cx - d["r"])
                x2 = min(w, cx + d["r"])
                region = skin_mask[y1:y2, x1:x2]
                if region.size > 0 and region.mean() > 30:
                    filtered.append(d)
        all_dets = filtered

    # Cap radius
    for d in all_dets:
        d["r"] = min(d["r"], max_radius_px)

    # Merge overlapping detections
    merged = []
    for d in sorted(all_dets, key=lambda x: x["score"], reverse=True):
        overlap = False
        for m in merged:
            dist = np.hypot(d["cx"] - m["cx"], d["cy"] - m["cy"])
            if dist < (d["r"] + m["r"]) * 0.5:
                overlap = True
                break
        if not overlap:
            merged.append(d)

    return merged


# -------------------------------------------------------------------------
# 7. Service + CLI
# -------------------------------------------------------------------------
MAX_SPOT_DIAMETER_CM = 1.0
MAX_TOTAL_SPOTS = 15


def analyze(bgr):
    """FastAPI / CLI contract: (annotated BGR image, spot dicts). No kAI scores."""
    h, w = bgr.shape[:2]
    dim = max(1, min(h, w))
    zones, skin_mask, pts = build_zone_masks(bgr)
    if zones is None or pts is None:
        return bgr.copy(), []

    px_per_cm = estimate_px_per_cm(pts)
    max_radius_px = max(14, int(px_per_cm * MAX_SPOT_DIAMETER_CM / 2))

    # ML detection (YOLO acne + Roboflow mole/scar) as primary
    ml_dets = detect_ml(bgr, skin_mask=skin_mask, max_radius_px=max_radius_px, pts=pts)

    if ml_dets:
        dets = ml_dets[:MAX_TOTAL_SPOTS]
    else:
        # Fallback to heuristic if both ML models fail
        dets = detect_blemishes_zoned(
            bgr, zones,
            max_radius_px=max_radius_px,
            max_total_spots=MAX_TOTAL_SPOTS,
        )

    out = bgr.copy()
    for d in dets:
        if d.get("kind") == "dark_circle" and "contour" in d:
            draw_dashed_crescent(out, d["contour"], (0, 0, 255), 3, 7, 5)
        else:
            draw_dashed_circle(out, (d["cx"], d["cy"]), d["r"], (0, 0, 255), 3, 7, 5)

    spots = []
    for d in dets:
        kind = d.get("kind", d.get("type", "unknown"))
        api_type = d.get("type", "dark")
        if api_type == "acne":
            api_type = "red"
        spots.append(
            {
                "x": int(d["cx"]),
                "y": int(d["cy"]),
                "r": int(d["r"]),
                "x_pct": round(d["cx"] / w * 100, 2),
                "y_pct": round(d["cy"] / h * 100, 2),
                "r_pct": round(d["r"] / dim * 100, 2),
                "type": api_type,
                "kind": kind,
                "severity": round(float(d["score"]), 2),
                "source": d.get("source", "heuristic"),
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
            "acne": sum(1 for s in spots if s.get("kind") == "acne"),
            "mole": sum(1 for s in spots if s.get("kind") == "mole"),
            "dark_spot": sum(1 for s in spots if s.get("kind") == "dark_spot"),
            "acne_scar": sum(1 for s in spots if s.get("kind") == "acne_scar"),
            "scar": sum(1 for s in spots if s.get("kind") == "scar"),
            "dark_circle": sum(1 for s in spots if s.get("kind") == "dark_circle"),
            "dark": sum(1 for s in spots if s.get("kind") == "dark"),
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
    ap.add_argument("--black-floor", type=float, default=15.0)
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