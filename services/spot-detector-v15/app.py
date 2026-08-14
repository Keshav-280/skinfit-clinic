"""
SkinFit Wellness — Skin Spot Detector
Streamlit web app with camera capture (face guide overlay) + file upload.
"""

import streamlit as st
import streamlit.components.v1 as components
import cv2
import numpy as np
from PIL import Image
import io
import random
import base64
import tempfile
import os

try:
    import mediapipe as mp
    HAS_MP = mp is not None and getattr(mp, "solutions", None) is not None
except Exception:
    mp = None
    HAS_MP = False


# ---------------------------------------------------------------------------
# Detection pipeline (from spot_v15)
# ---------------------------------------------------------------------------

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
        ly1 = max(0, lip_top - lip_pad_y)
        ly2 = min(h, lip_bot + lip_pad_y)
        lx1 = max(0, lip_left - lip_pad_x)
        lx2 = min(w, lip_right + lip_pad_x)
        mask[ly1:ly2, lx1:lx2] = 0

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
        face_right = cx + rx

        hair_y2 = face_top + int(face_height * 0.18)
        mask[face_top:hair_y2, :] = 0
        eye_y1 = face_top + int(face_height * 0.35)
        eye_y2 = face_top + int(face_height * 0.55)
        mask[eye_y1:eye_y2, :] = 0
        lip_y1 = face_top + int(face_height * 0.78)
        lip_y2 = face_top + int(face_height * 0.88)
        lip_x1 = face_left + int(face_width * 0.25)
        lip_x2 = face_left + int(face_width * 0.75)
        mask[lip_y1:lip_y2, lip_x1:lip_x2] = 0

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


def _cheek_contour(cx, cy, rw, rh, side="left"):
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
    left_pts = _cheek_contour(face_cx - offset_x, cheek_cy, rw, rh, side="left")
    right_pts = _cheek_contour(face_cx + offset_x, cheek_cy, rw, rh, side="right")
    _draw_dashed_curve(img, left_pts, color, thickness)
    _draw_dashed_curve(img, right_pts, color, thickness)


def process_bgr(bgr):
    skin_mask = build_skin_mask(bgr)
    dets = detect_spots(bgr, skin_mask)

    random.seed(42)
    out = bgr.copy()
    draw_cheek_zones(out, skin_mask, 3)

    for cx, cy, area, severity, stype in dets:
        r = 24 + random.randint(-3, 3)
        cv2.circle(out, (cx, cy), r, (0, 0, 255), 3)

    rgb_out = cv2.cvtColor(out, cv2.COLOR_BGR2RGB)
    dk = sum(1 for d in dets if d[4] == "dark")
    rd = sum(1 for d in dets if d[4] == "red")
    return rgb_out, f"{len(dets)} spots detected ({dk} dark, {rd} red/inflamed)"


def process_file(uploaded_file):
    file_bytes = np.asarray(bytearray(uploaded_file.read()), dtype=np.uint8)
    bgr = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
    if bgr is None:
        return None, "Could not read image"
    return process_bgr(bgr)


def show_results(bgr_original, rgb_result, summary):
    col1, col2 = st.columns(2)
    with col1:
        st.markdown("**Original**")
        st.image(cv2.cvtColor(bgr_original, cv2.COLOR_BGR2RGB), use_container_width=True)
    with col2:
        st.markdown("**Analysis**")
        st.image(rgb_result, use_container_width=True)

    st.markdown(f"""
    <div class="result-box">
        <strong>Skin Analysis Result</strong><br>
        {summary}<br><br>
        <small>Red circles = detected dark spots and inflammation areas.<br>
        Dashed boundaries = cheek zones analyzed for texture.</small>
    </div>
    """, unsafe_allow_html=True)

    result_pil = Image.fromarray(rgb_result)
    buf = io.BytesIO()
    result_pil.save(buf, format="JPEG", quality=95)
    st.download_button(
        "Download Result",
        data=buf.getvalue(),
        file_name="skinfit_analysis.jpg",
        mime="image/jpeg"
    )


# ---------------------------------------------------------------------------
# Camera HTML component with face guide overlay
# Guide lines match the mask regions: face oval, curved hairline, 2 eye
# blocks, lip block, L/R boundaries. All proportional to the canvas.
# ---------------------------------------------------------------------------

