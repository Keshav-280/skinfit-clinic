import { readFile } from "node:fs/promises";
import path from "node:path";
import { jsPDF } from "jspdf";
import sharp from "sharp";
import type { KaiObservationColor, KaiReportContent } from "./aiReport";
import { drawRadarChart, drawScoreGauge } from "./charts";
import { reportQrDataUrl } from "./qrCode";
import type { SdetectFaceImages, SdetectReportData } from "./types";

type RGB = [number, number, number];

/** SkinFit kAI report palette — tuned to the design mockup. */
const KAI = {
  cream: [245, 242, 234] as RGB,
  navy: [43, 45, 92] as RGB,
  ink: [40, 42, 70] as RGB,
  coral: [216, 139, 107] as RGB,
  coralLight: [232, 190, 170] as RGB,
  teal: [122, 158, 147] as RGB,
  muted: [120, 122, 138] as RGB,
  card: [255, 255, 255] as RGB,
  cardBorder: [225, 222, 214] as RGB,
  white: [255, 255, 255] as RGB,
  divider: [232, 229, 221] as RGB,
} as const;

const OBS_STYLE: Record<
  KaiObservationColor,
  { dot: RGB; pillBg: RGB; pillText: RGB }
> = {
  red: { dot: [214, 69, 69], pillBg: [252, 232, 232], pillText: [186, 58, 58] },
  amber: { dot: [232, 160, 60], pillBg: [252, 244, 228], pillText: [176, 122, 36] },
  green: { dot: [76, 175, 80], pillBg: [232, 245, 233], pillText: [56, 132, 70] },
};

const CLINIC_LOCATIONS = [
  {
    address: "5, Richmond Rd, Ashok Nagar, Bengaluru 560025",
    phone: "+91 90354 07057",
  },
  {
    address: "3rd Floor, 534/A, 7th Cross, 4th Block, Koramangala, Bengaluru 560034",
    phone: "+91 91879 67633",
  },
] as const;

const BOOKING_URL = "https://my.skinfitwellness.in";

type LogoAsset = { dataUrl: string; displayW: number; displayH: number };

let logoCache: LogoAsset | null = null;

const LOGO_DISPLAY_H = 30;

async function loadHeaderLogo(): Promise<LogoAsset> {
  if (logoCache) return logoCache;

  const svgPath = path.join(process.cwd(), "public/branding/skinfit-wellness-logo.svg");
  const wellnessPng = path.join(process.cwd(), "public/branding/skinfit-wellness-logo.png");
  const rasterH = LOGO_DISPLAY_H * 4;

  let raster: Buffer;
  try {
    raster = await sharp(svgPath)
      .resize({ height: rasterH })
      .png({ compressionLevel: 6 })
      .toBuffer();
  } catch {
    const buffer = await readFile(wellnessPng);
    raster = await sharp(buffer)
      .resize({ height: rasterH, kernel: sharp.kernel.lanczos3 })
      .png({ compressionLevel: 6 })
      .toBuffer();
  }

  const meta = await sharp(raster).metadata();
  const aspect = (meta.width ?? 248) / (meta.height ?? rasterH);
  const displayW = Math.round(LOGO_DISPLAY_H * aspect);

  logoCache = {
    dataUrl: `data:image/png;base64,${raster.toString("base64")}`,
    displayW,
    displayH: LOGO_DISPLAY_H,
  };
  return logoCache;
}

function formatPatientPhone(phone: string): string {
  const trimmed = phone.trim();
  if (!trimmed || trimmed === "—") return trimmed;
  if (trimmed.startsWith("+")) return trimmed;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+91 ${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) {
    return `+91 ${digits.slice(2)}`;
  }
  return trimmed;
}

function wrap(doc: jsPDF, text: string, maxWidth: number): string[] {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  return doc.splitTextToSize(cleaned, maxWidth) as string[];
}

async function faceImageDataUrl(buffer: Buffer, w: number, h: number): Promise<string> {
  const jpg = await sharp(buffer)
    .resize(Math.round(w * 3), Math.round(h * 3), { fit: "cover", position: "top" })
    .jpeg({ quality: 88 })
    .toBuffer();
  return `data:image/jpeg;base64,${jpg.toString("base64")}`;
}

function roundedCard(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  radius = 12,
  fill: RGB = KAI.card
) {
  doc.setFillColor(...fill);
  doc.setDrawColor(...KAI.cardBorder);
  doc.setLineWidth(0.75);
  doc.roundedRect(x, y, w, h, radius, radius, "FD");
}

