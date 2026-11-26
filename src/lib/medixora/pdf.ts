import type { jsPDF } from "jspdf";
import { generateKaiReportPdf } from "@/src/lib/sdetectReport/generateKaiReportPdf";
import { loadHeaderLogo } from "@/src/lib/sdetectReport/headerLogo";
import type { KaiReportContent } from "@/src/lib/sdetectReport/aiReport";
import { frontScore, radarMetrics } from "@/src/lib/medixora/content";
import type { Photo } from "@/src/lib/medixora/fetch";
import {
  formatScanDate,
  VIEW_LABELS,
  VIEWS,
  type MedixoraReport,
  type View,
} from "@/src/lib/medixora/report";

type RGB = [number, number, number];
const NAVY: RGB = [43, 45, 92];
const INK: RGB = [40, 42, 70];
const MUTED: RGB = [120, 122, 138];
const RULE: RGB = [225, 222, 214];
const TRACK: RGB = [236, 234, 228];
const WHITE: RGB = [255, 255, 255];

const W = 210;
const H = 297;
const M = 16;
const RIGHT = W - M;
const ROW_H = 8.6;
const GROUP_H = 11;

/** Measures grouped the way a clinician reads them. Anything new from the machine goes last. */
const GROUPS: [string, string[]][] = [
  ["Texture and clarity", ["Acne", "Pores", "Blackhead", "Wrinkle", "Collagen"]],
  ["Pigmentation", ["Mixed spot", "Superficial pigment", "Deep Pigment", "Brown pigment", "Heat Map of Pigment"]],
  ["Oil and hydration", ["Sebum", "Moisture", "Porphyrin"]],
  ["Barrier and sensitivity", ["Skin Barrier", "Red Map of Sensitivity", "Heat Map of Sensitivity", "Fluorescent Agent"]],
];

/** Same bands as page one, in words: no colour is needed to read them. */
const rating = (score: number) => (score >= 60 ? "Good" : score >= 40 ? "Fair" : "Needs care");

/** Page two: every score the machine reported, for all three views. */
function drawScoresPage(doc: jsPDF, report: MedixoraReport, logo: Awaited<ReturnType<typeof loadHeaderLogo>>) {
  const text = (value: string, x: number, y: number, size: number, color: RGB, bold = false, align: "left" | "center" | "right" = "left") => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
    doc.text(value, x, y, { align });
  };
  const rule = (y: number, color: RGB = RULE, width = 0.2) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(width);
    doc.line(M, y, RIGHT, y);
  };

  doc.addPage();
  doc.setFillColor(...WHITE);
  doc.rect(0, 0, W, H, "F");
  doc.addImage(logo.dataUrl, "PNG", M, (20 - logo.displayH) / 2, logo.displayW, logo.displayH);
  text("Detailed measurements", RIGHT, 12.5, 10.5, NAVY, false, "right");
  rule(20, NAVY, 0.6);
  text("All scores are out of 100, shown for each camera view.", M, 29, 9, MUTED);

  // Column positions: name, three views, front score as a bar, rating in words.
  const views = [82, 99, 116];
  const barX = 127;
  const barW = 36;

  let y = 40;
  text("MEASURE", M, y, 7.5, MUTED, true);
  VIEWS.forEach((view, i) => text(VIEW_LABELS[view].toUpperCase(), views[i]!, y, 7.5, MUTED, true, "center"));
  text("FRONT SCORE", barX, y, 7.5, MUTED, true);
  text("RATING", RIGHT, y, 7.5, MUTED, true, "right");
  y += 3.5;
  rule(y, NAVY, 0.35);

  const used = new Set(GROUPS.flatMap(([, names]) => names));
  const groups: [string, string[]][] = [
    ...GROUPS,
    ["Other", report.scores.map((r) => r.name).filter((n) => !used.has(n))],
  ];
  const room = H - 24;

  for (const [title, names] of groups) {
    const found = names.flatMap((n) => report.scores.filter((r) => r.name === n));
    if (!found.length) continue;
    text(title, M, y + 7.4, 10, NAVY, true);
    y += GROUP_H;
    rule(y);
    for (const row of found) {
      if (y + ROW_H > room) break;
      const base = y + 5.8;
      text(row.name.replace(/[^\x20-\x7E]/g, ""), M, base, 9.2, INK);
      VIEWS.forEach((view, i) => {
        const value = row[view];
        text(value == null ? "-" : String(value), views[i]!, base, 9.2, value == null ? MUTED : INK, view === "front", "center");
      });
      // Moisture is a reading, not a graded score: no bar or rating.
      const front = row.name === "Moisture" ? null : row.front;
      if (front != null) {
        // Filled part and remaining track side by side, so no seam shows between them.
        const filled = (barW * Math.max(0, Math.min(100, front))) / 100;
        doc.setFillColor(...NAVY);
        doc.rect(barX, base - 2.1, filled, 1.6, "F");
        doc.setFillColor(...TRACK);
        doc.rect(barX + filled, base - 2.1, barW - filled, 1.6, "F");
        text(rating(front), RIGHT, base, 8.6, front < 40 ? NAVY : MUTED, front < 40, "right");
      } else {
        text(row.name === "Moisture" ? "Reading" : "-", RIGHT, base, 8.6, MUTED, false, "right");
      }
      y += ROW_H;
      rule(y);
    }
  }

  rule(H - 17, NAVY, 0.35);
  text("Rating uses the front view: Good 60 and above, Fair 40 to 59, Needs care below 40.", M, H - 11.5, 7.8, MUTED);
  text("Measured by the Medixora skin analyser.", M, H - 7.5, 7.8, MUTED);
}

/** The FLO Santé design (page one) followed by the full score table (page two). */
export async function buildMedixoraPdf(opts: {
  patient: { name: string; phone: string | null };
  report: MedixoraReport;
  content: KaiReportContent;
  photos: Record<View, Photo | null>;
}): Promise<Buffer> {
  const { report, photos, content } = opts;
  const gender = report.customer.gender.trim();
  const logo = await loadHeaderLogo();
  const radar = radarMetrics(report);
  return generateKaiReportPdf(
    {
      classification: report.skinTypeCode,
      moisture: frontScore(report, "Moisture") ?? 0,
      comprehensiveScore: content.kaiScore,
      patient: {
        name: opts.patient.name.replace(/[^\x20-\x7E\xA0-\xFF]/g, "").trim() || "-",
        gender: gender ? gender[0]!.toUpperCase() + gender.slice(1).toLowerCase() : "-",
        age: Number(report.customer.age) || 0,
        phone: opts.patient.phone ?? "-",
        reportDate: formatScanDate(report.scannedAt),
        scanFrequency: report.scanCount,
      },
      radar,
      issueAnalysis: "",
      skincareAdvice: [],
      generalAnalysis: [],
      inDepthAnalysis: [],
      faceImages: {
        left: photos.left?.jpeg ?? null,
        front: photos.front?.jpeg ?? null,
        right: photos.right?.jpeg ?? null,
      },
      sourceReportUrl: null,
      reportSn: null,
    },
    content,
    { eventLabel: "SkinFit Wellness", appendix: (doc) => drawScoresPage(doc, report, logo) }
  );
}