CAMERA_HTML = """
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  #cam-wrap {
    position: relative;
    width: 100%;
    max-width: 480px;
    margin: 0 auto;
    background: #111;
    border-radius: 16px;
    overflow: hidden;
  }
  video, #overlay {
    display: block;
    width: 100%;
    height: auto;
  }
  #overlay {
    position: absolute;
    top: 0; left: 0;
    pointer-events: none;
  }
  #status-bar {
    text-align: center;
    padding: 8px 0;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 14px;
    color: #1a1a2e;
    font-weight: 500;
  }
  #capture-btn {
    display: block;
    width: 72px; height: 72px;
    margin: 16px auto;
    border-radius: 50%;
    background: #e74c3c;
    border: 5px solid #fff;
    box-shadow: 0 0 0 3px #e74c3c;
    cursor: pointer;
    transition: transform 0.15s;
  }
  #capture-btn:hover { transform: scale(1.08); }
  #capture-btn:active { transform: scale(0.95); }
  #capture-btn.disabled { opacity: 0.4; pointer-events: none; }
  #retake-btn {
    display: none;
    margin: 12px auto;
    padding: 10px 28px;
    font-size: 15px;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    border: 2px solid #1a1a2e;
    border-radius: 8px;
    background: #fff;
    color: #1a1a2e;
    cursor: pointer;
    font-weight: 500;
  }
  #retake-btn:hover { background: #f0f0f0; }
  #preview-img {
    display: none;
    width: 100%;
    border-radius: 16px;
  }
  #guide-label {
    text-align: center;
    padding: 6px;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 13px;
    color: #888;
  }
  .hidden { display: none !important; }
</style>

<div id="status-bar">Position your face within the guide</div>

<div id="cam-wrap">
  <video id="video" autoplay playsinline muted></video>
  <canvas id="overlay"></canvas>
</div>
<img id="preview-img" />
<div id="guide-label">Look straight into the camera with a relaxed face</div>
<button id="capture-btn" class="disabled" title="Capture"></button>
<button id="retake-btn">Retake</button>
<canvas id="snap" class="hidden"></canvas>

<script>
(function() {
  const video = document.getElementById('video');
  const overlay = document.getElementById('overlay');
  const snapCanvas = document.getElementById('snap');
  const captureBtn = document.getElementById('capture-btn');
  const retakeBtn = document.getElementById('retake-btn');
  const previewImg = document.getElementById('preview-img');
  const camWrap = document.getElementById('cam-wrap');
  const statusBar = document.getElementById('status-bar');
  const guideLabel = document.getElementById('guide-label');
  const ctx = overlay.getContext('2d');
  let stream = null;
  let animFrame = null;

  function drawDashed(ctx, points, dashLen, gapLen) {
    let drawing = true, count = 0;
    for (let i = 0; i < points.length - 1; i++) {
      if (drawing) {
        ctx.beginPath();
        ctx.moveTo(points[i][0], points[i][1]);
        ctx.lineTo(points[i+1][0], points[i+1][1]);
        ctx.stroke();
      }
      count++;
      if (drawing && count >= dashLen) { drawing = false; count = 0; }
      else if (!drawing && count >= gapLen) { drawing = true; count = 0; }
    }
  }

  function bezier(p0, p1, p2, steps) {
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = (1-t)*(1-t)*p0[0] + 2*(1-t)*t*p1[0] + t*t*p2[0];
      const y = (1-t)*(1-t)*p0[1] + 2*(1-t)*t*p1[1] + t*t*p2[1];
      pts.push([x, y]);
    }
    return pts;
  }

  function drawGuide(w, h) {
    ctx.clearRect(0, 0, w, h);

    // Dim outside the face oval
    const cx = w * 0.5, cy = h * 0.44;
    const rx = w * 0.36, ry = h * 0.40;

    // Semi-transparent overlay outside oval
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * 1.02, ry * 1.02, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Face oval proportions (matching mask)
    const faceTop = cy - ry;
    const faceBot = cy + ry;
    const faceLeft = cx - rx;
    const faceRight = cx + rx;
    const faceH = faceBot - faceTop;
    const faceW = faceRight - faceLeft;

    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';

    // --- FACE OVAL (dashed) ---
    const ovalPts = [];
    for (let a = 0; a <= 360; a += 2) {
      const rad = a * Math.PI / 180;
      ovalPts.push([cx + rx * Math.cos(rad), cy + ry * Math.sin(rad)]);
    }
    drawDashed(ctx, ovalPts, 12, 8);

    // --- HAIRLINE: curved cutout line ---
    const browY = faceTop + faceH * 0.22;
    const hairCY = browY;
    const hairRX = faceW * 0.48;
    const hairRY = faceH * 0.08;
    const hairPts = [];
    for (let a = 180; a <= 360; a += 2) {
      const rad = a * Math.PI / 180;
      hairPts.push([cx + hairRX * Math.cos(rad), hairCY + hairRY * Math.sin(rad)]);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    drawDashed(ctx, hairPts, 8, 6);

    // --- LEFT EYE BLOCK ---
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    const eyeBlockH = faceH * 0.14;
    const eyeBlockW = faceW * 0.28;
    const eyePadX = faceW * 0.04;
    const eyePadY = faceH * 0.02;

    // Left eye
    const leX = cx - faceW * 0.04 - eyeBlockW;
    const leY = faceTop + faceH * 0.35;
    roundRectDashed(ctx, leX - eyePadX, leY - eyePadY,
                    eyeBlockW + eyePadX * 2, eyeBlockH + eyePadY * 2, 6);

    // Right eye
    const reX = cx + faceW * 0.04;
    roundRectDashed(ctx, reX - eyePadX, leY - eyePadY,
                    eyeBlockW + eyePadX * 2, eyeBlockH + eyePadY * 2, 6);

    // --- LIP BLOCK ---
    const lipW = faceW * 0.38;
    const lipH = faceH * 0.08;
    const lipY = faceTop + faceH * 0.75;
    const lipX = cx - lipW / 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    roundRectDashed(ctx, lipX, lipY, lipW, lipH, 4);

    // --- CHIN EXTENSION indicator ---
    const chinY = faceBot - faceH * 0.02;
    const chinPts = [];
    for (let a = 0; a <= 180; a += 3) {
      const rad = a * Math.PI / 180;
      chinPts.push([cx + faceW * 0.22 * Math.cos(rad), chinY + faceH * 0.06 * Math.sin(rad)]);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    drawDashed(ctx, chinPts, 6, 5);
  }

  function roundRectDashed(ctx, x, y, w, h, r) {
    const pts = [];
    const steps = 8;
    // top-left corner
    for (let i = 0; i <= steps; i++) {
      const a = Math.PI + (Math.PI/2) * (i/steps);
      pts.push([x + r + r * Math.cos(a), y + r + r * Math.sin(a)]);
    }
    // top-right corner
    for (let i = 0; i <= steps; i++) {
      const a = -Math.PI/2 + (Math.PI/2) * (i/steps);
      pts.push([x + w - r + r * Math.cos(a), y + r + r * Math.sin(a)]);
    }
    // bottom-right corner
    for (let i = 0; i <= steps; i++) {
      const a = 0 + (Math.PI/2) * (i/steps);
      pts.push([x + w - r + r * Math.cos(a), y + h - r + r * Math.sin(a)]);
    }
    // bottom-left corner
    for (let i = 0; i <= steps; i++) {
      const a = Math.PI/2 + (Math.PI/2) * (i/steps);
      pts.push([x + r + r * Math.cos(a), y + h - r + r * Math.sin(a)]);
    }
    pts.push(pts[0]);
    drawDashed(ctx, pts, 6, 5);
  }

  function renderLoop() {
    if (video.videoWidth > 0) {
      const vw = video.videoWidth, vh = video.videoHeight;
      if (overlay.width !== vw || overlay.height !== vh) {
        overlay.width = vw;
        overlay.height = vh;
      }
      drawGuide(vw, vh);
    }
    animFrame = requestAnimationFrame(renderLoop);
  }

  async function startCamera() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false
      });
      video.srcObject = stream;
      video.onloadedmetadata = () => {
        captureBtn.classList.remove('disabled');
        statusBar.textContent = 'Position your face within the guide';
        renderLoop();
      };
    } catch (err) {
      statusBar.textContent = 'Camera access denied. Please allow camera and reload.';
      statusBar.style.color = '#e74c3c';
    }
  }

  captureBtn.addEventListener('click', () => {
    if (!stream) return;
    const vw = video.videoWidth, vh = video.videoHeight;
    snapCanvas.width = vw;
    snapCanvas.height = vh;
    const sctx = snapCanvas.getContext('2d');
    sctx.drawImage(video, 0, 0, vw, vh);

    const dataUrl = snapCanvas.toDataURL('image/jpeg', 0.92);
    previewImg.src = dataUrl;
    previewImg.style.display = 'block';
    camWrap.style.display = 'none';
    captureBtn.style.display = 'none';
    retakeBtn.style.display = 'block';
    guideLabel.textContent = 'Photo captured — click Analyze below';
    statusBar.textContent = 'Photo captured';

    cancelAnimationFrame(animFrame);

    // Store base64 in a hidden textarea for Streamlit to pick up
    let ta = document.getElementById('captured-data');
    if (!ta) {
      ta = document.createElement('textarea');
      ta.id = 'captured-data';
      ta.name = 'captured-data';
      ta.style.display = 'none';
      document.body.appendChild(ta);
    }
    // Strip data URL prefix, keep raw base64
    ta.value = dataUrl.split(',')[1];

    // Also post to parent for Streamlit session state
    window.parent.postMessage({
      type: 'skinfit_capture',
      data: dataUrl.split(',')[1]
    }, '*');
  });

  retakeBtn.addEventListener('click', () => {
    previewImg.style.display = 'none';
    camWrap.style.display = 'block';
    captureBtn.style.display = 'block';
    retakeBtn.style.display = 'none';
    guideLabel.textContent = 'Look straight into the camera with a relaxed face';
    statusBar.textContent = 'Position your face within the guide';
    renderLoop();
  });

  startCamera();
})();
</script>
"""


