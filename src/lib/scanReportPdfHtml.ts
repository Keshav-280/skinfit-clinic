import { formatDistanceToNow } from "date-fns";

import { patientClarityToGrade, patientDisplayClarity } from "./clarityGrade";

import {
  legacyMaskTitleCropPercents,
  scanMaskPanelAspectCss,
  shouldCropLegacyMaskTitle,
  SCAN_FACE_FRAME_ASPECT_CSS,
} from "./maskImageCrop";
import { ONBOARDING_BASELINE_FOCUS_ACTIONS } from "./onboardingBaselineFocusActions";
import type { PatientTrackerReport } from "./patientTrackerReport.types";
import { presentTrackerReportNarrative } from "./patientTrackerLockedCopy";
import {
  trackerParamRowDisplayDelta,
  trackerWeeklyDeltaDisplay,
} from "./trackerDisplayDelta";
import {
  ACNE_MASK_PANEL_LABEL,
  DOT_MARKER_LEGEND,
  WRINKLE_MASK_PANEL_LABEL,
} from "./scanMaskLabels";
import {
  INCLUDE_TRACKER_RESOURCES_IN_REPORT,
  SCAN_REPORT_THEME as T,
  TRACKER_REPORT_THEME as R,
} from "./scanReportTheme";
import { scanReportPdfBackgroundCss } from "./scanReportPdfBackground";
import type { ScanSpatialOutputs } from "./spatialOutputs";
import {
  filterPatientVisibleParamRows,
  PATIENT_CLINICAL_DISPLAY_ROWS,
} from "./patientVisibleParams";

const CAUSES_P1 =
  "Environmental factors such as seasonal dryness and urban pollution can accentuate texture irregularities and uneven tone. A consistent barrier-focused routine helps mitigate these stressors.";
const CAUSES_P2 =
  "Hormonal shifts, stress, and sleep patterns may also influence oil balance and sensitivity. Tracking flare-ups alongside lifestyle changes gives clearer insight into your skin's triggers.";

const OVERVIEW_P2 =
  "Maintaining gentle cleansing, daily photoprotection, and targeted hydration supports long-term barrier health and helps preserve the improvements shown in your latest scan.";

export type ClinicalScores = {
  active_acne?: number;
  acne_scars?: number;
  skin_quality?: number;
  wrinkle_severity?: number;
  wrinkle_cls_severity?: number;
  wrinkle_seg_severity?: number;
  sagging_volume?: number;
  under_eye?: number;
  hair_health?: number;
  pigmentation_model?: number | null;
};

type ClinicalKey = keyof ClinicalScores;

export type ScanReportPdfPayload = {
  userName: string;
  userAge: number;
  userSkinType: string;
  scanTitle: string | null;
  photos: Array<{ label: string; dataUri: string }>;
  metrics: {
    acne: number;
    hydration: number;
    wrinkles: number;
    overall_score: number;
    pigmentation: number;
    texture: number;
    clinical_scores?: ClinicalScores;
  };
  aiSummary: string | null;
  scanDateIso: string;
  annotatedDataUri?: string;
  wrinkleMaskDataUri?: string;
  acneMaskDataUri?: string;
  wrinkleFallbackDataUri?: string;
  acneFallbackDataUri?: string;
  wrinklePoseLabel?: string;
  acnePoseLabel?: string;
  maskExportVersion?: number | null;
  spatialOutputs?: ScanSpatialOutputs;
  regions: Array<{ issue: string; coordinates: { x: number; y: number } }>;
  tracker?: PatientTrackerReport | null;
  /** When false (default), AI prose hides exact scores/deltas. */
  scoresUnlocked?: boolean;
};

const CLINICAL_ROWS = PATIENT_CLINICAL_DISPLAY_ROWS as { key: ClinicalKey; label: string }[];

const EIGHT_CLINICAL_DONUT_STYLE: Partial<
  Record<ClinicalKey, { fill: string; track: string }>
> = {
  active_acne: { fill: T.navyDark, track: "rgba(30, 50, 100, 0.2)" },
  acne_scars: { fill: T.navy, track: T.accentTrack },
  wrinkle_severity: { fill: T.navyMid, track: "rgba(61, 80, 128, 0.2)" },
  sagging_volume: { fill: "#4A6FA5", track: "rgba(74, 111, 165, 0.2)" },
  under_eye: { fill: T.navyLight, track: "rgba(91, 123, 168, 0.18)" },
  pigmentation_model: { fill: "#5B7BA8", track: "rgba(91, 123, 168, 0.2)" },
};

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

function severityToClarityPercent(s: number) {
  const x = Math.max(1, Math.min(5, s));
  return clamp(100 - ((x - 1) / 4) * 100);
}

function regionMarkerColor(issue: string): string {
  const x = issue.toLowerCase();
  if (x.includes("acne")) return "#dc2626";
  if (x.includes("wrinkle")) return "#7c3aed";
  return "#6b7280";
}

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

function signed(n: number) {
  return `${n > 0 ? "+" : ""}${n}`;
}

function deltaClass(n: number) {
  if (n > 0) return "tr-delta-up";
  if (n < 0) return "tr-delta-down";
  return "tr-delta-flat";
}

function valueForBar(n: number | null) {
  if (typeof n !== "number") return 0;
  return patientDisplayClarity(n);
}

function kindBadge(kind: "article" | "video" | "insight") {
  if (kind === "article") return "Article";
  if (kind === "video") return "Video";
  return "kAI insight";
}

