import { readFile } from "node:fs/promises";
import path from "node:path";
import { jsPDF } from "jspdf";
import sharp from "sharp";
import { drawLineChart, drawRadarChart, SKINFIT_REPORT_THEME } from "./charts";
import { reportQrDataUrl } from "./qrCode";
import type { SdetectFaceImages, SdetectReportData } from "./types";

type LogoAsset = { dataUrl: string; displayW: number; displayH: number };
type SignatureAsset = { dataUrl: string; aspect: number };

const CLINIC_LOCATIONS = [
  {
    address:
      "5, Richmond Rd, Shanthala Nagar, Ashok Nagar, Bengaluru, Karnataka 560025",
    phone: "+91 90354 07057",
  },
  {
    address:
      "3rd Floor, 534/A, 7th Cross Road, 4th Block, Koramangala, Bengaluru - 560034",
    phone: "+91 91879 67633",
  },
] as const;

const QR_FALLBACK_URL = "https://my.skinfitwellness.in";

/** Vertical space reserved at page bottom for rule + footer content. */
const FOOTER_RESERVE = 118;
/** Gap between the horizontal rule and footer content below it. */
const FOOTER_RULE_CONTENT_GAP = 16;

let logoCache: LogoAsset | null = null;
let signatureCache: SignatureAsset | null = null;

const LOGO_DISPLAY_H = 32;

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

async function loadSignatureImage(): Promise<SignatureAsset> {
  if (signatureCache) return signatureCache;

  const sigPath = path.join(process.cwd(), "public/branding/dr-skin-fit-signature.png");
  const buffer = await readFile(sigPath);
  const meta = await sharp(buffer).metadata();
  const png = await sharp(buffer).png({ compressionLevel: 6 }).toBuffer();

  signatureCache = {
    dataUrl: `data:image/png;base64,${png.toString("base64")}`,
    aspect: (meta.width ?? 492) / (meta.height ?? 192),
  };
  return signatureCache;
}

function drawGreyCard(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  radius = 10
) {
  doc.setFillColor(...SKINFIT_REPORT_THEME.cardGrey);
  doc.setDrawColor(...SKINFIT_REPORT_THEME.cardBorder);
  doc.setLineWidth(0.75);
  doc.roundedRect(x, y, w, h, radius, radius, "FD");
}

async function imageCoverBottomDataUrl(
  buffer: Buffer,
  displayW: number,
  displayH: number
): Promise<string> {
  const pixelW = Math.max(64, Math.round(displayW * 3));
  const pixelH = Math.max(64, Math.round(displayH * 3));
  const jpg = await sharp(buffer)
    .resize(pixelW, pixelH, { fit: "cover", position: "bottom" })
    .jpeg({ quality: 90 })
    .toBuffer();
  return `data:image/jpeg;base64,${jpg.toString("base64")}`;
}

const FACE_SLOT_ORDER: Array<keyof SdetectFaceImages> = ["left", "front", "right"];

function wrap(doc: jsPDF, text: string, maxWidth: number): string[] {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  return doc.splitTextToSize(cleaned, maxWidth);
}

function measureWrappedLines(
  doc: jsPDF,
  text: string,
  maxWidth: number,
  fontSize: number,
  fontStyle: "normal" | "bold" = "normal"
): number {
  doc.setFont("helvetica", fontStyle);
  doc.setFontSize(fontSize);
  return wrap(doc, text, maxWidth).length;
}

function parseAdviceParts(
  item: string,
  index: number
): { heading: string; body: string } {
  const numbered = /^\d+\.\s/.test(item) ? item : `${index + 1}. ${item}`;
  const match = numbered.match(/^(\d+\.\s+[^:]+:)\s*([\s\S]*)$/);
  if (match) {
    return {
      heading: match[1],
      body: match[2].replace(/\s+/g, " ").trim(),
    };
  }
  return { heading: numbered, body: "" };
}

function measureSkincareAdviceHeight(
  doc: jsPDF,
  items: string[],
  maxW: number
): number {
  const lineH = 10;
  const bodySize = 8;
  const advice = items.map((item) => item.trim()).filter(Boolean);
  if (!advice.length) return 0;

  let total = 16;
  advice.forEach((item, index) => {
    const { heading, body } = parseAdviceParts(item, index);
    total += measureWrappedLines(doc, heading, maxW, bodySize, "bold") * lineH;
    if (body) {
      total += measureWrappedLines(doc, body, maxW, bodySize) * lineH;
    }
    total += 2;
  });
  return total;
}