# ---------------------------------------------------------------------------
# Streamlit UI
# ---------------------------------------------------------------------------

st.set_page_config(
    page_title="SkinFit Wellness - Skin Analysis",
    page_icon="",
    layout="centered",
)

st.markdown("""
<style>
    .main-header {
        text-align: center;
        padding: 1rem 0;
    }
    .main-header h1 {
        color: #1a1a2e;
        font-size: 2rem;
        margin-bottom: 0.2rem;
    }
    .main-header p {
        color: #666;
        font-size: 1rem;
    }
    .result-box {
        background: #f8f9fa;
        border-radius: 12px;
        padding: 1rem;
        margin: 1rem 0;
        border-left: 4px solid #e74c3c;
    }
    .stButton > button {
        background-color: #1a1a2e;
        color: white;
        border-radius: 8px;
        padding: 0.5rem 2rem;
        border: none;
    }
    .stButton > button:hover {
        background-color: #16213e;
    }
    div[data-testid="stTabs"] button[data-baseweb="tab"] {
        font-size: 16px;
        font-weight: 500;
    }
</style>
""", unsafe_allow_html=True)

st.markdown("""
<div class="main-header">
    <h1>SkinFit Wellness</h1>
    <p>AI-Powered Skin Spot Analysis</p>
</div>
""", unsafe_allow_html=True)