function parseFocusDetail(detail: string): Array<{ label: string; body: string }> {
  return detail
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^(Why|Do|Target):\s*(.*)$/i);
      if (!m) return { label: "", body: line };
      return { label: `${m[1]}:`, body: m[2] ?? "" };
    });
}

function causeDotColor(impact: "high" | "medium" | "low") {
  if (impact === "high") return R.causeHigh;
  if (impact === "medium") return R.causeMed;
  return R.causeLow;
}

function buildEightClinicalDonuts(cs: ClinicalScores) {
  const rows: {
    key: ClinicalKey;
    label: string;
    clarity: number;
    severity: number;
    fill: string;
    track: string;
  }[] = [];
  for (const { key, label } of CLINICAL_ROWS) {
    const v = cs[key];
    if (key === "pigmentation_model" && v === null) continue;
    if (typeof v !== "number") continue;
    const style = EIGHT_CLINICAL_DONUT_STYLE[key] ?? {
      fill: T.peach,
      track: T.peachTrack,
    };
    rows.push({
      key,
      label,
      clarity: severityToClarityPercent(v),
      severity: v,
      fill: style.fill,
      track: style.track,
    });
  }
  return rows.length >= 4 ? rows : null;
}

function estimatePdfScale(p: ScanReportPdfPayload): number {
  /** Rough content height (px at scale 1) — matched to web single-page A4 fit. */
  let heightPx = 920;
  if (p.photos.length > 1) heightPx += 210;
  if (p.wrinkleMaskDataUri?.trim() || p.acneMaskDataUri?.trim()) heightPx += 270;
  if (p.tracker) heightPx += 2150;
  else heightPx += 880;
  heightPx += 80;
  const a4UsablePx = 1010;
  const scale = Math.min(1, a4UsablePx / heightPx);
  return Math.max(0.24, Math.round(scale * 1000) / 1000);
}

const CAP_IMG_W = 100;
const CAP_IMG_H = 133;

function capFigure(ph: { label: string; dataUri: string }): string {
  return `<figure class="cap-fig">
    <img class="cap-img" src=${JSON.stringify(ph.dataUri)} alt=${JSON.stringify(ph.label)} width="${CAP_IMG_W}" height="${CAP_IMG_H}" />
    <figcaption>${esc(ph.label)}</figcaption>
  </figure>`;
}

function buildGalleryHtml(photos: ScanReportPdfPayload["photos"]): string {
  if (photos.length === 0) {
    return `<p class="muted">No face capture images for this scan.</p>`;
  }

  const kicker =
    photos.length === 1 ? "Your scan photo" : "Face captures";
  let html = `<p class="cap-kicker">${esc(kicker)}</p>`;

  if (photos.length === 1) {
    const ph = photos[0]!;
    html += `
      <div class="cap-single">
        <figure>
          <img class="cap-img cap-img-lg" src=${JSON.stringify(ph.dataUri)} alt=${JSON.stringify(ph.label)} width="200" height="267" />
          <figcaption>${esc(ph.label)}</figcaption>
        </figure>
      </div>`;
    return html;
  }

  html += `<div class="cap-gallery">`;
  const row2 = photos.slice(0, 2);
  const row3 = photos.slice(2, 5);
  if (row2.length > 0) {
    html += `<div class="cap-row2">`;
    for (const ph of row2) html += capFigure(ph);
    html += `</div>`;
  }
  if (row3.length > 0) {
    html += `<div class="cap-row3">`;
    for (const ph of row3) html += capFigure(ph);
    html += `</div>`;
  }
  html += `</div>`;
  return html;
}

function maskPanelHtml(
  src: string,
  alt: string,
  caption: string,
  fallback?: string,
  maskExportVersion?: number | null
): string {
  const fallbackAttr = fallback
    ? ` onerror="if(!this.dataset.fallback){this.dataset.fallback='1';this.src=${JSON.stringify(fallback)}}"`
    : "";
  const legacy = shouldCropLegacyMaskTitle(src, maskExportVersion);
  const objectFit = "cover";
  const imgStyle = legacy
    ? (() => {
        const { heightPct, topPct } = legacyMaskTitleCropPercents();
        return ` style="height:${heightPct}%;top:${topPct}%;object-fit:${objectFit};object-position:center;"`;
      })()
    : "";
  const imgClass = legacy ? "mask-panel-img mask-panel-img-legacy" : "mask-panel-img";
  return `
    <figure class="mask-panel">
      <div class="mask-panel-frame" style="aspect-ratio: ${scanMaskPanelAspectCss(legacy)};">
        <img class="${imgClass}" src=${JSON.stringify(src)} alt=${JSON.stringify(alt)}${imgStyle}${fallbackAttr} />
      </div>
      <figcaption>${esc(caption)}</figcaption>
    </figure>`;
}