function estimateNarrativeHeight(
  doc: jsPDF,
  data: SdetectReportData,
  maxW: number
): number {
  const sectionGap = 8;
  const headerH = 16;
  const lineH = 10;
  const bodySize = 8;
  let total = 0;

  if (data.issueAnalysis.trim()) {
    total += headerH;
    total += measureWrappedLines(doc, data.issueAnalysis, maxW, bodySize) * lineH;
  }

  const advice = data.skincareAdvice.filter((item) => item.trim());
  if (advice.length) {
    if (total > 0) total += sectionGap;
    total += measureSkincareAdviceHeight(doc, data.skincareAdvice, maxW);
  }

  return total;
}

function drawBodyParagraph(
  doc: jsPDF,
  lines: string[],
  x: number,
  startY: number,
  lineH: number,
  maxY: number
): number {
  let cy = startY;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...SKINFIT_REPORT_THEME.navy);
  for (const line of lines) {
    if (cy > maxY) break;
    doc.text(line, x, cy);
    cy += lineH;
  }
  return cy;
}

function drawPageHeader(doc: jsPDF, logo: LogoAsset) {
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 22;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(...SKINFIT_REPORT_THEME.navy);
  doc.text("Skin Analyzer Report", margin, 36);

  doc.addImage(
    logo.dataUrl,
    "PNG",
    pageW - margin - logo.displayW,
    18,
    logo.displayW,
    logo.displayH
  );
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

/** Patient profile card background (light green). */
const PATIENT_CARD_GREEN = [242, 244, 241] as [number, number, number];

function drawPatientCardBackground(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  radius = 12
) {
  doc.setFillColor(...PATIENT_CARD_GREEN);
  doc.setDrawColor(...SKINFIT_REPORT_THEME.cardBorder);
  doc.setLineWidth(0.75);
  doc.roundedRect(x, y, w, h, radius, radius, "FD");
}

function drawPatientCard(
  doc: jsPDF,
  data: SdetectReportData,
  x: number,
  y: number,
  w: number,
  contentH: number,
  cardH: number
) {
  drawPatientCardBackground(doc, x, y, w, cardH);

  const textW = w * 0.44;
  const padX = x + 20;
  let ty = y + 28;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.setTextColor(...SKINFIT_REPORT_THEME.muted);
  doc.text("Hello ", padX, ty);

  const helloW = doc.getTextWidth("Hello ");
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...SKINFIT_REPORT_THEME.navy);
  doc.text(data.patient.name, padX + helloW, ty);

  const nameW = doc.getTextWidth(data.patient.name);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...SKINFIT_REPORT_THEME.muted);
  doc.text(data.patient.gender, padX + helloW + nameW + 14, ty);

  ty += 20;
  doc.setFontSize(9.5);
  doc.text(`Age: ${data.patient.age}yrs`, padX, ty);

  ty += 18;
  doc.setFontSize(8.5);
  doc.text("Contact information", padX, ty);
  ty += 12;
  doc.setTextColor(...SKINFIT_REPORT_THEME.ink);
  doc.text(formatPatientPhone(data.patient.phone), padX, ty);

  ty += 18;
  doc.setTextColor(...SKINFIT_REPORT_THEME.muted);
  doc.text("Date of report", padX, ty);
  ty += 12;
  doc.setTextColor(...SKINFIT_REPORT_THEME.ink);
  doc.text(data.patient.reportDate, padX, ty);

  ty += 18;
  doc.setTextColor(...SKINFIT_REPORT_THEME.muted);
  doc.text("Skin Analysis Frequency", padX, ty);
  ty += 12;
  doc.setTextColor(...SKINFIT_REPORT_THEME.ink);
  doc.text(String(data.patient.scanFrequency), padX, ty);
}

async function drawPatientImages(
  doc: jsPDF,
  data: SdetectReportData,
  x: number,
  y: number,
  w: number,
  h: number
) {
  if (!data.faceImages) return;

  const presentSlots = FACE_SLOT_ORDER.filter((key) => data.faceImages![key] != null);
  if (presentSlots.length === 0) return;

  const textW = w * 0.44;
  const imgX = x + textW + 12;
  const imgW = w - textW - 24;
  const imgPad = 8;
  const imgAreaY = y + imgPad;
  const imgAreaH = h - imgPad * 2;
  const gap = 6;
  const slotW = (imgW - gap * (presentSlots.length - 1)) / presentSlots.length;

  let sx = imgX;
  for (const key of presentSlots) {
    const buf = data.faceImages![key];
    if (!buf) continue;
    const dataUrl = await imageCoverBottomDataUrl(buf, slotW, imgAreaH);
    doc.addImage(dataUrl, "JPEG", sx, imgAreaY, slotW, imgAreaH);
    sx += slotW + gap;
  }
}