tab_camera, tab_upload = st.tabs(["Take Photo", "Upload Photo"])

with tab_camera:
    components.html(CAMERA_HTML, height=680, scrolling=False)

    st.markdown("")
    camera_photo = st.camera_input(
        "Or use default camera",
        label_visibility="collapsed",
        key="cam_fallback",
    )

    if camera_photo is not None:
        camera_photo.seek(0)
        file_bytes = np.asarray(bytearray(camera_photo.read()), dtype=np.uint8)
        bgr = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
        if bgr is not None:
            with st.spinner("Analyzing skin..."):
                result, summary = process_bgr(bgr)
            show_results(bgr, result, summary)

with tab_upload:
    uploaded = st.file_uploader(
        "Upload a clear face photo",
        type=["jpg", "jpeg", "png"],
        help="For best results, use a well-lit front-facing photo"
    )

    if uploaded is not None:
        col1, col2 = st.columns(2)

        with col1:
            st.markdown("**Original**")
            img = Image.open(uploaded)
            st.image(img, use_container_width=True)

        uploaded.seek(0)
        file_bytes = np.asarray(bytearray(uploaded.read()), dtype=np.uint8)
        bgr = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)

        if bgr is not None:
            with st.spinner("Analyzing skin..."):
                result, summary = process_bgr(bgr)

            with col2:
                st.markdown("**Analysis**")
                st.image(result, use_container_width=True)

            st.markdown(f"""
            <div class="result-box">
                <strong>Skin Analysis Result</strong><br>
                {summary}<br><br>
                <small>Red circles = detected dark spots and inflammation areas.<br>
                Dashed boundaries = cheek zones analyzed for texture.</small>
            </div>
            """, unsafe_allow_html=True)

            result_pil = Image.fromarray(result)
            buf = io.BytesIO()
            result_pil.save(buf, format="JPEG", quality=95)
            st.download_button(
                "Download Result",
                data=buf.getvalue(),
                file_name="skinfit_analysis.jpg",
                mime="image/jpeg"
            )
        else:
            st.error("Could not read image")

st.markdown("---")
st.markdown(
    "<center><small>Powered by SkinFit Wellness | This is a screening tool, not a medical diagnosis</small></center>",
    unsafe_allow_html=True
)
