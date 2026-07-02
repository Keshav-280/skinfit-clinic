import { jsPDF } from "jspdf";
import sharp from "sharp";
import type { KaiObservationColor, KaiReportContent } from "./aiReport";
import { drawRadarChart, drawScoreGauge } from "./charts";
import { KAI_REPORT_EVENT_LABEL } from "./eventLabel";
import { type LogoAsset, loadHeaderLogo } from "./headerLogo";
import { A4_HEIGHT_MM, PDF_A4_OPTIONS, ptToMm } from "./pdfPage";
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
  teal: [102, 136, 126] as RGB,
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

const INSTAGRAM_URL = "https://www.instagram.com/skinfitwellness.in/";

/** A4 printable layout (millimetres). */
const MARGIN = ptToMm(32);
const GUTTER = ptToMm(16);
const LEFT_COL_RATIO = 0.56;
const HEADER_H = ptToMm(42);
const ROW2_MIN_H = ptToMm(88);
const ROW2_BOTTOM_TRIM_MM = (25 * 25.4) / 96;
const MIN_FOOTER_H = ptToMm(66);
const MAX_FOOTER_H = ptToMm(88);
const FOOTER_CTA_GAP = ptToMm(4);
const FOOTER_BOTTOM_PAD = ptToMm(4);
const FOOTER_QR_SIZE = ptToMm(42);
const FOOTER_QR_LABEL_GAP = ptToMm(3);
const FOOTER_QR_LABEL_H = ptToMm(6);
const MIN_INSIGHT_H = ptToMm(80);
const GAP_SECTION = ptToMm(10);
const GAP_AFTER_HEADER = ptToMm(12);
const GAP_AFTER_INSIGHT = ptToMm(5);
const CARD_PAD = ptToMm(16);
const CARD_RADIUS = ptToMm(12);
const SKIN_TYPE_CODE_BASELINE = ptToMm(40);
/** Vertical gap from Baumann code baseline to grey trait descriptor line. */
const SKIN_TYPE_CODE_TO_PLAIN_GAP = ptToMm(15);
const SKIN_TYPE_PLAIN_BASELINE = SKIN_TYPE_CODE_BASELINE + SKIN_TYPE_CODE_TO_PLAIN_GAP;
const IDENTITY_PROFILE_H = ptToMm(58);
const IDENTITY_PROFILE_W = ptToMm(46);

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

const MAP_TOP_CROP_RATIO = 0.1;
/** Keep the face-centered band; white-map scans have wide empty side margins. */
const MAP_CENTER_WIDTH_RATIO = 0.9;

function mapCropDimensions(srcW: number, srcH: number) {
  const cropTop = Math.min(srcH - 1, Math.floor(srcH * MAP_TOP_CROP_RATIO));
  const cropH = Math.max(1, srcH - cropTop);
  const contentW = Math.max(1, Math.floor(srcW * MAP_CENTER_WIDTH_RATIO));
  const insetX = Math.floor((srcW - contentW) / 2);
  return { cropTop, cropH, contentW, insetX };
}

async function measureMapDrawWidth(buffer: Buffer, slotH: number): Promise<number> {
  const meta = await sharp(buffer).metadata();
  const srcW = meta.width ?? 1;
  const srcH = meta.height ?? 1;
  const { cropH, contentW } = mapCropDimensions(srcW, srcH);
  const slotPxH = Math.max(1, Math.round((slotH * FACE_PRINT_DPI) / 25.4));
  const drawPxW = Math.max(1, Math.round((slotPxH * contentW) / cropH));
  return (drawPxW * 25.4) / FACE_PRINT_DPI;
}