function drawMetricsBar(
  doc: jsPDF,
  data: SdetectReportData,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const radius = 8;
  doc.setFillColor(...SKINFIT_REPORT_THEME.navy);
  doc.roundedRect(x, y, w, h, radius, radius, "F");

  const cellW = w / 3;
  const metrics = [
    { value: data.classification, label: "Skin Classification" },
    { value: `${data.moisture}%`, label: "Moisture" },
    { value: String(data.comprehensiveScore), label: "Comprehensive Score" },
  ];

  metrics.forEach((metric, i) => {
    const cx = x + cellW * i + cellW / 2;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(22);
    doc.setTextColor(255, 255, 255);
    doc.text(metric.value, cx, y + 30, { align: "center" });
    doc.setFontSize(8);
    doc.text(metric.label, cx, y + 44, { align: "center" });

    if (i < 2) {
      doc.setDrawColor(120, 145, 180);
      doc.setLineWidth(0.4);
      doc.line(x + cellW * (i + 1), y + 10, x + cellW * (i + 1), y + h - 10);
    }
  });
}

function drawRadarTitle(doc: jsPDF, x: number, y: number, w: number): number {
  const title = "Comprehensive Analysis";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...SKINFIT_REPORT_THEME.navy);
  doc.text(title, x + w / 2, y + 10, { align: "center" });
  return 16;
}

function drawIssueAnalysis(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxW: number,
  maxY: number
): number {
  const trimmed = text.trim();
  if (!trimmed) return y;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...SKINFIT_REPORT_THEME.navy);
  doc.text("Issue analysis", x, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const lines = wrap(doc, trimmed, maxW);
  return drawBodyParagraph(doc, lines, x, y + 16, 10, maxY);
}

function drawSkincareAdvice(
  doc: jsPDF,
  items: string[],
  x: number,
  y: number,
  maxW: number,
  maxY: number
): number {
  const advice = items.map((item) => item.trim()).filter(Boolean);
  if (!advice.length) return y;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...SKINFIT_REPORT_THEME.navy);
  doc.text("Skincare advice", x, y);

  let cy = y + 16;

  advice.forEach((item, index) => {
    const { heading, body } = parseAdviceParts(item, index);
    if (cy > maxY) return;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...SKINFIT_REPORT_THEME.navy);
    for (const line of wrap(doc, heading, maxW)) {
      if (cy > maxY) return;
      doc.text(line, x, cy);
      cy += 10;
    }

    if (body) {
      cy = drawBodyParagraph(doc, wrap(doc, body, maxW), x, cy, 10, maxY);
    }
    cy += 2;
  });

  return cy;
}

async function drawFooter(doc: jsPDF, qrUrl: string) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 22;
  const footerLineY = pageH - FOOTER_RESERVE;
  const footerContentY = footerLineY + FOOTER_RULE_CONTENT_GAP;

  doc.setDrawColor(...SKINFIT_REPORT_THEME.grid);
  doc.setLineWidth(0.75);
  doc.line(margin, footerLineY, pageW - margin, footerLineY);

  const sigX = margin;
  const sigY = footerContentY + 2;
  const sigDisplayH = 28;
  const signature = await loadSignatureImage();
  const sigDisplayW = sigDisplayH * signature.aspect;
  doc.addImage(
    signature.dataUrl,
    "PNG",
    sigX,
    sigY,
    sigDisplayW,
    sigDisplayH
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...SKINFIT_REPORT_THEME.ink);
  doc.text("Signature", sigX, sigY + sigDisplayH + 10);
  doc.text("Skinfit Wellness", sigX, sigY + sigDisplayH + 20);

  const colW = 175;
  const addrStartX = margin + 115;
  CLINIC_LOCATIONS.forEach((loc, i) => {
    const ax = addrStartX + i * (colW + 16);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...SKINFIT_REPORT_THEME.navy);
    let ay = footerContentY + 8;
    for (const line of wrap(doc, loc.address, colW - 4)) {
      doc.text(line, ax, ay);
      ay += 9;
    }
    doc.setFont("helvetica", "bold");
    doc.text("Mobile:", ax, ay + 2);
    doc.setFont("helvetica", "normal");
    doc.text(loc.phone, ax + 30, ay + 2);

    if (i === 0) {
      doc.setDrawColor(...SKINFIT_REPORT_THEME.grid);
      doc.setLineWidth(0.5);
      doc.line(ax + colW + 6, footerContentY + 2, ax + colW + 6, footerContentY + 66);
    }
  });

  const qrSize = 52;
  const qrX = pageW - margin - qrSize;
  const qrY = footerContentY + 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...SKINFIT_REPORT_THEME.muted);
  doc.text("scan me", qrX + qrSize / 2, qrY - 2, { align: "center" });

  const qrDataUrl = await reportQrDataUrl(qrUrl);
  doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);

  doc.setFillColor(...SKINFIT_REPORT_THEME.navy);
  doc.rect(0, pageH - 6, pageW, 6, "F");
}

