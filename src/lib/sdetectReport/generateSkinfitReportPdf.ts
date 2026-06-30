import { readFile } from "node:fs/promises";
import path from "node:path";
import { jsPDF } from "jspdf";
import sharp from "sharp";
import { drawLineChart, drawRadarChart, SKINFIT_REPORT_THEME } from "./charts";
import { reportQrDataUrl } from "./qrCode";
import type { SdetectFaceImages, SdetectReportData } from "./types";

type LogoAsset = { dataUrl: string; displayW: number; displayH: number };

const CLINIC_LOCATIONS = [
  {
    address:
      "5, Richmond Rd, Shanthala Nagar, Ashok Nagar, Bengaluru, Karnataka 560025",
    phone: "+91 90354 07057",
  },
  {
    address:
      "3rd Floor, 534/A, 'The Apex' Sarjapur Rd, Bengaluru, Karnataka 560034",
    phone: "+91 91879 67633",
  },
] as const;

const QR_FALLBACK_URL = "https://my.skinfitwellness.in";

let logoCache: LogoAsset | null = null;

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

async function imageDataUrl(
  buffer: Buffer
): Promise<{ dataUrl: string; width: number; height: number }> {
  const meta = await sharp(buffer).metadata();
  const jpg = await sharp(buffer).jpeg({ quality: 90 }).toBuffer();
  return {
    dataUrl: `data:image/jpeg;base64,${jpg.toString("base64")}`,
    width: meta.width ?? 1,
    height: meta.height ?? 1,
  };
}

function fitContain(
  srcW: number,
  srcH: number,
  maxW: number,
  maxH: number
): { w: number; h: number; offsetX: number; offsetY: number } {
  const scale = Math.min(maxW / srcW, maxH / srcH);
  const w = srcW * scale;
  const h = srcH * scale;
  return { w, h, offsetX: (maxW - w) / 2, offsetY: (maxH - h) / 2 };
}

function wrap(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(text.replace(/\s+/g, " ").trim(), maxWidth);
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

function drawPatientCard(
  doc: jsPDF,
  data: SdetectReportData,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const radius = 10;
  doc.setFillColor(...SKINFIT_REPORT_THEME.cardGrey);
  doc.roundedRect(x, y, w, h, radius, radius, "F");

  const textW = w * 0.44;
  const imgX = x + textW + 12;
  const imgW = w - textW - 24;
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

  ty += 20;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...SKINFIT_REPORT_THEME.muted);
  doc.text(`Age: ${data.patient.age}yrs`, padX, ty);
  doc.text(data.patient.gender, padX + textW * 0.42, ty);

  ty += 18;
  doc.setFontSize(8.5);
  doc.text("Contact information", padX, ty);
  ty += 12;
  doc.setTextColor(...SKINFIT_REPORT_THEME.ink);
  doc.text(data.patient.phone, padX, ty);

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

  const imgPad = 8;
  const imgAreaY = y + imgPad;
  const imgAreaH = h - imgPad * 2;
  const mainW = imgW * 0.58;
  const sideW = imgW - mainW - 8;
  const sideH = (imgAreaH - 8) / 2;

  const slots: Array<{
    key: keyof SdetectFaceImages | null;
    sx: number;
    sy: number;
    sw: number;
    sh: number;
  }> = [
    { key: "front", sx: imgX, sy: imgAreaY, sw: mainW, sh: imgAreaH },
    { key: "left", sx: imgX + mainW + 8, sy: imgAreaY, sw: sideW, sh: sideH },
    {
      key: "right",
      sx: imgX + mainW + 8,
      sy: imgAreaY + sideH + 8,
      sw: sideW,
      sh: sideH,
    },
  ];

  for (const slot of slots) {
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...SKINFIT_REPORT_THEME.grid);
    doc.setLineWidth(0.5);
    doc.roundedRect(slot.sx, slot.sy, slot.sw, slot.sh, 4, 4, "FD");
  }
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

  const textW = w * 0.44;
  const imgX = x + textW + 12;
  const imgW = w - textW - 24;
  const imgPad = 8;
  const imgAreaY = y + imgPad;
  const imgAreaH = h - imgPad * 2;
  const mainW = imgW * 0.58;
  const sideW = imgW - mainW - 8;
  const sideH = (imgAreaH - 8) / 2;

  const slots: Array<{
    key: keyof SdetectFaceImages;
    sx: number;
    sy: number;
    sw: number;
    sh: number;
  }> = [
    { key: "front", sx: imgX, sy: imgAreaY, sw: mainW, sh: imgAreaH },
    { key: "left", sx: imgX + mainW + 8, sy: imgAreaY, sw: sideW, sh: sideH },
    {
      key: "right",
      sx: imgX + mainW + 8,
      sy: imgAreaY + sideH + 8,
      sw: sideW,
      sh: sideH,
    },
  ];

  for (const slot of slots) {
    const { dataUrl, width, height } = await imageDataUrl(data.faceImages[slot.key]);
    const innerPad = 3;
    const fit = fitContain(
      width,
      height,
      slot.sw - innerPad * 2,
      slot.sh - innerPad * 2
    );
    doc.addImage(
      dataUrl,
      "JPEG",
      slot.sx + innerPad + fit.offsetX,
      slot.sy + innerPad + fit.offsetY,
      fit.w,
      fit.h
    );
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
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(255, 255, 255);
    doc.text(metric.value, cx, y + 30, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(metric.label, cx, y + 44, { align: "center" });

    if (i < 2) {
      doc.setDrawColor(120, 145, 180);
      doc.setLineWidth(0.4);
      doc.line(x + cellW * (i + 1), y + 10, x + cellW * (i + 1), y + h - 10);
    }
  });
}