function sectionLabel(doc: jsPDF, text: string, x: number, y: number, align: "left" | "center" = "left") {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...KAI.teal);
  doc.text(text.toUpperCase(), x, y, { align, charSpace: 0.6 });
}

async function drawHeader(
  doc: jsPDF,
  logo: LogoAsset,
  data: SdetectReportData,
  eventLabel: string
) {
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 32;
  const h = 66;

  doc.setFillColor(...KAI.navy);
  doc.rect(0, 0, pageW, h, "F");

  // Full-colour logo on a white badge so navy SKINFIT text stays visible.
  const badgePadX = 10;
  const badgePadY = 8;
  const badgeW = logo.displayW + badgePadX * 2;
  const badgeH = logo.displayH + badgePadY * 2;
  doc.setFillColor(...KAI.white);
  doc.roundedRect(margin, (h - badgeH) / 2, badgeW, badgeH, 6, 6, "F");
  doc.addImage(
    logo.dataUrl,
    "PNG",
    margin + badgePadX,
    (h - logo.displayH) / 2,
    logo.displayW,
    logo.displayH
  );

  const subtitle = [eventLabel.trim(), data.patient.reportDate]
    .filter((s) => s && s !== "—")
    .join("  ·  ");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...KAI.white);
  doc.text("Your personal skin analysis", pageW - margin, 32, { align: "right" });
  if (subtitle) {
    doc.setTextColor(...KAI.coralLight);
    doc.text(subtitle, pageW - margin, 46, { align: "right" });
  }
}

async function drawIdentityRow(
  doc: jsPDF,
  data: SdetectReportData,
  x: number,
  y: number,
  w: number
): Promise<number> {
  const imgH = 88;
  const imgW = 70;
  const imgGap = 8;
  const pad = 16;
  const imgBlockW = data.faceImages
    ? imgW * 3 + imgGap * 2
    : 0;
  const rowH = Math.max(imgH + 8, 118);

  roundedCard(doc, x, y, w, rowH);

  const textX = x + pad;
  let ty = y + 22;
  sectionLabel(doc, "analysed for", textX, ty);

  ty += 20;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...KAI.navy);
  doc.text(data.patient.name || "—", textX, ty);

  const gender = data.patient.gender?.trim();
  if (gender && gender !== "—") {
    const nameW = doc.getTextWidth(data.patient.name || "—");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...KAI.muted);
    doc.text(gender, textX + nameW + 10, ty);
  }

  const detailLine = (label: string, value: string) => {
    if (!value || value === "—") return;
    ty += 15;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...KAI.muted);
    doc.text(label, textX, ty);
    doc.setTextColor(...KAI.ink);
    doc.text(value, textX + 92, ty);
  };

  ty += 6;
  if (data.patient.age > 0) {
    detailLine("Age", `${data.patient.age} yrs`);
  }
  detailLine("Contact", formatPatientPhone(data.patient.phone));
  detailLine("Date of report", data.patient.reportDate);
  if (data.patient.scanFrequency > 0) {
    detailLine("Skin analysis frequency", String(data.patient.scanFrequency));
  }

  if (data.faceImages) {
    const keys: Array<keyof SdetectFaceImages> = ["left", "front", "right"];
    let ix = x + w - pad - imgBlockW;
    const imgY = y + (rowH - imgH) / 2;
    for (const key of keys) {
      const url = await faceImageDataUrl(data.faceImages[key], imgW, imgH);
      doc.setDrawColor(...KAI.cardBorder);
      doc.setLineWidth(0.75);
      doc.roundedRect(ix - 1, imgY - 1, imgW + 2, imgH + 2, 6, 6, "S");
      doc.addImage(url, "JPEG", ix, imgY, imgW, imgH);
      ix += imgW + imgGap;
    }
  }

  return y + rowH;
}

