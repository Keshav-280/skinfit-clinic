import { jsPDF } from "jspdf";
import sharp from "sharp";
import type { KaiObservationColor, KaiReportContent } from "./aiReport";
import { drawRadarChart, drawScoreGauge } from "./charts";
import { type LogoAsset, loadHeaderLogo } from "./headerLogo";
import { PDF_A4_OPTIONS, ptToMm } from "./pdfPage";
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

/** A4 printable layout (millimetres). */
const MARGIN = ptToMm(32);
const GUTTER = ptToMm(16);
const LEFT_COL_RATIO = 0.56;
const HEADER_H = ptToMm(50);
const ROW2_MIN_H = ptToMm(88);
const ROW3_H = 80;
const MIN_FOOTER_H = ptToMm(66);
const MAX_FOOTER_H = ptToMm(82);
const MIN_INSIGHT_H = ptToMm(80);
const GAP_SECTION = ptToMm(12);
const GAP_AFTER_HEADER = ptToMm(14);
const GAP_AFTER_INSIGHT = ptToMm(10);
const CARD_PAD = ptToMm(16);
const CARD_RADIUS = ptToMm(12);

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

type FaceSlotVariant = "map" | "profile";

const FACE_PRINT_DPI = 300;

type PreparedFaceImage = {
  dataUrl: string;
  drawW: number;
  drawH: number;
  offsetX: number;
  offsetY: number;
};

async function prepareFaceImage(
  buffer: Buffer,
  slotW: number,
  slotH: number,
  variant: FaceSlotVariant
): Promise<PreparedFaceImage> {
  const slotPxW = Math.max(1, Math.round((slotW * FACE_PRINT_DPI) / 25.4));
  const slotPxH = Math.max(1, Math.round((slotH * FACE_PRINT_DPI) / 25.4));

  if (variant === "map") {
    const jpg = await sharp(buffer)
      .resize(slotPxW, slotPxH, { fit: "cover", position: "centre" })
      .jpeg({ quality: 92 })
      .toBuffer();
    return {
      dataUrl: `data:image/jpeg;base64,${jpg.toString("base64")}`,
      drawW: slotW,
      drawH: slotH,
      offsetX: 0,
      offsetY: 0,
    };
  }

  const meta = await sharp(buffer).metadata();
  const srcW = meta.width ?? slotPxW;
  const srcH = meta.height ?? slotPxH;
  const scale = Math.min(slotPxW / srcW, slotPxH / srcH);
  const drawPxW = Math.max(1, Math.round(srcW * scale));
  const drawPxH = Math.max(1, Math.round(srcH * scale));

  const jpg = await sharp(buffer)
    .resize(drawPxW, drawPxH, { fit: "inside" })
    .jpeg({ quality: 92 })
    .toBuffer();

  const drawW = (drawPxW * 25.4) / FACE_PRINT_DPI;
  const drawH = (drawPxH * 25.4) / FACE_PRINT_DPI;

  return {
    dataUrl: `data:image/jpeg;base64,${jpg.toString("base64")}`,
    drawW,
    drawH,
    offsetX: (slotW - drawW) / 2,
    offsetY: (slotH - drawH) / 2,
  };
}

async function drawFaceImageSlot(
  doc: jsPDF,
  buffer: Buffer,
  x: number,
  y: number,
  w: number,
  h: number,
  variant: FaceSlotVariant
) {
  const prepared = await prepareFaceImage(buffer, w, h, variant);
  doc.addImage(
    prepared.dataUrl,
    "JPEG",
    x + prepared.offsetX,
    y + prepared.offsetY,
    prepared.drawW,
    prepared.drawH
  );
}

function measureIdentityTextHeight(data: SdetectReportData): number {
  let h = ptToMm(22) + ptToMm(20) + ptToMm(6);
  if (data.patient.age > 0) h += ptToMm(13);
  const phone = formatPatientPhone(data.patient.phone);
  if (phone && phone !== "—") h += ptToMm(13);
  if (data.patient.reportDate && data.patient.reportDate !== "—") h += ptToMm(13);
  if (data.patient.scanFrequency > 0) h += ptToMm(13);
  return h + ptToMm(10);
}

const FACE_SLOT_ORDER: Array<keyof SdetectFaceImages> = ["left", "front", "right"];