async function prepareFaceImage(
  buffer: Buffer,
  slotW: number,
  slotH: number,
  variant: FaceSlotVariant
): Promise<PreparedFaceImage> {
  const slotPxW = Math.max(1, Math.round((slotW * FACE_PRINT_DPI) / 25.4));
  const slotPxH = Math.max(1, Math.round((slotH * FACE_PRINT_DPI) / 25.4));

  if (variant === "map") {
    const meta = await sharp(buffer).metadata();
    const srcW = meta.width ?? slotPxW;
    const srcH = meta.height ?? slotPxH;
    const { cropTop, cropH, contentW, insetX } = mapCropDimensions(srcW, srcH);
    const drawPxH = slotPxH;
    const drawPxW = Math.max(1, Math.round((drawPxH * contentW) / cropH));

    const jpg = await sharp(buffer)
      .extract({ left: insetX, top: cropTop, width: contentW, height: cropH })
      .resize(drawPxW, drawPxH, { fit: "fill" })
      .jpeg({ quality: 92 })
      .toBuffer();

    const drawW = (drawPxW * 25.4) / FACE_PRINT_DPI;
    const drawH = (drawPxH * 25.4) / FACE_PRINT_DPI;

    return {
      dataUrl: `data:image/jpeg;base64,${jpg.toString("base64")}`,
      drawW,
      drawH,
      offsetX: (slotW - drawW) / 2,
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
  const titleY = midY - (subtitle ? ptToMm(5.5) : 0);
  const subtitleY = midY + ptToMm(9.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(...KAI.navy);
  doc.text("Your personal skin analysis", pageW - MARGIN, titleY, { align: "right" });
  if (subtitle) {
    doc.setFontSize(10);
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
  const profileH = IDENTITY_PROFILE_H;
  const whiteMapH = profileH * 2 + profileGap;
  const profileColW = IDENTITY_PROFILE_W;
  const whiteMapW =
    medixoraLayout && data.faceImages?.front
      ? await measureMapDrawWidth(data.faceImages.front, whiteMapH)
      : profileColW * 1.5;
  const medixoraBlockW = whiteMapW + imgGap + profileColW;

  const fallbackImgH = ptToMm(100);
  const fallbackImgW = ptToMm(72);
  const fallbackBlockW =
    presentSlots.length > 0
      ? presentSlots.length * fallbackImgW + (presentSlots.length - 1) * imgGap
      : 0;

  const imgBlockW = medixoraLayout ? medixoraBlockW : fallbackBlockW;
  const imgBlockH = medixoraLayout ? whiteMapH : fallbackImgH;
  const textH = measureIdentityTextHeight(data);
  const rowH = Math.max(imgBlockH + ptToMm(10), textH + ptToMm(6));

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
  let h = SKIN_TYPE_PLAIN_BASELINE;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  const plainLines = wrap(doc, content.skinTypePlain, innerW);
  h += plainLines.length * ptToMm(11);
  h += ptToMm(4);
  const summaryLines = wrap(doc, content.skinTypeSummary, innerW);
  h += summaryLines.length * ptToMm(12);
  return h + ptToMm(2);
}

/** Fixed gap from score cluster to "Needs Attention" label (CSS px). */
const SCORE_TO_LABEL_GAP_MM = (35 * 25.4) / 96;
/** Lift status + grade lines closer to the gauge (CSS px). */
const SCORE_LABEL_LIFT_MM = (15 * 25.4) / 96;
const GAUGE_SCALE = 1.2;

function measureScoreCardHeight(doc: jsPDF, content: KaiReportContent, w: number): number {
  const layoutRadius = Math.min(w * 0.28 * GAUGE_SCALE, ptToMm(26 * GAUGE_SCALE));
  const gaugeDownOffset = ptToMm(10 * GAUGE_SCALE) + A4_HEIGHT_MM * 0.005 * GAUGE_SCALE;
  const gaugeTop = ptToMm(22 * GAUGE_SCALE);
  const gaugeBaseY = gaugeTop + layoutRadius + gaugeDownOffset;
  const scoreBlockBottom =
    gaugeBaseY -
    ptToMm(3 * GAUGE_SCALE) +
    ptToMm(6.5 * GAUGE_SCALE) +
    A4_HEIGHT_MM * 0.001 * GAUGE_SCALE +
    ptToMm(4 * GAUGE_SCALE);
  const scoreLabelY = scoreBlockBottom + SCORE_TO_LABEL_GAP_MM;
  const gradeY = scoreLabelY + ptToMm(10);
  return gradeY + ptToMm(2);
}

function measureRow2Height(
  doc: jsPDF,
  content: KaiReportContent,
  leftW: number,
  rightW: number
): number {
  const skinH = measureSkinTypeCardHeight(doc, content, leftW);
  const scoreH = measureScoreCardHeight(doc, content, rightW);
  const contentH = Math.max(skinH, scoreH);
  return Math.max(contentH, Math.max(ROW2_MIN_H, contentH) - ROW2_BOTTOM_TRIM_MM);
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
  doc.text(content.skinTypeCode || "—", x + pad, y + SKIN_TYPE_CODE_BASELINE);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...KAI.muted);
  const plainLines = wrap(doc, content.skinTypePlain, innerW);
  let py = y + SKIN_TYPE_PLAIN_BASELINE;
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

  const gaugeDownOffset = ptToMm(10 * GAUGE_SCALE) + A4_HEIGHT_MM * 0.005 * GAUGE_SCALE;
  const gaugeTop = y + ptToMm(22 * GAUGE_SCALE);
  const layoutRadius = Math.min(w * 0.28 * GAUGE_SCALE, ptToMm(26 * GAUGE_SCALE));
  const gaugeBaseY = gaugeTop + layoutRadius + gaugeDownOffset;
  const radius = Math.min(
    layoutRadius + ptToMm(3 * GAUGE_SCALE),
    w * 0.5 - ptToMm(4 * GAUGE_SCALE),
    ptToMm(29 * GAUGE_SCALE)
  );
  const gaugeThickness = ptToMm(6 * GAUGE_SCALE);
  drawScoreGauge(doc, cx, gaugeBaseY, radius, content.kaiScore, gaugeThickness);

  const scoreFontSize = 21 * GAUGE_SCALE;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(scoreFontSize);
  doc.setTextColor(...KAI.navy);
  const scoreY = gaugeBaseY - ptToMm(3 * GAUGE_SCALE);
  doc.text(String(content.kaiScore), cx, scoreY, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8 * GAUGE_SCALE);
  doc.setTextColor(...KAI.muted);
  doc.text(
    "/100",
    cx,
    scoreY + ptToMm(6.5 * GAUGE_SCALE) + A4_HEIGHT_MM * 0.001 * GAUGE_SCALE,
    { align: "center" }
  );

  const scoreBlockBottom =
    scoreY + ptToMm(6.5 * GAUGE_SCALE) + A4_HEIGHT_MM * 0.001 * GAUGE_SCALE + ptToMm(4 * GAUGE_SCALE);
  const scoreLabelY = scoreBlockBottom + SCORE_TO_LABEL_GAP_MM - SCORE_LABEL_LIFT_MM;
  const gradeY = scoreLabelY + ptToMm(10);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...KAI.navy);
  doc.text(content.kaiScoreLabel, cx, scoreLabelY, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...KAI.muted);
  doc.text(`${content.kaiScoreGrade} grade · ${content.kaiScoreBand}`, cx, gradeY, { align: "center" });
}

function observationCommentary(obs: KaiReportContent["observations"][number]): string {
  if (obs.commentary.trim()) return obs.commentary.trim();
  if (obs.score >= 60) {
    return `Scored ${obs.score}% on your comprehensive analysis — one of your strongest areas and a solid foundation to protect.`;
  }
  return `Scored ${obs.score}% on your comprehensive analysis — one of the areas that needs the most attention right now.`;
}

const OBS_HEADER_H = ptToMm(28);
const OBS_BOTTOM_PAD = ptToMm(3);
const OBS_DIVIDER_H = ptToMm(5);
const OBS_TITLE_TOP = ptToMm(10);
const OBS_TITLE_LINE_H = ptToMm(11);
const OBS_COMMENTARY_GAP = ptToMm(2);
const OBS_COMMENTARY_LINE_H = ptToMm(10.5);
const OBS_ROW_END_PAD = ptToMm(4);

function observationRowLayout(
  doc: jsPDF,
  obs: KaiReportContent["observations"][number],
  w: number
) {
  const pad = CARD_PAD;
  const innerW = w - pad * 2;
  const titleX = pad + ptToMm(14);

  const pillLabel = `score ${obs.score}`;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  const pillW = doc.getTextWidth(pillLabel) + ptToMm(16);
  const pillX = w - pad - pillW;
  const titleMaxW = pillX - titleX - ptToMm(6);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  const titleLines = wrap(doc, obs.title, titleMaxW);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const commentaryLines = wrap(doc, observationCommentary(obs), innerW - ptToMm(14));

  const contentH =
    OBS_TITLE_TOP +
    titleLines.length * OBS_TITLE_LINE_H +
    OBS_COMMENTARY_GAP +
    commentaryLines.length * OBS_COMMENTARY_LINE_H +
    OBS_ROW_END_PAD;

  return {
    titleLines,
    commentaryLines,
    contentH: Math.max(ptToMm(16), contentH),
  };
}

function measureObservationRowHeight(
  doc: jsPDF,
  obs: KaiReportContent["observations"][number],
  w: number
): number {
  return observationRowLayout(doc, obs, w).contentH;
}

function measureObservationsCardHeight(doc: jsPDF, content: KaiReportContent, w: number): number {
  const observations = content.observations.slice(0, 3);
  if (!observations.length) return OBS_HEADER_H + OBS_BOTTOM_PAD;

  let bodyH = 0;
  observations.forEach((obs, index) => {
    bodyH += measureObservationRowHeight(doc, obs, w);
    if (index < observations.length - 1) bodyH += OBS_DIVIDER_H;
  });
  return OBS_HEADER_H + bodyH + OBS_BOTTOM_PAD;
}

function measureRow3Height(
  doc: jsPDF,
  content: KaiReportContent,
  leftW: number
): number {
  return measureObservationsCardHeight(doc, content, leftW);
}

function drawObservationsCard(
  doc: jsPDF,
  content: KaiReportContent,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const pad = CARD_PAD;
  const observations = content.observations.slice(0, 3);
  const cardH = measureObservationsCardHeight(doc, content, w);
  roundedCard(doc, x, y, w, Math.max(h, cardH));
  sectionLabel(doc, "top 3 observations", x + pad, y + ptToMm(16));

  const titleX = x + pad + ptToMm(14);
  if (!observations.length) return;

  let cy = y + OBS_HEADER_H;

  observations.forEach((obs, index) => {
    const { titleLines, commentaryLines, contentH: rowH } = observationRowLayout(doc, obs, w);
    const rowTop = cy;
    const rowBottom = rowTop + rowH;
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
    let ty = rowTop + OBS_TITLE_TOP;
    for (const line of titleLines) {
      doc.text(line, titleX, ty);
      ty += OBS_TITLE_LINE_H;
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...KAI.ink);
    ty += OBS_COMMENTARY_GAP;
    for (const line of commentaryLines) {
      doc.text(line, titleX, ty);
      ty += OBS_COMMENTARY_LINE_H;
    }

    if (index < observations.length - 1) {
      const dividerY = rowBottom + OBS_DIVIDER_H / 2;
      doc.setDrawColor(...KAI.divider);
      doc.setLineWidth(ptToMm(0.5));
      doc.line(x + pad, dividerY, x + w - pad, dividerY);
      cy = rowBottom + OBS_DIVIDER_H;
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

const INSIGHT_LAYOUTS = [
  { fontSize: 9, lineH: ptToMm(11.5), pad: ptToMm(14), textTop: ptToMm(32), bottomPad: ptToMm(8) },
  { fontSize: 8.5, lineH: ptToMm(10.5), pad: ptToMm(12), textTop: ptToMm(30), bottomPad: ptToMm(6) },
  { fontSize: 8, lineH: ptToMm(9.5), pad: ptToMm(10), textTop: ptToMm(28), bottomPad: ptToMm(5) },
] as const;

type InsightLayout = (typeof INSIGHT_LAYOUTS)[number];

function insightWrappedLines(
  doc: jsPDF,
  text: string,
  w: number,
  layout: InsightLayout
): string[] {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  doc.setFont("helvetica", "normal");
  doc.setFontSize(layout.fontSize);
  return wrap(doc, cleaned, w - layout.pad * 2);
}

function measureInsightHeight(
  doc: jsPDF,
  insight: string,
  w: number,
  layout: InsightLayout
): number {
  const lines = insightWrappedLines(doc, insight, w, layout);
  if (!lines.length) return layout.textTop + layout.bottomPad + ptToMm(8);
  return layout.textTop + lines.length * layout.lineH + layout.bottomPad;
}

function maxInsightLinesForHeight(maxH: number, layout: InsightLayout): number {
  return Math.max(1, Math.floor((maxH - layout.textTop - layout.bottomPad) / layout.lineH));
}

function splitSentences(text: string): string[] {
  return text.match(/[^.!?]+[.!?]+/g) ?? [text];
}

const INSIGHT_MIN_SENTENCES = 4;

/** Prefer shrinking font/padding over dropping sentences; keep at least 4 when possible. */
function resolveInsightLayout(
  doc: jsPDF,
  text: string,
  w: number,
  maxH: number
): { layout: InsightLayout; text: string } {
  const cleaned = text.replace(/\s+/g, " ").trim();
  const fallback = INSIGHT_LAYOUTS[0];
  if (!cleaned) return { layout: fallback, text: "" };

  for (const layout of INSIGHT_LAYOUTS) {
    const h = measureInsightHeight(doc, cleaned, w, layout);
    if (h <= maxH) return { layout, text: cleaned };
  }

  const smallest = INSIGHT_LAYOUTS[INSIGHT_LAYOUTS.length - 1];
  const maxLines = maxInsightLinesForHeight(maxH, smallest);
  const sentences = splitSentences(cleaned);
  const minKeep = Math.min(INSIGHT_MIN_SENTENCES, sentences.length);

  for (let keep = sentences.length; keep >= minKeep; keep -= 1) {
    const candidate = sentences.slice(0, keep).join(" ").replace(/\s+/g, " ").trim();
    if (insightWrappedLines(doc, candidate, w, smallest).length <= maxLines) {
      return { layout: smallest, text: candidate };
    }
  }

  let best = sentences[0]?.trim() ?? cleaned;
  for (const sentence of sentences) {
    const candidate = (best === sentences[0]?.trim() ? sentence : `${best} ${sentence}`)
      .replace(/\s+/g, " ")
      .trim();
    if (insightWrappedLines(doc, candidate, w, smallest).length <= maxLines) best = candidate;
    else break;
  }

  return { layout: smallest, text: best };
}

function drawInsightBox(
  doc: jsPDF,
  insight: string,
  x: number,
  y: number,
  w: number,
  h: number,
  layout: InsightLayout
) {
  doc.setFillColor(...KAI.cream);
  doc.setDrawColor(...KAI.navy);
  doc.setLineWidth(0.35);
  doc.roundedRect(x, y, w, h, CARD_RADIUS, CARD_RADIUS, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...KAI.navy);
  doc.text("YOUR PERSONALISED NEXT STEP", x + layout.pad, y + ptToMm(20), { charSpace: 0.6 });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(layout.fontSize);
  doc.setTextColor(...KAI.navy);
  const lines = insightWrappedLines(doc, insight, w, layout);
  let ty = y + layout.textTop;
  for (const line of lines) {
    doc.text(line, x + layout.pad, ty);
    ty += layout.lineH;
  }
}

function measureLocationBlockHeight(doc: jsPDF, address: string, colW: number): number {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  let h = ptToMm(12);
  for (const _line of wrap(doc, address, colW - 4)) {
    h += ptToMm(8.5);
  }
  return h + ptToMm(3) + ptToMm(8);
}

function footerLayoutMetrics(doc: jsPDF, w: number) {
  const pad = CARD_PAD;
  const qrSize = FOOTER_QR_SIZE;
  const qrGap = ptToMm(16);
  const qrX = w - pad - qrSize;
  const locGap = ptToMm(16);
  const locAreaW = qrX - pad - qrGap;
  const colW = (locAreaW - locGap) / 2;
  const ashokH = measureLocationBlockHeight(doc, CLINIC_LOCATIONS[0].address, colW);
  const koraH = measureLocationBlockHeight(doc, CLINIC_LOCATIONS[1].address, colW);
  const qrStackH = qrSize + FOOTER_QR_LABEL_GAP + FOOTER_QR_LABEL_H;
  const rightRowH = Math.max(koraH, qrStackH);
  const contentBlockH = Math.max(ashokH, rightRowH);
  return { pad, qrSize, qrGap, qrX, locGap, colW, ashokH, koraH, qrStackH, rightRowH, contentBlockH };
}

function measureContactFooterHeight(doc: jsPDF, w: number): number {
  const { contentBlockH } = footerLayoutMetrics(doc, w);
  const labelH = ptToMm(28);
  const ctaH = ptToMm(8);
  return Math.max(
    labelH + ptToMm(4) + contentBlockH + FOOTER_CTA_GAP + ctaH + FOOTER_BOTTOM_PAD,
    MIN_FOOTER_H
  );
}

function drawLocationBlock(
  doc: jsPDF,
  ax: number,
  titleBaseline: number,
  title: string,
  loc: (typeof CLINIC_LOCATIONS)[number],
  colW: number
) {
  let ay = titleBaseline;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...KAI.navy);
  doc.text(title, ax, ay);
  ay += ptToMm(12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...KAI.ink);
  for (const line of wrap(doc, loc.address, colW - 4)) {
    doc.text(line, ax, ay);
    ay += ptToMm(8.5);
  }
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...KAI.navy);
  ay += ptToMm(3);
  doc.text(loc.phone, ax, ay);
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

  const { qrSize, qrGap, qrX, locGap, colW, koraH, qrStackH, rightRowH, contentBlockH } =
    footerLayoutMetrics(doc, w);

  const contentTop = y + ptToMm(28);
  const contentBlockTop = contentTop + ptToMm(4);
  const contentMid = contentBlockTop + contentBlockH / 2;
  const contentBlockBottom = contentBlockTop + contentBlockH;
  const ctaBaseline = contentBlockBottom + FOOTER_CTA_GAP;

  const contentBlockStart = contentMid - contentBlockH / 2;
  drawLocationBlock(doc, x + pad, contentBlockStart, "Ashok Nagar", CLINIC_LOCATIONS[0], colW);

  const rightRowTop = contentMid - rightRowH / 2;
  const koraTitleBaseline = rightRowTop + (rightRowH - koraH) / 2;
  const koraX = x + pad + colW + locGap;
  drawLocationBlock(doc, koraX, koraTitleBaseline, "Koramangala", CLINIC_LOCATIONS[1], colW);

  const qrStackTop = rightRowTop + (rightRowH - qrStackH) / 2;
  const qrY = qrStackTop;
  const qrDataUrl = await reportQrDataUrl(INSTAGRAM_URL);
  doc.addImage(qrDataUrl, "PNG", x + qrX, qrY, qrSize, qrSize);

  const qrLabel = "@SKINFITWELLNESS.IN";
  let labelSize = 5.5;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...KAI.muted);
  doc.setFontSize(labelSize);
  while (doc.getTextWidth(qrLabel) > qrSize && labelSize > 4) {
    labelSize -= 0.25;
    doc.setFontSize(labelSize);
  }
  doc.text(qrLabel, x + qrX + qrSize / 2, qrY + qrSize + FOOTER_QR_LABEL_GAP, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...KAI.coral);
  doc.text("Book your consult", x + pad, ctaBaseline);
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
  await drawHeader(doc, logo, data, options.eventLabel?.trim() || KAI_REPORT_EVENT_LABEL);

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

  const requiredFooterH = measureContactFooterHeight(doc, contentW);
  const measuredRow3H = measureRow3Height(doc, content, leftColW);

  const row3H = measuredRow3H;
  drawObservationsCard(doc, content, MARGIN, y, leftColW, row3H);
  drawComprehensiveCard(doc, content, rightColX, y, rightColW, row3H);
  y += row3H + GAP_SECTION;

  const footerY = pageH - MARGIN - requiredFooterH;
  const insightAvailable = Math.max(MIN_INSIGHT_H, footerY - GAP_AFTER_INSIGHT - y);
  const { layout: insightLayout, text: fittedInsight } = resolveInsightLayout(
    doc,
    content.insight,
    contentW,
    insightAvailable
  );
  const insightH = measureInsightHeight(doc, fittedInsight, contentW, insightLayout);

  drawInsightBox(doc, fittedInsight, MARGIN, y, contentW, insightH, insightLayout);

  await drawContactFooter(doc, MARGIN, footerY, contentW, requiredFooterH);

  return Buffer.from(doc.output("arraybuffer"));
}