function drawSkinTypeCard(
  doc: jsPDF,
  content: KaiReportContent,
  x: number,
  y: number,
  w: number,
  h: number
) {
  roundedCard(doc, x, y, w, h);
  const pad = 16;
  sectionLabel(doc, "your skin type", x + pad, y + 20);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...KAI.navy);
  doc.text(content.skinTypeCode || "—", x + pad, y + 44);

  // Full plain expansion on its own line so no descriptor is clipped.
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...KAI.muted);
  const plainLines = wrap(doc, content.skinTypePlain, w - pad * 2);
  let py = y + 60;
  for (const line of plainLines) {
    doc.text(line, x + pad, py);
    py += 12;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...KAI.ink);
  const summaryLines = wrap(doc, content.skinTypeSummary, w - pad * 2);
  let sy = py + 6;
  for (const line of summaryLines) {
    if (sy > y + h - 10) break;
    doc.text(line, x + pad, sy);
    sy += 13;
  }
}

function drawScoreCard(
  doc: jsPDF,
  content: KaiReportContent,
  x: number,
  y: number,
  w: number,
  h: number
) {
  roundedCard(doc, x, y, w, h);
  const cx = x + w / 2;
  sectionLabel(doc, "skinfit score", cx, y + 20, "center");

  const radius = Math.min(w * 0.3, 42);
  const gaugeBaseY = y + 40 + radius;
  drawScoreGauge(doc, cx, gaugeBaseY, radius, content.kaiScore, 8);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.setTextColor(...KAI.navy);
  doc.text(String(content.kaiScore), cx, gaugeBaseY - 4, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...KAI.muted);
  doc.text("/100", cx, gaugeBaseY + 6, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...KAI.navy);
  doc.text(content.kaiScoreLabel, cx, gaugeBaseY + 20, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...KAI.muted);
  doc.text(`${content.kaiScoreGrade} grade · ${content.kaiScoreBand}`, cx, gaugeBaseY + 32, {
    align: "center",
  });
}

function drawObservationsCard(
  doc: jsPDF,
  content: KaiReportContent,
  x: number,
  y: number,
  w: number,
  h: number
) {
  roundedCard(doc, x, y, w, h);
  const pad = 16;
  sectionLabel(doc, "top 3 observations", x + pad, y + 20);

  const innerW = w - pad * 2;
  const observations = content.observations.slice(0, 3);
  const rowH = (h - 34) / Math.max(observations.length, 1);
  let cy = y + 34;

  observations.forEach((obs, index) => {
    const style = OBS_STYLE[obs.color];
    const dotX = x + pad + 3;
    const titleX = x + pad + 14;
    const rowTop = cy;

    doc.setFillColor(...style.dot);
    doc.circle(dotX, rowTop + 4, 3, "F");

    // score pill (right aligned)
    const pillLabel = `score ${obs.score}`;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    const pillTextW = doc.getTextWidth(pillLabel);
    const pillW = pillTextW + 16;
    const pillH = 15;
    const pillX = x + w - pad - pillW;
    doc.setFillColor(...style.pillBg);
    doc.roundedRect(pillX, rowTop - 5, pillW, pillH, 7, 7, "F");
    doc.setTextColor(...style.pillText);
    doc.text(pillLabel, pillX + pillW / 2, rowTop + 5, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...KAI.navy);
    const titleLines = wrap(doc, obs.title, pillX - titleX - 8);
    doc.text(titleLines[0] ?? obs.title, titleX, rowTop + 8);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...KAI.ink);
    const commentaryLines = wrap(doc, obs.commentary, innerW - 14);
    let ty = rowTop + 21;
    for (const line of commentaryLines) {
      if (ty > rowTop + rowH - 6) break;
      doc.text(line, titleX, ty);
      ty += 11;
    }

    if (index < observations.length - 1) {
      doc.setDrawColor(...KAI.divider);
      doc.setLineWidth(0.6);
      doc.line(x + pad, cy + rowH - 8, x + w - pad, cy + rowH - 8);
    }
    cy += rowH;
  });
}

function drawComprehensiveCard(
  doc: jsPDF,
  content: KaiReportContent,
  x: number,
  y: number,
  w: number,
  h: number
) {
  roundedCard(doc, x, y, w, h);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...KAI.navy);
  doc.text("Comprehensive Analysis", x + w / 2, y + 18, { align: "center" });

  const metrics = content.radarLabels.map((label, i) => ({
    label,
    score: content.radarValues[i] ?? 0,
  }));
  drawRadarChart(doc, metrics, {
    x: x + 8,
    y: y + 26,
    w: w - 16,
    h: h - 34,
    labelMinY: y + 24,
  });
}

const INSIGHT_PAD = 18;
const INSIGHT_LINE_H = 12;
const INSIGHT_FONT = 9;
const INSIGHT_TEXT_TOP = 36;