export async function generateSkinfitReportPdf(data: SdetectReportData): Promise<Buffer> {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 22;
  const contentW = pageW - margin * 2;
  const logo = await loadHeaderLogo();

  drawPageHeader(doc, logo);

  const patientY = 52;
  const patientContentH = 178;
  const patientCardH = patientContentH * 1.1;
  drawPatientCard(doc, data, margin, patientY, contentW, patientContentH, patientCardH);
  await drawPatientImages(doc, data, margin, patientY, contentW, patientContentH);

  const metricsH = 52;
  const metricsOverlap = 14;
  const metricsShiftDown = patientContentH * 0.04;
  const metricsRaise = patientCardH * 0.08;
  const metricsY = patientY + patientCardH - metricsOverlap + metricsShiftDown - metricsRaise;
  const metricsBarW = contentW * 0.78;
  const metricsBarX = margin + (contentW - metricsBarW) / 2;
  drawMetricsBar(doc, data, metricsBarX, metricsY, metricsBarW, metricsH);

  const chartsY = metricsY + metricsH + 14;
  const narrativeTopGap = 24;
  const narrativeBottomPad = 14;
  const maxNarrativeBottom = pageH - FOOTER_RESERVE - narrativeBottomPad;
  const narrativeHeight = estimateNarrativeHeight(doc, data, contentW);
  const minChartsH = 200;
  const maxChartsH =
    pageH -
    chartsY -
    FOOTER_RESERVE -
    narrativeHeight -
    narrativeTopGap -
    narrativeBottomPad;
  const chartsH = Math.max(minChartsH, maxChartsH);
  const gutter = 16;
  const leftW = (contentW - gutter) * 0.48;
  const rightW = contentW - gutter - leftW;
  const rightX = margin + leftW + gutter;
  const cardPad = 10;

  drawGreyCard(doc, margin, chartsY, leftW, chartsH, 10);
  drawGreyCard(doc, rightX, chartsY, rightW, chartsH, 10);

  const titleY = chartsY + cardPad;
  const titleH = drawRadarTitle(doc, margin, titleY, leftW);
  const titleBottomY = titleY + titleH;
  const radarY = titleBottomY + 8;
  drawRadarChart(doc, data.radar, {
    x: margin + cardPad,
    y: radarY,
    w: leftW - cardPad * 2,
    h: chartsH - (radarY - chartsY) - 6,
    labelMinY: titleBottomY + 2,
  });

  const innerPad = 10;
  const topChartExtra = 8;
  const lineGap = 8;
  const lineH = (chartsH - innerPad * 2 - topChartExtra - lineGap) / 2;
  drawLineChart(
    doc,
    "General analysis",
    data.generalAnalysis,
    rightX + innerPad,
    chartsY + innerPad + topChartExtra,
    rightW - innerPad * 2,
    lineH,
    { compact: true }
  );
  drawLineChart(
    doc,
    "In-depth analysis",
    data.inDepthAnalysis,
    rightX + innerPad,
    chartsY + innerPad + topChartExtra + lineH + lineGap,
    rightW - innerPad * 2,
    lineH,
    { compact: true }
  );

  const issueY = chartsY + chartsH + narrativeTopGap;
  let narrativeY = drawIssueAnalysis(
    doc,
    data.issueAnalysis,
    margin,
    issueY,
    contentW,
    maxNarrativeBottom
  );
  narrativeY = drawSkincareAdvice(
    doc,
    data.skincareAdvice,
    margin,
    narrativeY + 8,
    contentW,
    maxNarrativeBottom
  );

  const qrUrl = data.sourceReportUrl ?? QR_FALLBACK_URL;
  await drawFooter(doc, qrUrl);

  return Buffer.from(doc.output("arraybuffer"));
}