function drawRadarTitle(doc: jsPDF, x: number, y: number, w: number) {
  const title = "Comprehensive Analysis";
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const titleW = doc.getTextWidth(title) + 24;
  const pillX = x + (w - titleW) / 2;
  const pillY = y;
  const pillH = 22;

  doc.setFillColor(...SKINFIT_REPORT_THEME.cardGrey);
  doc.roundedRect(pillX, pillY, titleW, pillH, 6, 6, "F");
  doc.setTextColor(...SKINFIT_REPORT_THEME.muted);
  doc.text(title, pillX + titleW / 2, pillY + 14, { align: "center" });
}

function drawIssueAnalysis(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxW: number,
  maxY: number
): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...SKINFIT_REPORT_THEME.navy);
  doc.text("Issue analysis", x, y);

  let cy = y + 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...SKINFIT_REPORT_THEME.ink);
  for (const line of wrap(doc, text, maxW)) {
    if (cy > maxY) break;
    doc.text(line, x, cy);
    cy += 11;
  }
  return cy;
}

async function drawFooter(doc: jsPDF, qrUrl: string) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 22;
  const footerTop = pageH - 98;

  doc.setDrawColor(...SKINFIT_REPORT_THEME.grid);
  doc.setLineWidth(0.75);
  doc.line(margin, footerTop, pageW - margin, footerTop);

  const sigX = margin;
  const sigY = footerTop + 18;
  doc.setFont("times", "italic");
  doc.setFontSize(20);
  doc.setTextColor(...SKINFIT_REPORT_THEME.navy);
  doc.text("Dr. Skin Fit", sigX, sigY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...SKINFIT_REPORT_THEME.muted);
  doc.text("Signature", sigX, sigY + 12);
  doc.text("Skinfit Wellness", sigX, sigY + 22);

  const colW = 175;
  const addrStartX = margin + 115;
  CLINIC_LOCATIONS.forEach((loc, i) => {
    const ax = addrStartX + i * (colW + 16);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...SKINFIT_REPORT_THEME.navy);
    doc.text("Address", ax, footerTop + 14);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...SKINFIT_REPORT_THEME.ink);
    let ay = footerTop + 24;
    for (const line of wrap(doc, loc.address, colW - 4)) {
      doc.text(line, ax, ay);
      ay += 9;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.text("Mobile:", ax, ay + 2);
    doc.setFont("helvetica", "normal");
    doc.text(loc.phone, ax + 30, ay + 2);

    if (i === 0) {
      doc.setDrawColor(...SKINFIT_REPORT_THEME.grid);
      doc.setLineWidth(0.5);
      doc.line(ax + colW + 6, footerTop + 8, ax + colW + 6, footerTop + 72);
    }
  });

  const qrSize = 52;
  const qrX = pageW - margin - qrSize;
  const qrY = footerTop + 6;
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
  const patientH = 178;
  drawPatientCard(doc, data, margin, patientY, contentW, patientH);
  await drawPatientImages(doc, data, margin, patientY, contentW, patientH);

  const metricsH = 52;
  const metricsY = patientY + patientH - 22;
  drawMetricsBar(doc, data, margin, metricsY, contentW, metricsH);

  const chartsY = metricsY + metricsH + 16;
  const footerReserve = 108;
  const issueReserve = 72;
  const chartsH = pageH - chartsY - footerReserve - issueReserve;
  const gutter = 14;
  const leftW = (contentW - gutter) * 0.48;
  const rightW = contentW - gutter - leftW;
  const rightX = margin + leftW + gutter;

  drawRadarTitle(doc, margin, chartsY, leftW);
  const radarSize = Math.min(leftW - 8, chartsH - 28);
  const radarX = margin + (leftW - radarSize) / 2;
  const radarY = chartsY + 30;
  drawRadarChart(doc, data.radar, radarX, radarY, radarSize);

  const lineH = (chartsH - 12) / 2;
  drawLineChart(
    doc,
    "General analysis",
    data.generalAnalysis,
    rightX,
    chartsY,
    rightW,
    lineH,
    { compact: true }
  );
  drawLineChart(
    doc,
    "In-depth analysis",
    data.inDepthAnalysis,
    rightX,
    chartsY + lineH + 10,
    rightW,
    lineH,
    { compact: true }
  );

  const issueY = chartsY + chartsH + 10;
  drawIssueAnalysis(doc, data.issueAnalysis, margin, issueY, contentW, pageH - footerReserve - 8);

  const qrUrl = data.sourceReportUrl ?? QR_FALLBACK_URL;
  await drawFooter(doc, qrUrl);

  return Buffer.from(doc.output("arraybuffer"));
}