function presentFaceSlots(faceImages: SdetectFaceImages): Array<keyof SdetectFaceImages> {
  return FACE_SLOT_ORDER.filter((key) => faceImages[key] != null);
}

function hasMedixoraFaceLayout(faceImages: SdetectFaceImages): boolean {
  return faceImages.left != null && faceImages.front != null && faceImages.right != null;
}

function roundedCard(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  radius = CARD_RADIUS,
  fill: RGB = KAI.card
) {
  doc.setFillColor(...fill);
  doc.setDrawColor(...KAI.cardBorder);
  doc.setLineWidth(0.2);
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
  const h = HEADER_H;

  doc.setFillColor(...KAI.white);
  doc.rect(0, 0, pageW, h, "F");

  const logoY = (h - logo.displayH) / 2;
  doc.addImage(logo.dataUrl, "PNG", MARGIN, logoY, logo.displayW, logo.displayH);

  const subtitle = [eventLabel.trim(), data.patient.reportDate]
    .filter((s) => s && s !== "—")
    .join("  ·  ");
  const midY = h / 2;
  const titleY = midY - (subtitle ? ptToMm(5) : 0);
  const subtitleY = midY + ptToMm(9);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...KAI.navy);
  doc.text("Your personal skin analysis", pageW - MARGIN, titleY, { align: "right" });
  if (subtitle) {
    doc.setTextColor(...KAI.coral);
    doc.text(subtitle, pageW - MARGIN, subtitleY, { align: "right" });
  }
}

async function drawIdentityRow(
  doc: jsPDF,
  data: SdetectReportData,
  x: number,
  y: number,
  w: number
): Promise<number> {
  const pad = CARD_PAD;
  const medixoraLayout = data.faceImages != null && hasMedixoraFaceLayout(data.faceImages);
  const presentSlots = data.faceImages ? presentFaceSlots(data.faceImages) : [];

  const imgGap = ptToMm(6);
  const profileGap = ptToMm(4);
  const profileH = ptToMm(50);
  const whiteMapH = profileH * 2 + profileGap;
  const profileColW = ptToMm(42);
  const whiteMapW = ptToMm(50);
  const medixoraBlockW = whiteMapW + imgGap + profileColW;

  const fallbackImgH = ptToMm(88);
  const fallbackImgW = ptToMm(66);
  const fallbackBlockW =
    presentSlots.length > 0
      ? presentSlots.length * fallbackImgW + (presentSlots.length - 1) * imgGap
      : 0;

  const imgBlockW = medixoraLayout ? medixoraBlockW : fallbackBlockW;
  const imgBlockH = medixoraLayout ? whiteMapH : fallbackImgH;
  const textH = measureIdentityTextHeight(data);
  const rowH = Math.max(imgBlockH + CARD_PAD, textH + ptToMm(8));

  roundedCard(doc, x, y, w, rowH);

  const textX = x + pad;
  let ty = y + ptToMm(22);
  sectionLabel(doc, "analysed for", textX, ty);

  ty += ptToMm(20);
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
    doc.text(gender, textX + nameW + ptToMm(10), ty);
  }

  const detailLine = (label: string, value: string) => {
    if (!value || value === "—") return;
    ty += ptToMm(13);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...KAI.muted);
    doc.text(label, textX, ty);
    doc.setTextColor(...KAI.ink);
    doc.text(value, textX + ptToMm(92), ty);
  };

  ty += ptToMm(6);
  if (data.patient.age > 0) {
    detailLine("Age", `${data.patient.age} yrs`);
  }
  detailLine("Contact", formatPatientPhone(data.patient.phone));
  detailLine("Date of report", data.patient.reportDate);
  if (data.patient.scanFrequency > 0) {
    detailLine("Skin analysis frequency", String(data.patient.scanFrequency));
  }

  if (data.faceImages && presentSlots.length > 0) {
    const imgY = y + (rowH - imgBlockH) / 2;
    const imgBlockRight = x + w - pad;

    if (medixoraLayout) {
      const whiteMapX = imgBlockRight - imgBlockW;
      const profileX = whiteMapX + whiteMapW + imgGap;
      const front = data.faceImages.front!;
      await drawFaceImageSlot(doc, front, whiteMapX, imgY, whiteMapW, whiteMapH, "map");
      let profileY = imgY;
      if (data.faceImages.left) {
        await drawFaceImageSlot(
          doc,
          data.faceImages.left,
          profileX,
          profileY,
          profileColW,
          profileH,
          "profile"
        );
        profileY += profileH + profileGap;
      }
      if (data.faceImages.right) {
        const rightH =
          data.faceImages.left != null ? profileH : whiteMapH;
        await drawFaceImageSlot(
          doc,
          data.faceImages.right,
          profileX,
          profileY,
          profileColW,
          rightH,
          "profile"
        );
      }
    } else {
      let ix = imgBlockRight - imgBlockW;
      for (const key of presentSlots) {
        const buf = data.faceImages[key];
        if (!buf) continue;
        const variant: FaceSlotVariant = key === "front" ? "map" : "profile";
        await drawFaceImageSlot(doc, buf, ix, imgY, fallbackImgW, fallbackImgH, variant);
        ix += fallbackImgW + imgGap;
      }
    }
  }

  return y + rowH;
}