function buildMaskAnnotationsHtml(p: ScanReportPdfPayload): string {
  const wrMask = p.wrinkleMaskDataUri?.trim() || "";
  const acMask = p.acneMaskDataUri?.trim() || "";
  const basePhoto = p.photos[0]?.dataUri?.trim() || p.annotatedDataUri?.trim() || "";
  const showDotMarkers = !wrMask && !acMask && p.regions.length > 0 && basePhoto.length > 0;

  if (!wrMask && !acMask && !showDotMarkers) return "";

  let html = `<div class="masks-wrap avoid-break">`;

  if (wrMask || acMask) {
    const twoCol = wrMask && acMask;
    html += `<div class="masks-row${twoCol ? "" : " masks-row-single"}">`;
    if (wrMask) {
      html += maskPanelHtml(
        wrMask,
        "Wrinkle mask overlay",
        p.wrinklePoseLabel ?? WRINKLE_MASK_PANEL_LABEL,
        p.wrinkleFallbackDataUri,
        p.maskExportVersion
      );
    }
    if (acMask) {
      html += maskPanelHtml(
        acMask,
        "Acne objectness overlay",
        p.acnePoseLabel ?? ACNE_MASK_PANEL_LABEL,
        p.acneFallbackDataUri,
        p.maskExportVersion
      );
    }
    html += `</div>`;
  }

  if (showDotMarkers) {
    let markersHtml = "";
    for (const r of p.regions) {
      const col = regionMarkerColor(r.issue);
      markersHtml += `<div class="marker-dot" style="left:${r.coordinates.x}%;top:${r.coordinates.y}%;background:${col};"></div>`;
    }
    let legendHtml = "";
    for (const item of DOT_MARKER_LEGEND.items) {
      legendHtml += `<li><span class="leg-dot" style="background:${item.color}"></span>${esc(item.label)}</li>`;
    }
    html += `
      <div class="annot-wrap">
        <p class="cap-kicker annot-kicker">${esc(DOT_MARKER_LEGEND.title)}</p>
        <div class="annot-frame">
          <img src=${JSON.stringify(basePhoto)} alt="Scan with highlighted areas" />
          ${markersHtml}
        </div>
        <ul class="legend">${legendHtml}</ul>
      </div>`;
  }

  html += `</div>`;
  return html;
}

function buildTrackerSectionsHtml(
  rawReport: PatientTrackerReport,
  scoresUnlocked: boolean
): string {
  const report = presentTrackerReportNarrative(rawReport, scoresUnlocked);
  const weeklyDelta = trackerWeeklyDeltaDisplay(report);
  const isOnboardingBaseline = report.scanContext.kind === "onboarding_first_scan";

  let paramRowsHtml = "";
  for (const row of filterPatientVisibleParamRows(report.paramRows)) {
    const rowDelta = trackerParamRowDisplayDelta(report, row);
    paramRowsHtml += `
      <div class="tr-param-row">
        <span class="tr-param-label">${esc(row.label)}</span>
        <div class="tr-param-bar"><div class="tr-param-fill" style="width:${valueForBar(row.value)}%"></div></div>
        <span class="tr-param-val">${typeof row.value === "number" ? patientClarityToGrade(row.value) : "-"}</span>
        <span class="tr-param-delta ${typeof rowDelta === "number" ? deltaClass(rowDelta) : "tr-delta-flat"}">${typeof rowDelta === "number" ? signed(rowDelta) : "-"}</span>
      </div>`;
  }

  let causesHtml = "";
  for (const cause of report.causes.slice(0, 3)) {
    causesHtml += `
      <li class="tr-cause">
        <span class="tr-cause-dot" style="background:${causeDotColor(cause.impact)}"></span>
        <span>${esc(cause.text)}</span>
      </li>`;
  }

  let resourcesSectionHtml = "";
  if (INCLUDE_TRACKER_RESOURCES_IN_REPORT) {
    let resourcesHtml = "";
    for (const r of report.resources.slice(0, 3)) {
      resourcesHtml += `
      <div class="tr-resource">
        <p class="tr-resource-title">${esc(r.title)}</p>
        <p class="tr-resource-meta">${esc(kindBadge(r.kind))} · personalized pick</p>
        <p class="tr-resource-url">${esc(r.url)}</p>
      </div>`;
    }
    resourcesSectionHtml = `
      <section class="tr-card">
        <p class="tr-kicker">Section 3 - Resource Centre</p>
        ${resourcesHtml}
      </section>`;
  }

  const focusActions = isOnboardingBaseline
    ? ONBOARDING_BASELINE_FOCUS_ACTIONS
    : report.focusActions;

  let focusHtml = "";
  for (const a of focusActions.slice(0, 3)) {
    let detailHtml = "";
    for (const part of parseFocusDetail(a.detail)) {
      detailHtml += `<p class="tr-focus-detail">${part.label ? `<strong>${esc(part.label)}</strong> ` : ""}${esc(part.body)}</p>`;
    }
    focusHtml += `
      <li class="tr-focus-item">
        <p class="tr-focus-title"><span class="tr-focus-rank">${a.rank}</span>${esc(a.title)}</p>
        ${detailHtml}
      </li>`;
  }

  let pillsHtml = "";
  for (const pill of report.skinPills.slice(0, 3)) {
    pillsHtml += `<span class="tr-pill">${esc(pill)}</span>`;
  }

  return `
    <div class="tracker-wrap avoid-break">
      <section class="tr-card">
        <p class="tr-kicker">Section 1</p>
        <p class="tr-hook">${esc(report.hookSentence)}</p>
        <div class="tr-stats">
          <div class="tr-stat"><p class="tr-stat-k">kAI grade</p><p class="tr-stat-v">${patientClarityToGrade(report.scores.kaiScore)}</p></div>
          <div class="tr-stat"><p class="tr-stat-k">Since last scan</p><p class="tr-stat-v ${weeklyDelta !== null ? deltaClass(weeklyDelta) : "tr-delta-flat"}">${weeklyDelta !== null ? signed(weeklyDelta) : "-"}</p></div>
          <div class="tr-stat"><p class="tr-stat-k">Consistency</p><p class="tr-stat-v">${report.scores.consistencyScore}%</p></div>
        </div>
        <p class="tr-insight">${esc(report.insightText)}</p>
      </section>

      <section class="tr-card">
        <p class="tr-kicker">Section 2</p>
        <p class="tr-subhead">Your skin type</p>
        <div class="tr-pills">${pillsHtml}</div>
        <div class="tr-inset">
          <p class="tr-subhead">This week's overview</p>
          ${paramRowsHtml}
        </div>
        <div class="tr-inset">
          <p class="tr-subhead">Why your skin behaves this way</p>
          <ul class="tr-causes">${causesHtml}</ul>
        </div>
        <p class="tr-prediction">${esc(report.predictionText)}</p>
      </section>

      ${resourcesSectionHtml}

      <section class="tr-card">
        <p class="tr-kicker">${isOnboardingBaseline ? "Getting started" : "Section 3"}</p>
        ${isOnboardingBaseline ? `<p class="tr-onboarding-focus-intro">Follow these habits over the next week — your first scan is the starting point, not a comparison.</p>` : ""}
        <ol class="tr-focus-list">${focusHtml}</ol>
      </section>
    </div>`;
}

