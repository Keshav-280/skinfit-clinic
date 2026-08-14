"""Skin spot detector v15 — grid-based LAB contrast with MediaPipe face mesh masking."""

import random
import cv2
import numpy as np

try:
    import mediapipe as mp
    HAS_MP = mp is not None and getattr(mp, "solutions", None) is not None
except Exception:
    mp = None
    HAS_MP = False


def _skin_color(bgr):
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    ycrcb = cv2.cvtColor(bgr, cv2.COLOR_BGR2YCrCb)
    m1 = cv2.inRange(hsv, (0, 15, 40), (28, 255, 255))
    m2 = cv2.inRange(hsv, (160, 15, 40), (180, 255, 255))
    m3 = cv2.inRange(ycrcb, (0, 130, 75), (255, 175, 130))
    skin = cv2.bitwise_or(cv2.bitwise_or(m1, m2), m3)
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    return cv2.morphologyEx(skin, cv2.MORPH_CLOSE, k, iterations=2)


def build_skin_mask(bgr):
    h, w = bgr.shape[:2]
    mask = np.zeros((h, w), dtype=np.uint8)

    lm = None
    if HAS_MP:
        try:
            rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
            with mp.solutions.face_mesh.FaceMesh(
                static_image_mode=True, max_num_faces=1,
                refine_landmarks=True, min_detection_confidence=0.4,
            ) as mesh:
                res = mesh.process(rgb)
                if res.multi_face_landmarks:
                    lm = res.multi_face_landmarks[0].landmark
        except Exception:
            pass

    if lm is not None:
        FACE_OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
                     397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
                     172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109]
        oval = np.array([[int(lm[i].x * w), int(lm[i].y * h)] for i in FACE_OVAL], np.int32)
        cv2.fillPoly(mask, [oval], 255)
        face_top = oval[:, 1].min()
        face_bot = oval[:, 1].max()
        chin_ext = int((face_bot - face_top) * 0.08)
        chin_y = int(lm[152].y * h)
        chin_x = int(lm[152].x * w)
        cv2.ellipse(mask, (chin_x, chin_y), (int((face_bot - face_top) * 0.25), chin_ext),
                    0, 0, 180, 255, -1)
        face_bot = min(h, face_bot + chin_ext)
        face_left = oval[:, 0].min()
        face_right = oval[:, 0].max()
        face_height = face_bot - face_top
        face_width = face_right - face_left
        pad = int(face_height * 0.06)

        brow_top = int(min(lm[i].y for i in [46, 53, 52, 65, 55, 276, 283, 282, 295, 285]) * h)
        lip_top = int(min(lm[i].y for i in [0, 37, 39, 40, 185, 267, 269, 270]) * h)
        lip_bot = int(max(lm[i].y for i in [17, 84, 181, 91, 314, 405, 321]) * h)
        lip_left = int(min(lm[i].x for i in [61, 78, 191, 80, 81, 82]) * w)
        lip_right = int(max(lm[i].x for i in [291, 308, 415, 310, 311, 312]) * w)

        forehead_cx = int(lm[10].x * w)
        forehead_cy = brow_top - pad
        forehead_rx = int(face_width * 0.55)
        forehead_ry = forehead_cy - face_top + int(face_height * 0.05)
        hair_mask = np.zeros((h, w), dtype=np.uint8)
        cv2.ellipse(hair_mask, (forehead_cx, forehead_cy),
                    (forehead_rx, forehead_ry), 0, 180, 360, 255, -1)
        hair_mask[:max(0, forehead_cy - forehead_ry), :] = 255
        mask[hair_mask > 0] = 0

        l_eye_left = int(min(lm[i].x for i in [33, 246, 161, 160, 159]) * w)
        l_eye_right = int(max(lm[i].x for i in [133, 155, 154, 153]) * w)
        l_brow_top = int(min(lm[i].y for i in [46, 53, 52, 65, 55]) * h)
        l_eye_bot = int(max(lm[i].y for i in [145, 144, 153, 154, 155]) * h)
        ex_pad = int(face_width * 0.04)
        ey_pad = pad
        mask[l_brow_top - ey_pad:l_eye_bot + ey_pad,
             l_eye_left - ex_pad:l_eye_right + ex_pad] = 0

        r_eye_left = int(min(lm[i].x for i in [263, 466, 388, 387, 386]) * w)
        r_eye_right = int(max(lm[i].x for i in [362, 382, 381, 380]) * w)
        r_brow_top = int(min(lm[i].y for i in [276, 283, 282, 295, 285]) * h)
        r_eye_bot = int(max(lm[i].y for i in [374, 373, 380, 381, 382]) * h)
        mask[r_brow_top - ey_pad:r_eye_bot + ey_pad,
             r_eye_left - ex_pad:r_eye_right + ex_pad] = 0

        lip_pad_x = int((lip_right - lip_left) * 0.10)
        lip_pad_y = int(pad * 0.3)
        mask[max(0, lip_top - lip_pad_y):min(h, lip_bot + lip_pad_y),
             max(0, lip_left - lip_pad_x):min(w, lip_right + lip_pad_x)] = 0

        l_border = face_left + int(face_width * 0.07)
        r_border = face_right - int(face_width * 0.05)
        mask[:, :l_border] = 0
        mask[:, r_border:] = 0
    else:
        cx, cy = w // 2, int(h * 0.44)
        rx, ry = int(w * 0.36), int(h * 0.40)
        cv2.ellipse(mask, (cx, cy), (rx, ry), 0, 0, 360, 255, -1)
        face_height = ry * 2
        face_width = rx * 2
        face_top = cy - ry
        face_bot = cy + ry
        face_left = cx - rx
        mask[face_top:face_top + int(face_height * 0.18), :] = 0
        eye_y1 = face_top + int(face_height * 0.35)
        mask[eye_y1:face_top + int(face_height * 0.55), :] = 0
        lip_y1 = face_top + int(face_height * 0.78)
        lip_x1 = face_left + int(face_width * 0.25)
        mask[lip_y1:face_top + int(face_height * 0.88),
             lip_x1:face_left + int(face_width * 0.75)] = 0

    be = max(8, int(min(w, h) * 0.03))
    mask = cv2.erode(mask, cv2.getStructuringElement(
        cv2.MORPH_ELLIPSE, (be * 2 + 1, be * 2 + 1)))
    mask = cv2.bitwise_and(mask, _skin_color(bgr))
    return mask