function measureSkinTypeCardHeight(
  doc: jsPDF,
  content: KaiReportContent,
  w: number
): number {
  const pad = CARD_PAD;
  const innerW = w - pad * 2;
  let h = ptToMm(16) + ptToMm(4);
  h += ptToMm(18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  const plainLines = wrap(doc, content.skinTypePlain, innerW);
  h += plainLines.length * ptToMm(11);
  h += ptToMm(4);
  const summaryLines = wrap(doc, content.skinTypeSummary, innerW);
  h += summaryLines.length * ptToMm(12);
  return h + ptToMm(8);
}

function measureScoreCardHeight(doc: jsPDF, content: KaiReportContent, w: number): number {
  const radius = Math.min(w * 0.28, ptToMm(28));
  return ptToMm(16) + radius + ptToMm(4) + ptToMm(19) + ptToMm(8);
}

function measureRow2Height(
  doc: jsPDF,
  content: KaiReportContent,
  leftW: number,
  rightW: number
): number {
  return Math.max(
    ROW2_MIN_H,
    measureSkinTypeCardHeight(doc, content, leftW),
    measureScoreCardHeight(doc, content, rightW)
  );
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
  const pad = CARD_PAD;
  const innerW = w - pad * 2;
  sectionLabel(doc, "your skin type", x + pad, y + ptToMm(16));

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...KAI.navy);
  doc.text(content.skinTypeCode || "—", x + pad, y + ptToMm(34));

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...KAI.muted);
  const plainLines = wrap(doc, content.skinTypePlain, innerW);
  let py = y + ptToMm(46);
  for (const line of plainLines) {
    doc.text(line, x + pad, py);
    py += ptToMm(11);
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...KAI.ink);
  const summaryLines = wrap(doc, content.skinTypeSummary, innerW);
  let sy = py + ptToMm(4);
  for (const line of summaryLines) {
    if (sy > y + h - ptToMm(6)) break;
    doc.text(line, x + pad, sy);
    sy += ptToMm(12);
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
  sectionLabel(doc, "skinfit score", cx, y + ptToMm(16), "center");

  const bottomPad = ptToMm(8);
  const gradeY = y + h - bottomPad;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...KAI.muted);
  doc.text(`${content.kaiScoreGrade} grade · ${content.kaiScoreBand}`, cx, gradeY, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...KAI.navy);
  const scoreLabelY = gradeY - ptToMm(9);
  doc.text(content.kaiScoreLabel, cx, scoreLabelY, { align: "center" });

  const preGaugeBaseY = scoreLabelY - ptToMm(13);
  const gaugeTop = y + ptToMm(22);
  const maxRadiusByHeight = Math.max(ptToMm(12), preGaugeBaseY - gaugeTop);
  const radius = Math.min(w * 0.28, ptToMm(28), maxRadiusByHeight);
  // Raise the arc independently so it sits above the score with clear gap.
  const gaugeBaseY = preGaugeBaseY - radius * 0.28;
  drawScoreGauge(doc, cx, gaugeBaseY, radius, content.kaiScore, ptToMm(5));

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...KAI.navy);
  const scoreY = preGaugeBaseY - radius * 0.1;
  doc.text(String(content.kaiScore), cx, scoreY, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...KAI.muted);
  doc.text("/100", cx, scoreY + ptToMm(8), { align: "center" });
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
  const pad = CARD_PAD;
  sectionLabel(doc, "top 3 observations", x + pad, y + ptToMm(20));

  const innerW = w - pad * 2;
  const titleX = x + pad + ptToMm(14);
  const observations = content.observations.slice(0, 3);
  if (!observations.length) return;

  const headerH = ptToMm(32);
  const bottomPad = ptToMm(8);
  const dividerH = ptToMm(10);
  const dividerCount = Math.max(observations.length - 1, 0);
  const bodyH = h - headerH - bottomPad;
  const rowH = (bodyH - dividerCount * dividerH) / observations.length;

  let cy = y + headerH;

  observations.forEach((obs, index) => {
    const rowTop = cy;
    const rowBottom = rowTop + rowH;
    const textLimit = rowBottom - ptToMm(4);
    const style = OBS_STYLE[obs.color];
    const dotX = x + pad + ptToMm(3);

    doc.setFillColor(...style.dot);
    doc.circle(dotX, rowTop + ptToMm(5), ptToMm(3), "F");

    const pillLabel = `score ${obs.score}`;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    const pillTextW = doc.getTextWidth(pillLabel);
    const pillW = pillTextW + ptToMm(16);
    const pillH = ptToMm(15);
    const pillX = x + w - pad - pillW;
    doc.setFillColor(...style.pillBg);
    doc.roundedRect(pillX, rowTop + ptToMm(1), pillW, pillH, ptToMm(7), ptToMm(7), "F");
    doc.setTextColor(...style.pillText);
    doc.text(pillLabel, pillX + pillW / 2, rowTop + ptToMm(11), { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...KAI.navy);
    const titleMaxW = pillX - titleX - ptToMm(6);
    const titleLines = wrap(doc, obs.title, titleMaxW);
    let ty = rowTop + ptToMm(10);
    for (const line of titleLines) {
      if (ty > textLimit) break;
      doc.text(line, titleX, ty);
      ty += ptToMm(12);
    }

    const commentary =
      obs.commentary.trim() ||
      `Scored ${obs.score}% on your comprehensive analysis — one of the areas that needs the most attention right now.`;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...KAI.ink);
    const commentaryLines = wrap(doc, commentary, innerW - ptToMm(14));
    const commentaryLineH = ptToMm(10.5);
    ty += ptToMm(2);
    for (const line of commentaryLines) {
      if (ty > textLimit) break;
      doc.text(line, titleX, ty);
      ty += commentaryLineH;
    }

    if (index < observations.length - 1) {
      const dividerY = rowBottom + dividerH / 2;
      doc.setDrawColor(...KAI.divider);
      doc.setLineWidth(ptToMm(0.5));
      doc.line(x + pad, dividerY, x + w - pad, dividerY);
      cy = rowBottom + dividerH;
    } else {
      cy = rowBottom;
    }
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
  const titleY = y + ptToMm(18);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...KAI.navy);
  doc.text("Comprehensive Analysis", x + w / 2, titleY, { align: "center" });

  const metrics = content.radarLabels.map((label, i) => ({
    label,
    score: content.radarValues[i] ?? 0,
  }));
  const chartPadX = ptToMm(4);
  const chartTop = y + ptToMm(22);
  const chartBottom = y + h - ptToMm(6);
  drawRadarChart(
    doc,
    metrics,
    {
      x: x + chartPadX,
      y: chartTop,
      w: w - chartPadX * 2,
      h: chartBottom - chartTop,
      labelMinY: chartTop + ptToMm(1),
      labelMaxY: chartBottom - ptToMm(1),
    },
    { compact: metrics.length > 8 }
  );
}