function buildLegacyMetricsHtml(
  p: ScanReportPdfPayload,
  overall: number,
  overallGrade: string,
  lastScanLabel: string
): string {
  const cs = p.metrics.clinical_scores;
  const eightClinicalDonuts = cs ? buildEightClinicalDonuts(cs) : null;

  let metricsBlock = "";
  if (eightClinicalDonuts) {
    metricsBlock += `<p class="metrics-kicker">FaceAnalyzer v13 — six parameters (grades A–E · A is best)</p>`;
    metricsBlock += `<div class="eight-grid">`;
    for (const row of eightClinicalDonuts) {
      metricsBlock += `
        <div class="eight-cell">
          <div class="eight-label">${esc(row.label)}</div>
          <div class="eight-row">${donutSvg(patientDisplayClarity(row.clarity), 36, 4, row.fill, row.track)}<span class="eight-pct">${patientClarityToGrade(row.clarity)}</span></div>
        </div>`;
    }
    metricsBlock += `</div>`;
    if (cs?.pigmentation_model === null) {
      metricsBlock += `<p class="pig-note">Pigmentation head not loaded in this model checkpoint.</p>`;
    }
  } else {
    const sixDonuts = [
      { label: "Acne", value: p.metrics.acne, fill: T.peach, track: T.peachTrack },
      { label: "Wrinkles", value: p.metrics.wrinkles, fill: "#7c3aed", track: "rgba(124, 58, 237, 0.2)" },
      { label: "Pigmentation", value: p.metrics.pigmentation ?? 72, fill: "#d97706", track: "rgba(217, 119, 6, 0.2)" },
      { label: "Hydration", value: p.metrics.hydration, fill: T.navyMid, track: "rgba(61, 80, 128, 0.2)" },
      { label: "Texture", value: p.metrics.texture ?? p.metrics.hydration, fill: T.navyMid, track: "rgba(61, 80, 128, 0.2)" },
      { label: "Overall", value: p.metrics.overall_score, fill: T.peach, track: T.peachTrack },
    ];
    metricsBlock += `<p class="metrics-kicker">AI model summary (grades A–E · A is best)</p>`;
    metricsBlock += `<div class="six-grid">`;
    for (const m of sixDonuts) {
      metricsBlock += `
        <div class="six-cell">
          <div class="six-label">${esc(m.label)}</div>
          <div class="six-row">${donutSvg(patientDisplayClarity(m.value), 40, 4.5, m.fill, m.track)}<span class="six-pct">${patientClarityToGrade(m.value)}</span></div>
        </div>`;
    }
    metricsBlock += `</div>`;
  }

  let clinicalHtml = "";
  if (cs && !eightClinicalDonuts) {
    clinicalHtml = `<div class="clinical-block avoid-break">
      <p class="clinical-k">FaceAnalyzer v13 — six clinical axes (grades A–E)</p>
      <div class="clinical-grid">`;
    for (const { key, label } of CLINICAL_ROWS) {
      const v = cs[key];
      if (key === "pigmentation_model") {
        if (v === undefined) continue;
        if (v === null) {
          clinicalHtml += `<div class="clinical-card clinical-card-muted"><span class="clinical-lbl">${esc(label)}</span><p class="clinical-na">Model unavailable</p></div>`;
          continue;
        }
      }
      if (typeof v !== "number") continue;
      const clarity = severityToClarityPercent(v);
      const pct = patientDisplayClarity(clarity);
      clinicalHtml += `<div class="clinical-card"><div class="clinical-top"><span class="clinical-lbl">${esc(label)}</span><span class="clinical-val">${patientClarityToGrade(clarity)}</span></div><div class="cbar"><div class="cbar-fill" style="width:${pct}%"></div></div></div>`;
    }
    clinicalHtml += `</div></div>`;
  }

  const overview =
    p.aiSummary?.trim()
      ? "Use the clinical bars and photo markers to see what this scan emphasized. Compare future scans for trends—this is educational, not a medical diagnosis."
      : "Your skin shows a balanced profile with room to optimize hydration and maintain clarity. Continue tracking changes after each scan to spot trends early.";

  return `
    <div class="metrics-wrap avoid-break">${metricsBlock}${clinicalHtml}</div>

    <div class="skin-card-wrap avoid-break">
      <div class="skin-card">
        <div class="skin-row">
          <div class="skin-col-text">
            <div class="skin-lbl">Your Skin Health</div>
            <div class="skin-big">${overallGrade}</div>
            <div class="skin-sub">Last scan: ${esc(lastScanLabel)}</div>
          </div>
          <div class="skin-col-donut">
            <div class="donut-ring">${donutSvg(patientDisplayClarity(overall), 104, 9, T.peach, T.peachLight)}</div>
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
    </div>`;
}

