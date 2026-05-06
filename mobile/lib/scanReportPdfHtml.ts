import { formatDistanceToNow } from "date-fns";

const PEACH = "#F29C91";
const TEAL_BAND = "#E0EEEB";
const BEIGE = "#F5F1E9";

const CAUSES_P1 =
  "Environmental factors such as UV exposure, seasonal dryness, and urban pollution can accentuate texture irregularities and uneven tone. A consistent barrier-focused routine helps mitigate these stressors.";
const CAUSES_P2 =
  "Hormonal shifts, stress, and sleep patterns may also influence oil balance and sensitivity. Tracking flare-ups alongside lifestyle changes gives clearer insight into your skin's triggers.";

const OVERVIEW_P2 =
  "Maintaining gentle cleansing, daily photoprotection, and targeted hydration supports long-term barrier health and helps preserve the improvements shown in your latest scan.";

/** Same links as web `SkinScanReportBody` PDF section (text-only in PDF). */
const RECOMMENDED_VIDEOS: { label: string; href: string }[] = [
  { label: "Routine basics", href: "https://www.youtube.com/watch?v=placeholder1" },
  { label: "Hydration tips", href: "https://www.youtube.com/watch?v=placeholder2" },
  { label: "Barrier care", href: "https://www.youtube.com/watch?v=placeholder3" },
  { label: "Sun protection", href: "https://www.youtube.com/watch?v=placeholder4" },
];

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function clamp(n: number) {
  return Math.min(100, Math.max(0, Math.round(n)));
}

function regionMarkerColor(issue: string): string {
  const x = issue.toLowerCase();
  if (x.includes("acne")) return "#dc2626";
  if (x.includes("wrinkle")) return "#7c3aed";
  if (x.includes("pigment")) return "#d97706";
  if (x.includes("texture")) return "#0d9488";
  return "#6b7280";
}

function clinicalBarPct(score: number): number {
  return Math.min(100, Math.max(0, ((score - 1) / 4) * 100));
}

/** SVG ring donut (stroke-dash), matches web `Donut` behavior. */
function donutSvg(
  percent: number,
  size: number,
  stroke: number,
  color: string,
  track: string
): string {
  const p = clamp(percent);
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - p / 100);
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" style="-webkit-transform:rotate(-90deg);transform:rotate(-90deg)"><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${track}" stroke-width="${stroke}"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${c.toFixed(3)}" stroke-dashoffset="${offset.toFixed(3)}"/></svg>`;
}

export type ScanReportPdfPayload = {
  userName: string;
  userAge: number;
  userSkinType: string;
  scanTitle: string | null;
  /** Embedded capture(s); order matches web face-capture gallery. */
  photos: Array<{ label: string; dataUri: string }>;
  metrics: {
    acne: number;
    hydration: number;
    wrinkles: number;
    overall_score: number;
    pigmentation: number;
    texture: number;
    clinical_scores?: {
      active_acne?: number;
      skin_quality?: number;
      wrinkle_severity?: number;
      sagging_volume?: number;
      under_eye?: number;
      hair_health?: number;
      pigmentation_model?: number | null;
    };
  };
  aiSummary: string | null;
  scanDateIso: string;
  /** Data URI for overlay image when available. */
  annotatedDataUri?: string;
  regions: Array<{ issue: string; coordinates: { x: number; y: number } }>;
};

type ClinicalKey = keyof NonNullable<ScanReportPdfPayload["metrics"]["clinical_scores"]>;

const CLINICAL_ROWS: { key: ClinicalKey; label: string }[] = [
  { key: "active_acne", label: "Active acne" },
  { key: "skin_quality", label: "Skin quality" },
  { key: "wrinkle_severity", label: "Wrinkles (severity 1–5)" },
  { key: "sagging_volume", label: "Sagging & volume" },
  { key: "under_eye", label: "Under-eye" },
  { key: "hair_health", label: "Hair health" },
  { key: "pigmentation_model", label: "Pigmentation (model)" },
];

/**
 * HTML for expo-print. Aligns with web `SkinScanReportBody` PDF sections:
 * (1) captures + annotated findings, (2) report + 3 donuts + clinical + skin health + teal,
 * (3) recommended video links.
 */