const INSIGHT_PAD = ptToMm(18);
const INSIGHT_LINE_H = ptToMm(12);
const INSIGHT_FONT = 9;
const INSIGHT_TEXT_TOP = ptToMm(36);

/** Height needed to render the full insight text at the report width. */
function measureInsightHeight(doc: jsPDF, content: KaiReportContent, w: number): number {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(INSIGHT_FONT);
  const lines = wrap(doc, content.insight, w - INSIGHT_PAD * 2);
  return INSIGHT_TEXT_TOP + lines.length * INSIGHT_LINE_H + ptToMm(12);
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
  doc.roundedRect(x, y, w, h, CARD_RADIUS, CARD_RADIUS, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...KAI.coralLight);
  doc.text("YOUR PERSONALISED NEXT STEP", x + INSIGHT_PAD, y + ptToMm(20), { charSpace: 0.6 });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(INSIGHT_FONT);
  doc.setTextColor(...KAI.white);
  const lines = wrap(doc, content.insight, w - INSIGHT_PAD * 2);
  let ty = y + INSIGHT_TEXT_TOP;
  for (const line of lines) {
    if (ty > y + h - ptToMm(10)) break;
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
  roundedCard(doc, x, y, w, h, CARD_RADIUS, KAI.cream);
  const pad = CARD_PAD;
  sectionLabel(doc, "contact details of skinfit", x + pad, y + ptToMm(18));

  const qrSize = h - ptToMm(24);
  const qrX = x + w - pad - qrSize;
  const qrY = y + ptToMm(14);
  const qrDataUrl = await reportQrDataUrl(BOOKING_URL);
  doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...KAI.muted);
  doc.text("scan to book", qrX + qrSize / 2, qrY + qrSize + ptToMm(8), { align: "center" });

  const colW = (qrX - (x + pad) - ptToMm(16)) / 2;
  CLINIC_LOCATIONS.forEach((loc, i) => {
    const ax = x + pad + i * (colW + ptToMm(16));
    let ay = y + ptToMm(34);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...KAI.navy);
    doc.text(i === 0 ? "Ashok Nagar" : "Koramangala", ax, ay);
    ay += ptToMm(12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...KAI.ink);
    for (const line of wrap(doc, loc.address, colW - 4)) {
      doc.text(line, ax, ay);
      ay += ptToMm(9);
    }
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...KAI.navy);
    doc.text(loc.phone, ax, ay + ptToMm(2));
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...KAI.coral);
  doc.text("Book your consult at my.skinfitwellness.in", x + pad, y + h - ptToMm(12));
}