/** Height needed to render the full insight text at the report width. */
function measureInsightHeight(doc: jsPDF, content: KaiReportContent, w: number): number {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(INSIGHT_FONT);
  const lines = wrap(doc, content.insight, w - INSIGHT_PAD * 2);
  return INSIGHT_TEXT_TOP + lines.length * INSIGHT_LINE_H + 12;
}

function drawInsightBox(
  doc: jsPDF,
  content: KaiReportContent,
  x: number,
  y: number,
  w: number,
  h: number
) {
  doc.setFillColor(...KAI.navy);
  doc.roundedRect(x, y, w, h, 12, 12, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...KAI.coralLight);
  doc.text("YOUR PERSONALISED NEXT STEP", x + INSIGHT_PAD, y + 20, { charSpace: 0.6 });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(INSIGHT_FONT);
  doc.setTextColor(...KAI.white);
  const lines = wrap(doc, content.insight, w - INSIGHT_PAD * 2);
  let ty = y + INSIGHT_TEXT_TOP;
  for (const line of lines) {
    if (ty > y + h - 10) break;
    doc.text(line, x + INSIGHT_PAD, ty);
    ty += INSIGHT_LINE_H;
  }
}

async function drawContactFooter(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number
) {
  roundedCard(doc, x, y, w, h, 12, KAI.cream);
  const pad = 16;
  sectionLabel(doc, "contact details of skinfit", x + pad, y + 18);

  const qrSize = h - 24;
  const qrX = x + w - pad - qrSize;
  const qrY = y + 14;
  const qrDataUrl = await reportQrDataUrl(BOOKING_URL);
  doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...KAI.muted);
  doc.text("scan to book", qrX + qrSize / 2, qrY + qrSize + 8, { align: "center" });

  const colW = (qrX - (x + pad) - 16) / 2;
  CLINIC_LOCATIONS.forEach((loc, i) => {
    const ax = x + pad + i * (colW + 16);
    let ay = y + 34;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...KAI.navy);
    doc.text(i === 0 ? "Ashok Nagar" : "Koramangala", ax, ay);
    ay += 12;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...KAI.ink);
    for (const line of wrap(doc, loc.address, colW - 4)) {
      doc.text(line, ax, ay);
      ay += 9;
    }
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...KAI.navy);
    doc.text(loc.phone, ax, ay + 2);
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...KAI.coral);
  doc.text("Book your consult at my.skinfitwellness.in", x + pad, y + h - 12);
}

export async function generateKaiReportPdf(
  data: SdetectReportData,
  content: KaiReportContent,
  options: { eventLabel?: string } = {}
): Promise<Buffer> {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 32;
  const contentW = pageW - margin * 2;

  doc.setFillColor(...KAI.cream);
  doc.rect(0, 0, pageW, pageH, "F");

  const logo = await loadHeaderLogo();
  await drawHeader(doc, logo, data, options.eventLabel ?? "");

  let y = 66 + 20;
  y = await drawIdentityRow(doc, data, margin, y, contentW);
  y += 16;

  const gutter = 16;
  const skinTypeW = (contentW - gutter) * 0.6;
  const scoreW = contentW - gutter - skinTypeW;
  const row2H = 126;
  drawSkinTypeCard(doc, content, margin, y, skinTypeW, row2H);
  drawScoreCard(doc, content, margin + skinTypeW + gutter, y, scoreW, row2H);
  y += row2H + 16;

  const obsW = (contentW - gutter) * 0.56;
  const radarW = contentW - gutter - obsW;
  const row3H = 188;
  drawObservationsCard(doc, content, margin, y, obsW, row3H);
  drawComprehensiveCard(doc, content, margin + obsW + gutter, y, radarW, row3H);
  y += row3H + 16;

  // Insight box grows to fit the AI text; footer keeps a minimum height.
  const gapAfterInsight = 14;
  const minFooterH = 82;
  const maxInsightBottom = pageH - margin - minFooterH - gapAfterInsight;
  const insightH = Math.max(
    120,
    Math.min(measureInsightHeight(doc, content, contentW), maxInsightBottom - y)
  );
  drawInsightBox(doc, content, margin, y, contentW, insightH);
  y += insightH + gapAfterInsight;

  const footerH = pageH - margin - y;
  await drawContactFooter(doc, margin, y, contentW, Math.max(minFooterH, Math.min(footerH, 100)));

  return Buffer.from(doc.output("arraybuffer"));
}