/**
 * HTML for expo-print / server PDF. Mirrors web `SkinScanReportBody` PDF sections.
 */
export function buildScanReportPdfHtml(p: ScanReportPdfPayload): string {
  const photos = p.photos;
  const overall = clamp(p.metrics.overall_score);
  const overallGrade = patientClarityToGrade(overall);
  const heroIntro =
    p.aiSummary?.trim() ||
    `Your latest scan shows an overall grade of ${overallGrade}. Detailed parameter grades and photo markers are below.`;
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

  const galleryHtml = buildGalleryHtml(photos);
  const masksHtml = buildMaskAnnotationsHtml(p);
  const tracker = p.tracker ?? null;
  const metricsHtml = tracker
    ? buildTrackerSectionsHtml(tracker, p.scoresUnlocked ?? false)
    : buildLegacyMetricsHtml(p, overall, overallGrade, lastScanLabel);
  const pdfScale = estimatePdfScale(p);
  const clinicPhone = "+91 98765 43210";
  const clinicEmail = "hello@skinfit.clinic";
  const clinicAddress = "123 Medical Plaza, Bangalore, Karnataka 560001";
  const clinicWebsite = "https://my.skinfitwellness.in";
  const clinicInstagram = "@skinfitwellness";
  const clinicLinkedIn = "linkedin.com/company/skinfit-wellness";
  const qrImageSrc = `https://api.qrserver.com/v1/create-qr-code/?size=144x144&margin=0&data=${encodeURIComponent(clinicWebsite)}`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    @page { size: 595pt 842pt; margin: 6pt; }
    html, body {
      margin: 0;
      padding: 0;
      width: 595pt;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
      background: radial-gradient(130% 100% at 50% 0%, #101d3b 0%, #070d1f 48%, #030711 100%);
      color: #e8eeff;
    }
    ${scanReportPdfBackgroundCss()}
    .pdf-page {
      width: 595pt;
      min-height: 830pt;
      page-break-after: avoid;
      page-break-before: avoid;
    }
    .pdf-scale {
      zoom: ${pdfScale};
      margin: 0;
      width: 100%;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .sheet {
      width: 86%;
      max-width: 86%;
      margin: 0 auto;
      background: transparent;
      padding: 10pt 0 6pt;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .sheet::before {
      content: "";
      position: absolute;
      inset: 9% 7% auto;
      height: 420px;
      background: url("/branding/skinfit-wellness-logo.svg") center/64% no-repeat;
      opacity: 0.08;
      filter: grayscale(1) brightness(2.7) contrast(0.92);
      pointer-events: none;
      z-index: 0;
    }
    .sheet > * { position: relative; z-index: 1; }
    .brand-top {
      margin: 0 0 10px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      border-radius: 14px;
      border: 1px solid rgba(138, 164, 255, 0.38);
      background:
        linear-gradient(92deg, rgba(17, 30, 62, 0.78), rgba(13, 28, 54, 0.68)),
        radial-gradient(circle at 18% 20%, rgba(120, 165, 255, 0.24), transparent 56%);
      box-shadow: 0 18px 30px -20px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(198, 215, 255, 0.28);
      backdrop-filter: blur(9px);
    }
    .brand-left { display: flex; align-items: center; gap: 10px; }
    .brand-logo {
      width: 92px;
      height: 30px;
      object-fit: contain;
      object-position: left center;
      display: block;
    }
    .brand-chip {
      font-size: 8px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: #dbe7ff;
      padding: 5px 8px;
      border-radius: 999px;
      border: 1px solid rgba(167, 192, 255, 0.32);
      background: rgba(147, 180, 255, 0.15);
      white-space: nowrap;
    }
    .brand-right {
      font-size: 8px;
      color: #e3ebff;
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    .brand-right span::before {
      content: "• ";
      color: #98b7ff;
    }
    .brand-right span:first-child::before { content: ""; }
    .avoid-break, .sec1, .sec2, .sec3, .tr-card, .tracker-wrap {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .muted { text-align: center; color: #71717a; font-size: 14px; margin: 24px 0; }

    .sec1 {
      position: relative;
      padding: 14px 12px 12px;
      border-radius: 22px;
      border: 1px solid rgba(255,255,255,0.72);
      box-shadow: 0 24px 48px -16px rgba(44,62,107,0.24), inset 0 1px 0 rgba(255,255,255,0.95);
      overflow: hidden;
      background: linear-gradient(180deg, rgba(255,255,255,0.94) 0%, rgba(248,251,255,0.88) 100%);
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
      color: rgba(44,62,107,0.7);
      margin: 0 0 20px;
    }
    .cap-single { text-align: center; margin-top: 8px; }
    .cap-single figcaption { margin-top: 8px; font-size: 11px; font-weight: 500; color: #52525b; }
    .cap-gallery { max-width: 420px; margin: 0 auto; }
    .cap-row2, .cap-row3 {
      display: flex;
      flex-direction: row;
      justify-content: center;
      align-items: flex-start;
      margin-top: 14px;
    }
    .cap-row2 { gap: 20px; }
    .cap-row3 { gap: 10px; }
    .cap-fig { width: ${CAP_IMG_W}px; margin: 0; padding: 0; text-align: center; }
    .cap-img {
      width: ${CAP_IMG_W}px;
      height: ${CAP_IMG_H}px;
      object-fit: cover;
      object-position: center;
      border-radius: 12px;
      border: 1px solid rgba(0,0,0,0.1);
      background: #e4e4e7;
      display: block;
      margin: 0 auto;
    }
    .cap-img-lg {
      width: 200px;
      height: 267px;
      border-radius: 16px;
    }
    .cap-fig figcaption { margin-top: 6px; font-size: 9px; font-weight: 500; line-height: 1.25; color: #52525b; }

    .masks-wrap { margin-top: 12px; max-width: 480px; margin-left: auto; margin-right: auto; }
    .masks-row {
      display: flex;
      flex-direction: row;
      justify-content: center;
      align-items: flex-start;
      gap: 12px;
    }
    .masks-row-single { max-width: 220px; margin: 0 auto; }
    .mask-panel { flex: 1; max-width: 220px; margin: 0; }
    .masks-row-single .mask-panel { flex: none; width: 100%; max-width: 220px; }
    .mask-panel-frame {
      position: relative;
      width: 100%;
      aspect-ratio: ${SCAN_FACE_FRAME_ASPECT_CSS};
      overflow: hidden;
      border-radius: 8px;
      background: #fafafa;
      border: 1px solid rgba(228,228,231,0.9);
    }
    .mask-panel-img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center;
      display: block;
    }
    .mask-panel-img-legacy {
      inset: auto;
      left: 0;
      width: 100%;
    }
    .mask-panel figcaption {
      margin-top: 8px;
      text-align: center;
      font-size: 11px;
      font-weight: 500;
      color: #52525b;
      border-top: 1px solid #f4f4f5;
      padding-top: 8px;
    }

    .annot-wrap { margin-top: 16px; max-width: 280px; margin-left: auto; margin-right: auto; }
    .annot-kicker { margin-bottom: 12px !important; }
    .annot-frame {
      position: relative;
      margin: 0 auto;
      width: 100%;
      max-width: 280px;
      height: 373px;
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
      margin: 12px 0 0;
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

    .sec2 { padding: 10px 12px 0; }
    .kicker {
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: #71717a;
    }
    h1 {
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 1.35rem;
      font-weight: 500;
      line-height: 1.15;
      margin: 4px 0 0;
      color: #18181b;
    }
    .age-line { margin-top: 16px; font-size: 13px; font-weight: 500; color: #52525b; }
    .body-copy { margin-top: 8px; font-size: 11px; line-height: 1.45; color: #52525b; }

    .metrics-kicker {
      text-align: center;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: #71717a;
      margin: 24px 0 12px;
    }
    .six-grid {
      display: flex;
      flex-wrap: wrap;
      max-width: 560px;
      margin: 0 auto;
      gap: 6px;
      justify-content: center;
    }
    .six-cell {
      width: calc(33.33% - 4px);
      min-width: 140px;
      flex: 1 1 calc(33.33% - 4px);
      vertical-align: middle;
      padding: 6px 4px;
      border-radius: 12px;
      border: 1px solid rgba(44,62,107,0.1);
      background: #fff;
    }
    .six-label { font-size: 9px; font-weight: 600; text-align: center; color: #2C3E6B; line-height: 1.2; margin-bottom: 4px; }
    .six-row { display: flex; align-items: center; justify-content: center; gap: 4px; }
    .six-pct { font-size: 10px; font-weight: 600; color: #27272a; }

    .eight-grid { display: flex; flex-wrap: wrap; max-width: 640px; margin: 0 auto; gap: 8px; justify-content: center; }
    .eight-cell {
      width: calc(25% - 6px);
      min-width: 120px;
      flex: 1 1 calc(25% - 6px);
      text-align: center;
      padding: 8px 6px;
      border-radius: 12px;
      border: 1px solid #fff;
      background: #fff;
    }
    .eight-label { font-size: 9px; font-weight: 600; color: #3f3f46; line-height: 1.2; margin-bottom: 4px; }
    .eight-row { display: flex; align-items: center; justify-content: center; gap: 4px; }
    .eight-pct { font-size: 10px; font-weight: 600; color: #27272a; }
    .eight-sev { font-size: 9px; color: #71717a; margin-top: 2px; }
    .pig-note { text-align: center; font-size: 11px; color: #71717a; margin-top: 10px; }

    .clinical-block { margin-top: 10px; max-width: 36rem; margin-left: auto; margin-right: auto; }
    .clinical-k { font-size: 10px; font-weight: 600; letter-spacing: 0.2em; text-transform: uppercase; color: #71717a; margin: 16px 0 0; }
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
    .cbar-fill { height: 100%; border-radius: 999px; background: ${T.navy}; }

    .skin-card-wrap { margin-top: 10px; padding-bottom: 4px; }
    .skin-card {
      max-width: 32rem;
      margin: 0 auto;
      padding: 12px 14px;
      background: #fff;
      border-radius: 20px;
      border: 1px solid rgba(44,62,107,0.12);
      box-shadow: 0 24px 48px -12px rgba(44,62,107,0.15);
    }
    .skin-row { display: table; width: 100%; }
    .skin-col-text { display: table-cell; vertical-align: middle; width: 55%; }
    .skin-col-donut { display: table-cell; vertical-align: middle; text-align: right; }
    .skin-lbl { font-size: 10px; font-weight: 600; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(44,62,107,0.7); }
    .skin-big { font-family: Georgia, 'Times New Roman', serif; font-size: 2rem; font-weight: 500; line-height: 1; color: ${T.peach}; margin-top: 4px; }
    .skin-sub { margin-top: 8px; font-size: 12px; font-weight: 500; color: #71717a; }
    .donut-ring {
      display: inline-block;
      padding: 4px;
      border-radius: 50%;
      box-shadow: 0 4px 14px rgba(74, 111, 165, 0.25);
      border: 1px solid rgba(0,0,0,0.18);
      background: #fff;
    }

    .teal {
      margin-top: 12px;
      padding: 14px 12px 16px;
      border-top: 1px solid rgba(44,62,107,0.12);
      background: linear-gradient(180deg, ${T.navy} 0%, ${T.navyMid} 100%);
    }
    .teal-rule {
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.95), transparent);
      margin-bottom: 22px;
    }
    .teal-two { display: table; width: 100%; }
    .teal-two > div { display: table-cell; width: 50%; vertical-align: top; padding-right: 16px; }
    .teal-two > div:last-child { padding-right: 0; padding-left: 16px; }
    .teal-bar { width: 32px; height: 3px; border-radius: 2px; background: ${T.peach}; margin-bottom: 12px; }
    .teal-h { font-size: 11px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: #ffffff; margin: 0 0 14px; }
    .teal-p { font-size: 10px; line-height: 1.5; color: rgba(255,255,255,0.9); margin: 0 0 8px; }

    .tracker-wrap { margin-top: 16px; }
    .tr-card {
      margin-bottom: 14px;
      padding: 14px 12px;
      border-radius: 20px;
      border: 1px solid rgba(255,255,255,0.72);
      background: linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(248,251,255,0.92) 52%, rgba(232,239,248,0.88) 100%);
      box-shadow: 0 16px 36px -18px rgba(44,62,107,0.28), inset 0 1px 0 rgba(255,255,255,0.95);
    }
    .tr-kicker { font-size: 10px; font-weight: 600; letter-spacing: 0.2em; text-transform: uppercase; color: #3d5080; margin: 0; }
    .tr-onboarding-focus-intro { font-size: 12px; line-height: 1.5; color: #52525b; margin: 8px 0 0; }
    .tr-hook { font-family: Georgia, 'Times New Roman', serif; font-size: 1.35rem; font-weight: 500; line-height: 1.2; color: #18181b; margin: 8px 0 0; }
    .tr-stats {
      display: flex;
      flex-direction: row;
      gap: 8px;
      margin-top: 12px;
    }
    .tr-stat { flex: 1; padding: 8px 6px; border-radius: 12px; border: 1px solid rgba(44,62,107,0.12); background: rgba(255,255,255,0.9); }
    .tr-stat-k { font-size: 9px; text-transform: uppercase; letter-spacing: 0.12em; color: #3d5080; margin: 0; }
    .tr-stat-v { font-size: 16px; font-weight: 600; color: #2C3E6B; margin: 4px 0 0; }
    .tr-insight, .tr-prediction { margin-top: 10px; font-size: 11px; line-height: 1.45; color: #52525b; }
    .tr-subhead { font-size: 12px; font-weight: 600; color: #18181b; margin: 10px 0 6px; }
    .tr-pills { display: flex; flex-wrap: wrap; gap: 6px; }
    .tr-pill {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 999px;
      border: 1px solid rgba(44,62,107,0.14);
      background: #fff;
      font-size: 11px;
      font-weight: 600;
      color: #2C3E6B;
    }
    .tr-inset {
      margin-top: 10px;
      padding: 10px;
      border-radius: 12px;
      border: 1px solid rgba(44,62,107,0.12);
      background: rgba(255,255,255,0.9);
    }
    .tr-param-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 90px 36px 24px;
      gap: 6px;
      align-items: center;
      font-size: 10px;
      margin-top: 6px;
    }
    .tr-param-label { font-weight: 500; color: #3f3f46; }
    .tr-param-bar { height: 8px; border-radius: 999px; background: rgba(44,62,107,0.12); overflow: hidden; }
    .tr-param-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, ${R.barFrom}, ${R.barTo}); }
    .tr-param-val { text-align: right; font-weight: 600; color: #2C3E6B; }
    .tr-param-delta { text-align: right; }
    .tr-delta-up { color: #2C3E6B; }
    .tr-delta-down { color: #5B7BA8; }
    .tr-delta-flat { color: #a1a1aa; }
    .tr-causes { list-style: none; padding: 0; margin: 0; }
    .tr-cause { display: flex; gap: 8px; align-items: flex-start; font-size: 11px; color: #3f3f46; margin-top: 6px; }
    .tr-cause-dot { width: 6px; height: 6px; border-radius: 50%; margin-top: 5px; flex-shrink: 0; }
    .tr-resource, .resource-card {
      margin-top: 8px;
      padding: 10px;
      border-radius: 12px;
      border: 1px solid rgba(44,62,107,0.12);
      background: rgba(255,255,255,0.92);
    }
    .tr-resource-title, .resource-title { font-size: 12px; font-weight: 600; color: #2C3E6B; margin: 0; }
    .tr-resource-meta, .resource-meta { font-size: 10px; color: #71717a; margin: 4px 0 0; }
    .tr-resource-url, .resource-url { font-size: 10px; color: #52525b; word-break: break-all; margin: 4px 0 0; }
    .tr-focus-list { list-style: none; padding: 0; margin: 8px 0 0; }
    .tr-focus-item { margin-top: 8px; padding: 10px; border-radius: 12px; border: 1px solid rgba(44,62,107,0.12); background: rgba(255,255,255,0.9); }
    .tr-focus-title { font-size: 12px; font-weight: 600; color: #18181b; margin: 0; }
    .tr-focus-rank {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: rgba(44,62,107,0.1);
      color: #2C3E6B;
      font-size: 10px;
      font-weight: 700;
      margin-right: 6px;
    }
    .tr-focus-detail { font-size: 11px; line-height: 1.45; color: #52525b; margin: 4px 0 0; }

    .sec3 { padding: 8px 12px 10px; }
    .sec3-title { text-align: center; font-size: 10px; font-weight: 700; letter-spacing: 0.28em; text-transform: uppercase; color: #2C3E6B; margin: 0; }
    .resource-grid { margin-top: 12px; }
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
      margin-top: 10px;
      padding: 10px 12px 12px;
      border-radius: 16px;
      border: 1px solid rgba(157,185,255,0.35);
      background: linear-gradient(120deg, rgba(11, 24, 50, 0.84), rgba(8, 17, 36, 0.74));
      font-size: 8px;
      color: #cedbff;
      box-shadow: inset 0 1px 0 rgba(205, 220, 255, 0.25);
    }
    .foot-grid {
      display: grid;
      grid-template-columns: 1fr 84px;
      gap: 10px;
      align-items: center;
    }
    .foot-text { text-align: left; }
    .foot-line1 {
      letter-spacing: 0.18em;
      text-transform: uppercase;
      font-weight: 700;
      color: #eaf1ff;
    }
    .foot-line2 {
      margin-top: 4px;
      letter-spacing: 0.04em;
      color: #c2d1f6;
    }
    .foot-line3 {
      margin-top: 4px;
      color: #9fb5eb;
      word-break: break-all;
    }
    .foot-qr-wrap {
      width: 84px;
      text-align: center;
    }
    .foot-qr {
      width: 78px;
      height: 78px;
      border-radius: 8px;
      border: 1px solid rgba(166, 194, 255, 0.56);
      background: #ffffff;
      padding: 3px;
      display: block;
      margin: 0 auto;
    }
    .foot-qr-note {
      margin-top: 4px;
      font-size: 6px;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #9ab0e6;
    }

    /* Dark glassmorphism overrides for report cards */
    .sec1,
    .tr-card,
    .resource-card,
    .tr-resource,
    .vid-box,
    .clinical-card,
    .skin-card,
    .tr-inset,
    .tr-stat,
    .tr-focus-item,
    .legend li {
      border-color: rgba(157,185,255,0.22) !important;
      background: linear-gradient(145deg, rgba(20, 35, 72, 0.72), rgba(10, 20, 43, 0.64)) !important;
      box-shadow: inset 0 1px 0 rgba(220, 232, 255, 0.14);
      color: #dfe9ff;
    }
    .cap-kicker, .kicker, .metrics-kicker, .tr-kicker, .sec3-title, .clinical-k, .skin-lbl, .tr-stat-k, .tr-resource-meta, .resource-meta {
      color: #9cb4ea !important;
    }
    h1, .tr-hook, .tr-focus-title, .tr-subhead, .resource-title, .tr-resource-title {
      color: #ecf3ff !important;
    }
    .age-line, .body-copy, .tr-insight, .tr-prediction, .tr-cause, .tr-focus-detail, .tr-resource-url, .resource-url, .vid-box li, .vid-href, .clinical-lbl, .clinical-val {
      color: #ccdbfb !important;
    }
    .teal {
      border-radius: 16px;
      border: 1px solid rgba(157,185,255,0.24);
      background: linear-gradient(180deg, rgba(13, 28, 58, 0.9) 0%, rgba(9, 20, 41, 0.88) 100%);
    }
  </style>
</head>
<body>
  <div class="pdf-page">
    <div class="pdf-scale">
  <div class="sheet">
    <div class="brand-top avoid-break">
      <div class="brand-left">
        <img class="brand-logo" src="/branding/skinfit-wellness-logo.svg" alt="SkinFit Wellness" />
        <span class="brand-chip">AI skin intelligence report</span>
      </div>
      <div class="brand-right">
        <span>${esc(clinicPhone)}</span>
        <span>${esc(clinicEmail)}</span>
      </div>
    </div>

    <div class="sec1 avoid-break">
      ${galleryHtml}
      ${masksHtml}
    </div>

    <div class="sec2 avoid-break">
      <p class="kicker">AI scan report</p>
      <h1>Hello ${esc(p.userName)}</h1>
      ${displayTitle ? `<p class="age-line" style="margin-top:8px;font-weight:600;color:#3f3f46">${esc(displayTitle)}</p>` : ""}
      <p class="age-line">Age: ${p.userAge} yrs <span style="color:#a1a1aa">·</span> Skin type: ${esc(p.userSkinType)}</p>
      <p class="body-copy">${esc(heroIntro)}</p>
      ${metricsHtml}
    </div>

    <div class="foot avoid-break">
      <div class="foot-grid">
        <div class="foot-text">
          <div class="foot-line1">SkinnFit Wellness Clinic · AI-powered dermatology insights</div>
          <div class="foot-line2">${esc(clinicAddress)}</div>
          <div class="foot-line2">${esc(clinicPhone)} · ${esc(clinicEmail)}</div>
          <div class="foot-line3">${esc(clinicWebsite)} · Instagram ${esc(clinicInstagram)} · ${esc(clinicLinkedIn)}</div>
        </div>
        <div class="foot-qr-wrap">
          <img class="foot-qr" src="${qrImageSrc}" alt="Scan QR for SkinFit website" />
          <div class="foot-qr-note">Scan for website</div>
        </div>
      </div>
    </div>
  </div>
    </div>
  </div>
</body>
</html>`;
}