export async function generateKaiReportPdf(
  data: SdetectReportData,
  content: KaiReportContent,
  options: { eventLabel?: string } = {}
): Promise<Buffer> {
  const doc = new jsPDF(PDF_A4_OPTIONS);
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - MARGIN * 2;

  doc.setFillColor(...KAI.cream);
  doc.rect(0, 0, pageW, pageH, "F");

  const logo = await loadHeaderLogo();
  await drawHeader(doc, logo, data, options.eventLabel ?? "");

  let y = HEADER_H + GAP_AFTER_HEADER;
  y = await drawIdentityRow(doc, data, MARGIN, y, contentW);
  y += GAP_SECTION;

  const leftColW = (contentW - GUTTER) * LEFT_COL_RATIO;
  const rightColW = contentW - GUTTER - leftColW;
  const rightColX = MARGIN + leftColW + GUTTER;

  const row2H = measureRow2Height(doc, content, leftColW, rightColW);
  drawSkinTypeCard(doc, content, MARGIN, y, leftColW, row2H);
  drawScoreCard(doc, content, rightColX, y, rightColW, row2H);
  y += row2H + GAP_SECTION;

  drawObservationsCard(doc, content, MARGIN, y, leftColW, ROW3_H);
  drawComprehensiveCard(doc, content, rightColX, y, rightColW, ROW3_H);
  y += ROW3_H + GAP_SECTION;

  const maxInsightBottom = pageH - MARGIN - MIN_FOOTER_H - GAP_AFTER_INSIGHT;
  const insightAvailable = Math.max(0, maxInsightBottom - y);
  const measuredInsight = measureInsightHeight(doc, content, contentW);
  const insightH = Math.min(
    Math.max(MIN_INSIGHT_H, measuredInsight),
    insightAvailable
  );
  drawInsightBox(doc, content, MARGIN, y, contentW, insightH);
  y += insightH + GAP_AFTER_INSIGHT;

  const footerH = pageH - MARGIN - y;
  await drawContactFooter(
    doc,
    MARGIN,
    y,
    contentW,
    Math.max(MIN_FOOTER_H, Math.min(footerH, MAX_FOOTER_H))
  );

  return Buffer.from(doc.output("arraybuffer"));
}