def detect_spots(bgr, skin_mask, cell_size=4, neighborhood=9,
                 dark_threshold=13.0, red_threshold=9.0, min_cluster=3,
                 max_spots=15, min_compactness=0.25):
    h, w = bgr.shape[:2]
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)
    L = lab[:, :, 0].astype(np.float32)
    A = lab[:, :, 1].astype(np.float32)

    rows, cols = h // cell_size, w // cell_size
    cell_L = np.full((rows, cols), np.nan, np.float32)
    cell_A = np.full((rows, cols), np.nan, np.float32)
    cell_ok = np.zeros((rows, cols), bool)

    for r in range(rows):
        for c in range(cols):
            y1, y2 = r * cell_size, (r + 1) * cell_size
            x1, x2 = c * cell_size, (c + 1) * cell_size
            sp = skin_mask[y1:y2, x1:x2]
            if sp.mean() / 255.0 < 0.7:
                continue
            cell_ok[r, c] = True
            sw = sp > 0
            cell_L[r, c] = L[y1:y2, x1:x2][sw].mean()
            cell_A[r, c] = A[y1:y2, x1:x2][sw].mean()

    pad = neighborhood // 2
    dark_score = np.zeros((rows, cols), np.float32)
    red_score = np.zeros((rows, cols), np.float32)

    for r in range(rows):
        for c in range(cols):
            if not cell_ok[r, c]:
                continue
            r1, r2 = max(0, r - pad), min(rows, r + pad + 1)
            c1, c2 = max(0, c - pad), min(cols, c + pad + 1)
            nm = cell_ok[r1:r2, c1:c2]
            if nm.sum() < 6:
                continue
            nl = np.nanmean(cell_L[r1:r2, c1:c2][nm])
            diff_l = nl - cell_L[r, c]
            if diff_l > dark_threshold:
                dark_score[r, c] = diff_l
            na = np.nanmean(cell_A[r1:r2, c1:c2][nm])
            diff_a = cell_A[r, c] - na
            if diff_a > red_threshold:
                red_score[r, c] = diff_a

    dets = []
    for scores, stype in [(dark_score, "dark"), (red_score, "red")]:
        binary = (scores > 0).astype(np.uint8) * 255
        nl, lb, st, ct = cv2.connectedComponentsWithStats(binary, connectivity=8)
        for i in range(1, nl):
            area = st[i, cv2.CC_STAT_AREA]
            if area < min_cluster:
                continue
            bw = st[i, cv2.CC_STAT_WIDTH]
            bh = st[i, cv2.CC_STAT_HEIGHT]
            aspect = min(bw, bh) / max(bw, bh) if max(bw, bh) > 0 else 0
            if aspect < min_compactness:
                continue
            fill = area / (bw * bh) if bw * bh > 0 else 0
            if fill < 0.2:
                continue
            bx, by = st[i, cv2.CC_STAT_LEFT], st[i, cv2.CC_STAT_TOP]
            cx = int((bx + bw / 2) * cell_size)
            cy = int((by + bh / 2) * cell_size)
            component_mask = lb[by:by + bh, bx:bx + bw] == i
            region = scores[by:by + bh, bx:bx + bw]
            severity = float(region[component_mask].mean())
            dets.append((cx, cy, area, severity, stype))

    dets.sort(key=lambda d: d[3], reverse=True)
    return dets[:max_spots]