export function buildScanReportPdfHtml(p: ScanReportPdfPayload): string {
  const photos = p.photos.length > 0 ? p.photos : [];
  const overall = clamp(p.metrics.overall_score);
  const heroIntro =
    p.aiSummary?.trim() ||
    `Your latest scan shows an overall score of ${overall}% on our 0–100 scale (higher is better). Detailed scores and photo markers are below.`;
  const displayTitle = (() => {
    const raw = p.scanTitle?.trim() ?? "";
    if (!raw) return "";
    const stripped = raw
      .replace(/^ai\s*skin\s*scan\s*[–-]\s*/i, "")
      .replace(/^ai\s*skin\s*analysis\s*$/i, "");
    return stripped || "";
  })();

  const scanDate = new Date(p.scanDateIso);
  const lastScanLabel = formatDistanceToNow(scanDate, { addSuffix: true });
  const overview =
    p.aiSummary?.trim()
      ? "Use the clinical bars and photo markers to see what this scan emphasized. Compare future scans for trends—this is educational, not a medical diagnosis."
      : "Your skin shows a balanced profile with room to optimize hydration and maintain clarity. Continue tracking changes after each scan to spot trends early.";

  const overlayUrl = p.annotatedDataUri?.trim() || "";
  const basePhotoUri = photos[0]?.dataUri ?? "";
  const showAnnotatedSection =
    overlayUrl.length > 0 || (p.regions.length > 0 && basePhotoUri.length > 0);
  const showDotMarkers = overlayUrl.length === 0 && p.regions.length > 0;
  const annotSrc = overlayUrl || basePhotoUri;
  const annotSrcJson = JSON.stringify(annotSrc);

  const row2 = photos.slice(0, 2);
  const row3 = photos.slice(2, 5);

  let galleryHtml = "";
  if (photos.length === 0) {
    galleryHtml = `<p class="muted">No face capture images for this scan.</p>`;
  } else if (photos.length === 1) {
    const ph = photos[0]!;
    galleryHtml = `
      <div class="cap-single">
        <figure>
          <div class="cap-frame cap-frame-lg"><img src=${JSON.stringify(ph.dataUri)} alt=${JSON.stringify(ph.label)} /></div>
          <figcaption>${esc(ph.label)}</figcaption>
        </figure>
      </div>`;
  } else if (photos.length > 1) {
    galleryHtml = `<p class="cap-kicker">Face captures</p>`;
    if (row2.length > 0) {
      galleryHtml += `<div class="cap-row2">`;
      for (const ph of row2) {
        galleryHtml += `<figure class="cap-fig"><div class="cap-frame cap-frame-sm"><img src=${JSON.stringify(ph.dataUri)} alt=${JSON.stringify(ph.label)} /></div><figcaption>${esc(ph.label)}</figcaption></figure>`;
      }
      galleryHtml += `</div>`;
    }
    if (row3.length > 0) {
      galleryHtml += `<div class="cap-row3">`;
      for (const ph of row3) {
        galleryHtml += `<figure class="cap-fig"><div class="cap-frame cap-frame-sm"><img src=${JSON.stringify(ph.dataUri)} alt=${JSON.stringify(ph.label)} /></div><figcaption>${esc(ph.label)}</figcaption></figure>`;
      }
      galleryHtml += `</div>`;
    }
  }

  let markersHtml = "";
  if (showDotMarkers) {
    for (const r of p.regions) {
      const col = regionMarkerColor(r.issue);
      markersHtml += `<div class="marker-dot" style="left:${r.coordinates.x}%;top:${r.coordinates.y}%;background:${col};"></div>`;
    }
  }

  const legendItems = ["Acne", "Wrinkle", "Pigmentation", "Texture"];
  let legendHtml = "";
  for (const label of legendItems) {
    legendHtml += `<li><span class="leg-dot" style="background:${regionMarkerColor(label)}"></span>${esc(label)}</li>`;
  }

  const metricDonuts = [
    { label: "Acne", value: p.metrics.acne, fill: "#5B8FD8", track: "rgba(91, 143, 216, 0.18)" },
    { label: "Hydration", value: p.metrics.hydration, fill: PEACH, track: "rgba(242, 156, 145, 0.22)" },
    { label: "Wrinkles", value: p.metrics.wrinkles, fill: "#9EC5E8", track: "rgba(158, 197, 232, 0.3)" },
  ];
  let threeDonutsHtml = "";
  for (const m of metricDonuts) {
    threeDonutsHtml += `<div class="md-cell"><div class="md-label">${esc(m.label)}</div><div class="md-row">${donutSvg(m.value, 40, 4.5, m.fill, m.track)}<span class="md-pct">${clamp(m.value)}%</span></div></div>`;
  }

  const cs = p.metrics.clinical_scores;
  let clinicalHtml = "";
  if (cs) {
    clinicalHtml = `<div class="clinical-block avoid-break">
      <p class="clinical-k">Model scores (1–5)</p>
      <p class="clinical-sub">Severity-style outputs from the analysis engine (higher = more concern). Shown alongside the summary scores above.</p>
      <div class="clinical-grid">`;
    for (const { key, label } of CLINICAL_ROWS) {
      const v = cs[key];
      if (key === "pigmentation_model") {
        if (v === undefined) continue;
        if (v === null) {
          clinicalHtml += `<div class="clinical-card clinical-card-muted"><span class="clinical-lbl">${esc(label)}</span><p class="clinical-na">No dataset available</p></div>`;
          continue;
        }
      }
      if (typeof v !== "number") continue;
      const pct = clinicalBarPct(v);
      clinicalHtml += `<div class="clinical-card"><div class="clinical-top"><span class="clinical-lbl">${esc(label)}</span><span class="clinical-val">${v.toFixed(1)}</span></div><div class="cbar"><div class="cbar-fill" style="width:${pct}%"></div></div></div>`;
    }
    clinicalHtml += `</div></div>`;
  }

  const videosHtml = RECOMMENDED_VIDEOS.map(
    (v) =>
      `<li><span class="vid-lbl">${esc(v.label)}: </span><span class="vid-href">${esc(v.href)}</span></li>`
  ).join("");

  let annotatedBlock = "";
  if (showAnnotatedSection && annotSrc.length > 0) {
    annotatedBlock = `
    <div class="annot-wrap avoid-break">
      <p class="cap-kicker">Annotated findings</p>
      <div class="annot-frame">
        <img src=${annotSrcJson} alt="Annotated scan" />
        ${markersHtml}
      </div>
      <ul class="legend">${legendHtml}</ul>
    </div>`;
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    * { box-sizing: border-box; }
    @page { margin: 10mm; }
    body {
      margin: 0;
      padding: 0;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
      background: ${BEIGE};
      color: #18181b;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .sheet { max-width: 720px; margin: 0 auto; background: ${BEIGE}; }
    .avoid-break { page-break-inside: avoid; break-inside: avoid; }
    .page-break-before { page-break-before: always; break-before: page; }
    .muted { text-align: center; color: #71717a; font-size: 14px; margin: 24px 0; }

    .sec1 {
      position: relative;
      padding: 36px 20px 40px;
      border-radius: 22px;
      border: 1px solid rgba(255,255,255,0.65);
      box-shadow: 0 32px 64px -12px rgba(0,0,0,0.14), 0 12px 24px -8px rgba(0,0,0,0.08);
      overflow: hidden;
    }
    .sec1::before {
      content: "";
      position: absolute; left: 0; right: 0; top: 0; height: 128px;
      background: linear-gradient(180deg, rgba(255,255,255,0.85) 0%, transparent 100%);
      pointer-events: none;
    }
    .cap-kicker {
      text-align: center;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: #71717a;
      margin: 0 0 20px;
    }
    .cap-single { text-align: center; margin-top: 8px; }
    .cap-single figcaption { margin-top: 8px; font-size: 11px; font-weight: 500; color: #52525b; }
    .cap-frame {
      margin: 0 auto;
      overflow: hidden;
      border-radius: 16px;
      background: #e4e4e7;
      border: 1px solid rgba(0,0,0,0.1);
    }
    .cap-frame-lg { width: 100%; max-width: 200px; aspect-ratio: 3/4; }
    .cap-frame-sm { width: 100%; max-width: 120px; aspect-ratio: 3/4; }
    .cap-frame img { width: 100%; height: 100%; object-fit: cover; object-position: center; display: block; }
    .cap-row2 {
      display: table; width: 100%; max-width: 420px; margin: 16px auto 0; table-layout: fixed;
    }
    .cap-row2 .cap-fig { display: table-cell; width: 50%; text-align: center; vertical-align: top; padding: 0 8px; }
    .cap-row3 {
      display: table; width: 100%; max-width: 420px; margin: 16px auto 0; table-layout: fixed;
    }
    .cap-row3 .cap-fig { display: table-cell; width: 33.33%; text-align: center; vertical-align: top; padding: 0 4px; }
    .cap-fig figcaption { margin-top: 6px; font-size: 9px; font-weight: 500; line-height: 1.25; color: #52525b; }

    .annot-wrap { margin-top: 36px; max-width: 320px; margin-left: auto; margin-right: auto; }
    .annot-hint { text-align: center; font-size: 11px; line-height: 1.4; color: #52525b; margin: 8px 0 0; }
    .annot-frame {
      position: relative;
      margin: 16px auto 0;
      width: 100%;
      max-width: 280px;
      aspect-ratio: 3/4;
      border-radius: 16px;
      overflow: hidden;
      background: #e4e4e7;
      border: 1px solid rgba(63,63,70,0.35);
    }
    .annot-frame img { width: 100%; height: 100%; object-fit: cover; object-position: center; display: block; }
    .marker-dot {
      position: absolute;
      width: 12px; height: 12px;
      margin-left: -6px; margin-top: -6px;
      border-radius: 50%;
      border: 2px solid #fff;
      box-shadow: 0 1px 4px rgba(0,0,0,0.2);
    }
    .legend {
      list-style: none;
      padding: 0;
      margin: 16px 0 0;
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 8px;
      font-size: 10px;
      color: #52525b;
    }
    .legend li {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 8px;
      border-radius: 999px;
      background: rgba(255,255,255,0.9);
      border: 1px solid rgba(228,228,231,0.9);
    }
    .leg-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }

    .sec2 { padding: 24px 20px 0; }
    @media (min-width: 640px) { .sec2 { padding-left: 32px; padding-right: 32px; } }
    .kicker {
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: #71717a;
    }
    h1 {
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 2rem;
      font-weight: 500;
      line-height: 1.15;
      margin: 8px 0 0;
      color: #18181b;
    }
    .age-line {
      margin-top: 16px;
      font-size: 13px;
      font-weight: 500;
      color: #52525b;
    }
    .body-copy {
      margin-top: 20px;
      font-size: 14px;
      line-height: 1.7;
      color: #52525b;
    }
    .md-grid {
      display: table;
      width: 100%;
      max-width: 560px;
      margin: 28px auto 0;
      table-layout: fixed;
    }
    .md-cell {
      display: table-cell;
      width: 33.33%;
      vertical-align: middle;
      padding: 4px 6px;
    }
    .md-label {
      font-size: 9px;
      font-weight: 600;
      text-align: center;
      color: #3f3f46;
      line-height: 1.2;
      margin-bottom: 6px;
    }
    .md-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 8px 4px;
      border-radius: 12px;
      border: 1px solid #fff;
      background: rgba(255,255,255,0.95);
    }
    .md-pct { font-size: 11px; font-weight: 600; color: #27272a; min-width: 32px; }

    .clinical-block { margin-top: 28px; max-width: 36rem; margin-left: auto; margin-right: auto; }
    .clinical-k { font-size: 10px; font-weight: 600; letter-spacing: 0.2em; text-transform: uppercase; color: #71717a; margin: 0; }
    .clinical-sub { margin: 6px 0 0; font-size: 12px; line-height: 1.45; color: #52525b; }
    .clinical-grid { margin-top: 14px; display: block; }
    .clinical-card {
      display: inline-block;
      width: 48%;
      vertical-align: top;
      margin: 0 1% 12px;
      padding: 10px 12px;
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,0.8);
      background: rgba(255,255,255,0.9);
      box-sizing: border-box;
    }
    .clinical-card-muted { background: rgba(255,255,255,0.6); }
    .clinical-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
    .clinical-lbl { font-size: 11px; font-weight: 600; color: #27272a; }
    .clinical-val { font-size: 12px; font-weight: 600; color: #18181b; }
    .clinical-na { margin: 6px 0 0; font-size: 10px; color: #71717a; }
    .cbar { margin-top: 6px; height: 8px; border-radius: 999px; background: rgba(228,228,231,0.95); overflow: hidden; }
    .cbar-fill { height: 100%; border-radius: 999px; background: #3f3f46; }

    .skin-card-wrap { margin-top: 28px; padding-bottom: 8px; }
    .skin-card {
      max-width: 32rem;
      margin: 0 auto;
      padding: 22px 22px;
      background: #fff;
      border-radius: 20px;
      border: 1px solid #fff;
      box-shadow: 0 24px 48px -12px rgba(0,0,0,0.12), 0 8px 16px -4px rgba(0,0,0,0.06);
    }
    .skin-row { display: table; width: 100%; }
    .skin-col-text { display: table-cell; vertical-align: middle; width: 55%; }
    .skin-col-donut { display: table-cell; vertical-align: middle; text-align: right; }
    .skin-lbl {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: #71717a;
    }
    .skin-big {
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 2.75rem;
      font-weight: 500;
      line-height: 1;
      color: ${PEACH};
      margin-top: 6px;
    }
    .skin-sub { margin-top: 8px; font-size: 12px; font-weight: 500; color: #71717a; }
    .donut-ring {
      display: inline-block;
      padding: 4px;
      border-radius: 50%;
      box-shadow: 0 4px 14px rgba(242,156,145,0.25);
      border: 1px solid rgba(0,0,0,0.18);
      background: #fff;
    }

    .teal {
      margin-top: 40px;
      padding: 40px 20px 44px;
      border-top: 1px solid #fff;
      background: linear-gradient(180deg, ${TEAL_BAND} 0%, #d8ebe6 100%);
    }
    .teal-rule {
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.95), transparent);
      margin-bottom: 22px;
    }
    .teal-two { display: table; width: 100%; }
    .teal-two > div {
      display: table-cell;
      width: 50%;
      vertical-align: top;
      padding-right: 16px;
    }
    .teal-two > div:last-child { padding-right: 0; padding-left: 16px; }
    @media (max-width: 639px) {
      .teal-two, .teal-two > div { display: block; width: 100%; padding: 0 !important; }
      .teal-two > div:first-child { margin-bottom: 28px; }
      .clinical-card { width: 100%; margin: 0 0 12px; }
    }
    .teal-bar { width: 32px; height: 3px; border-radius: 2px; background: #27272a; margin-bottom: 12px; }
    .teal-h {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: #27272a;
      margin: 0 0 14px;
    }
    .teal-p {
      font-size: 14px;
      line-height: 1.75;
      color: #3f3f46;
      margin: 0 0 14px;
    }

    .sec3 { padding: 24px 20px 32px; }
    .vid-box {
      border-radius: 12px;
      border: 1px solid rgba(228,228,231,0.9);
      background: rgba(255,255,255,0.85);
      padding: 16px 18px;
    }
    .vid-box > p { margin: 0 0 10px; font-size: 10px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: #18181b; }
    .vid-box ul { margin: 0; padding-left: 0; list-style: none; }
    .vid-box li { margin-top: 10px; font-size: 11px; line-height: 1.45; color: #3f3f46; }
    .vid-lbl { font-weight: 600; color: #18181b; }
    .vid-href { word-break: break-all; color: #52525b; }

    .foot {
      padding: 20px;
      text-align: center;
      font-size: 10px;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: #71717a;
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="sec1 avoid-break">
      ${photos.length === 1 ? `<p class="cap-kicker">Your scan photo</p>` : ""}
      ${galleryHtml}
      ${annotatedBlock}
    </div>

    <div class="sec2 page-break-before avoid-break">
      <p class="kicker">AI scan report</p>
      <h1>Hello ${esc(p.userName)}</h1>
      ${displayTitle ? `<p class="age-line" style="margin-top:8px;font-weight:600;color:#3f3f46">${esc(displayTitle)}</p>` : ""}
      <p class="age-line">Age: ${p.userAge} yrs <span style="color:#a1a1aa">·</span> Skin type: ${esc(p.userSkinType)}</p>
      <p class="body-copy">${esc(heroIntro)}</p>

      <div class="md-grid">${threeDonutsHtml}</div>

      ${clinicalHtml}

      <div class="skin-card-wrap avoid-break">
        <div class="skin-card">
          <div class="skin-row">
            <div class="skin-col-text">
              <div class="skin-lbl">Your Skin Health</div>
              <div class="skin-big">${overall}%</div>
              <div class="skin-sub">Last scan: ${esc(lastScanLabel)}</div>
            </div>
            <div class="skin-col-donut">
              <div class="donut-ring">${donutSvg(overall, 104, 9, PEACH, "#F0E4E1")}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="teal avoid-break">
        <div class="teal-rule"></div>
        <div class="teal-two">
          <div>
            <div class="teal-bar"></div>
            <h2 class="teal-h">Overview</h2>
            <p class="teal-p">${esc(overview)}</p>
            <p class="teal-p">${esc(OVERVIEW_P2)}</p>
          </div>
          <div>
            <div class="teal-bar"></div>
            <h2 class="teal-h">Causes/Challenges</h2>
            <p class="teal-p">${esc(CAUSES_P1)}</p>
            <p class="teal-p">${esc(CAUSES_P2)}</p>
          </div>
        </div>
      </div>
    </div>

    <div class="sec3 page-break-before avoid-break">
      <div class="vid-box">
        <p>Recommended videos</p>
        <ul>${videosHtml}</ul>
      </div>
    </div>

    <div class="foot">SkinnFit Clinic · AI scan report</div>
  </div>
</body>
</html>`;
}