def _draw_dashed_curve(img, points, color, thickness, dash_len=10, gap_len=8):
    drawing = True
    count = 0
    for i in range(len(points) - 1):
        if drawing:
            cv2.line(img, tuple(points[i]), tuple(points[i + 1]), color, thickness, cv2.LINE_AA)
        count += 1
        if drawing and count >= dash_len:
            drawing = False
            count = 0
        elif not drawing and count >= gap_len:
            drawing = True
            count = 0


def _cheek_contour(cx, cy, rw, rh):
    def bezier(p0, p1, p2, steps=40):
        pts = []
        for i in range(steps + 1):
            t = i / steps
            x = (1-t)**2 * p0[0] + 2*(1-t)*t * p1[0] + t**2 * p2[0]
            y = (1-t)**2 * p0[1] + 2*(1-t)*t * p1[1] + t**2 * p2[1]
            pts.append([int(x), int(y)])
        return pts

    top_l = (cx - rw, cy - rh * 0.6)
    top_r = (cx + rw, cy - rh * 0.6)
    top_mid = (cx, cy - rh * 0.75)
    bot = (cx, cy + rh * 0.8)
    bot_ctrl_l = (cx - rw * 0.35, cy + rh * 0.6)
    bot_ctrl_r = (cx + rw * 0.35, cy + rh * 0.6)
    mid_l = (cx - rw * 0.85, cy + rh * 0.1)
    mid_r = (cx + rw * 0.85, cy + rh * 0.1)

    points = []
    points += bezier(top_l, top_mid, top_r, 50)
    points += bezier(top_r, mid_r, bot_ctrl_r, 40)
    points += bezier(bot_ctrl_r, bot, bot_ctrl_l, 30)
    points += bezier(bot_ctrl_l, mid_l, top_l, 40)
    points.append(points[0])
    return points


def draw_cheek_zones(img, skin_mask, thickness):
    h, w = img.shape[:2]
    rows_any = np.any(skin_mask > 0, axis=1)
    cols_any = np.any(skin_mask > 0, axis=0)
    if not rows_any.any():
        return
    y_min, y_max = np.where(rows_any)[0][[0, -1]]
    x_min, x_max = np.where(cols_any)[0][[0, -1]]

    face_w = x_max - x_min
    face_h = y_max - y_min
    face_cx = (x_min + x_max) // 2

    rw = int(face_w * 0.13)
    rh = int(face_h * 0.10)
    offset_x = int(face_w * 0.28)
    cheek_cy = y_min + int(face_h * 0.68)

    color = (0, 0, 255)
    left_pts = _cheek_contour(face_cx - offset_x, cheek_cy, rw, rh)
    right_pts = _cheek_contour(face_cx + offset_x, cheek_cy, rw, rh)
    _draw_dashed_curve(img, left_pts, color, thickness)
    _draw_dashed_curve(img, right_pts, color, thickness)


def analyze(bgr):
    """Run full detection pipeline. Returns (annotated_bgr, detections_list)."""
    skin_mask = build_skin_mask(bgr)
    dets = detect_spots(bgr, skin_mask)

    random.seed(42)
    out = bgr.copy()
    draw_cheek_zones(out, skin_mask, 3)

    for cx, cy, area, severity, stype in dets:
        r = 24 + random.randint(-3, 3)
        cv2.circle(out, (cx, cy), r, (0, 0, 255), 3)

    spots = [
        {
            "x": int(cx), "y": int(cy),
            "x_pct": round(cx / bgr.shape[1] * 100, 2),
            "y_pct": round(cy / bgr.shape[0] * 100, 2),
            "type": stype, "severity": round(severity, 2),
        }
        for cx, cy, area, severity, stype in dets
    ]
    return out, spots
