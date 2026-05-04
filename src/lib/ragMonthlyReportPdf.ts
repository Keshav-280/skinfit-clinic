import { jsPDF } from "jspdf";
import type { RagKaiParamKey } from "@/src/lib/ragEightParams";
import type { DerivedSkinIdentity } from "@/src/lib/ragSkinIdentityDerive";

/** Serializable monthly appendix for UI + PDF export. */
export type MonthlyReportDetail = {
  patientName: string;
  patientEmail: string;
  generatedAt: string;
  periodLabel: string;
  calendarRange: string;
  rolling30Label: string;
  llmSynth: boolean;
  summaryTitle: string;
  summaryBody: string;
  highlights: string[];
  risks: string[];
  nextMonthFocus: string[];
  kaiTrajectory: number[];
  /** Weighted kAI from mean of each 8-param score across scans in this month. */
  kaiMonthAvgFromParams: number | null;
  adherence30d: {
    fullRoutineDays: number;
    windowDays: number;
    amDays: number;
    pmDays: number;
    avgAmRoutineStepPct: number;
    avgPmRoutineStepPct: number;
    routineWeightedConsistencyPct: number;
    journalCompliancePct: number;
    journalMissedDays: number;
    avgSleepHours: number;
    avgWaterGlasses: number;
    avgStress: number;
    highStressDays: number;
    highSunDays: number;
    moderateSunDays: number;
    journalDays: number;
  };
  scans: Array<{ index: number; date: string; kaiScore: number }>;
  parameters: Array<{
    key: RagKaiParamKey;
    label: string;
    latest: number | null;
    vsPrior: number | null;
    vsMonthStart: number | null;
    monthMean: number | null;
  }>;
  identity: DerivedSkinIdentity;
  identityChanged: Array<{
    field: string;
    from: string | number | null;
    to: string | number | null;
  }>;
  recentScanHooks: string[];
};

function wrapLines(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(text.replace(/\s+/g, " ").trim(), maxWidth);
}

function addSection(
  doc: jsPDF,
  title: string,
  y: { v: number },
  margin: number,
  pageW: number,
  bodyLines: string[],
  lineH: number
) {
  const maxW = pageW - margin * 2;
  if (y.v > 720) {
    doc.addPage();
    y.v = margin;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(title, margin, y.v);
  y.v += lineH + 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(0);
  for (const line of bodyLines) {
    if (y.v > 780) {
      doc.addPage();
      y.v = margin;
    }
    doc.text(line, margin, y.v, { maxWidth: maxW });
    y.v += lineH;
  }
  y.v += 10;
}

export function downloadMonthlyKaiReportPdf(data: MonthlyReportDetail) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 44;
  const pageW = doc.internal.pageSize.getWidth();
  const maxW = pageW - margin * 2;
  const lineH = 12;
  const y = { v: margin };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("kAI — Monthly progress report", margin, y.v);
  y.v += 22;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80);
  doc.text(
    `${data.patientName} · ${data.patientEmail}`,
    margin,
    y.v,
    { maxWidth: maxW }
  );
  y.v += 14;
  doc.text(
    `Generated: ${new Date(data.generatedAt).toLocaleString()}`,
    margin,
    y.v
  );
  y.v += 14;
  doc.text(
    `${data.periodLabel} · ${data.calendarRange}`,
    margin,
    y.v,
    { maxWidth: maxW }
  );
  y.v += 14;
  doc.text(data.rolling30Label, margin, y.v, { maxWidth: maxW });
  y.v += 14;
  doc.text(
    data.llmSynth
      ? "Narrative: LLM-synthesized"
      : "Narrative: rules-based fallback",
    margin,
    y.v
  );
  y.v += 20;
  doc.setTextColor(0);

  if (data.kaiMonthAvgFromParams != null) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(55, 48, 163);
    doc.text(
      `Month kAI (mean parameters): ${data.kaiMonthAvgFromParams}`,
      margin,
      y.v
    );
    y.v += 14;
    doc.setTextColor(0);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(
      "Weighted kAI using the average of each parameter across scans in this calendar month (not a simple average of per-scan kAIs).",
      margin,
      y.v,
      { maxWidth: maxW }
    );
    y.v += 18;
  }

  addSection(
    doc,
    data.summaryTitle,
    y,
    margin,
    pageW,
    wrapLines(doc, data.summaryBody, maxW),
    lineH
  );

  if (data.highlights.length) {
    const lines = data.highlights.flatMap((h) =>
      wrapLines(doc, `\u2022 ${h}`, maxW)
    );
    addSection(doc, "Highlights", y, margin, pageW, lines, lineH);
  }
  if (data.risks.length) {
    const lines = data.risks.flatMap((h) =>
      wrapLines(doc, `\u2022 ${h}`, maxW)
    );
    addSection(doc, "Risks to watch", y, margin, pageW, lines, lineH);
  }
  if (data.nextMonthFocus.length) {
    const lines = data.nextMonthFocus.flatMap((h, i) =>
      wrapLines(doc, `${i + 1}. ${h}`, maxW)
    );
    addSection(doc, "Next month focus", y, margin, pageW, lines, lineH);
  }

  const ad = data.adherence30d;
  addSection(
    doc,
    "Monthly behaviour & adherence",
    y,
    margin,
    pageW,
    wrapLines(
      doc,
      `Full AM+PM: ${ad.fullRoutineDays}/${ad.windowDays} days · full AM rollup ${ad.amDays}d · full PM rollup ${ad.pmDays}d. ` +
        `Checklist intensity: avg AM ${ad.avgAmRoutineStepPct}% · avg PM ${ad.avgPmRoutineStepPct}% · blended ~${ad.routineWeightedConsistencyPct}%. ` +
        `Sleep ${ad.avgSleepHours}h avg · Water ${ad.avgWaterGlasses} glasses · Stress ${ad.avgStress}/10 avg. ` +
        `High-stress ${ad.highStressDays}d · High-UV ${ad.highSunDays}d · Moderate-UV ${ad.moderateSunDays}d · ` +
        `Journal ${ad.journalDays}/${ad.windowDays} (${ad.journalCompliancePct}%), missed ~${ad.journalMissedDays}d.`,
      maxW
    ),
    lineH
  );

  addSection(
    doc,
    `Per-scan kAI in month (${data.kaiTrajectory.length} pts)`,
    y,
    margin,
    pageW,
    wrapLines(
      doc,
      data.kaiTrajectory.length
        ? `Series (each scan’s kAI): ${data.kaiTrajectory.join(" -> ")} (oldest -> newest). Compare to month kAI from parameter means above.`
        : "No scans.",
      maxW
    ),
    lineH
  );

  if (data.scans.length) {
    const scanLines = data.scans.map(
      (s) => `Scan ${s.index} (${s.date}): kAI ${s.kaiScore}`
    );
    addSection(
      doc,
      "Scan chronology",
      y,
      margin,
      pageW,
      scanLines.flatMap((l) => wrapLines(doc, l, maxW)),
      lineH
    );
  }

  if (data.parameters.length) {
    doc.setFont("helvetica", "bold");
    if (y.v > 700) doc.addPage();
    doc.setFontSize(10);
    doc.text(
      "Parameters (latest vs prior vs month-open vs month mean)",
      margin,
      y.v
    );
    y.v += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const col1 = margin;
    const col2 = margin + 118;
    const col3 = margin + 168;
    const col4 = margin + 228;
    const col5 = margin + 298;
    doc.text("Parameter", col1, y.v);
    doc.text("Latest", col2, y.v);
    doc.text("vs prior", col3, y.v);
    doc.text("vs open", col4, y.v);
    doc.text("Mo. μ", col5, y.v);
    y.v += 12;
    doc.setDrawColor(200);
    doc.line(margin, y.v, pageW - margin, y.v);
    y.v += 10;
    for (const p of data.parameters) {
      if (y.v > 780) {
        doc.addPage();
        y.v = margin;
      }
      const v = p.latest != null ? String(p.latest) : "-";
      const vp =
        p.vsPrior != null
          ? p.vsPrior >= 0
            ? `+${p.vsPrior}`
            : String(p.vsPrior)
          : "-";
      const vm =
        p.vsMonthStart != null
          ? p.vsMonthStart >= 0
            ? `+${p.vsMonthStart}`
            : String(p.vsMonthStart)
          : "-";
      const mm = p.monthMean != null ? String(p.monthMean) : "-";
      doc.text(p.label.slice(0, 18), col1, y.v);
      doc.text(v, col2, y.v);
      doc.text(vp, col3, y.v);
      doc.text(vm, col4, y.v);
      doc.text(mm, col5, y.v);
      y.v += 13;
    }
    y.v += 12;
  }

  const id = data.identity;
  addSection(
    doc,
    "Skin identity (time-derived, current)",
    y,
    margin,
    pageW,
    [
      ...wrapLines(
        doc,
        `Type: ${id.skinType ?? "n/a"} · Concern: ${id.primaryConcern ?? "n/a"} · ` +
          `Sensitivity ${id.sensitivityIndex ?? "n/a"}/10 · UV ${id.uvSensitivity ?? "n/a"} · ` +
          `Hormonal ${id.hormonalCorrelation ?? "n/a"}`,
        maxW
      ),
      ...wrapLines(doc, `Concern signal: ${id.signals.primaryConcern}`, maxW),
      ...wrapLines(doc, `UV signal: ${id.signals.uvSensitivity}`, maxW),
      ...wrapLines(doc, `Sensitivity signal: ${id.signals.sensitivityIndex}`, maxW),
    ],
    lineH
  );

  if (data.identityChanged.length) {
    const ic = data.identityChanged.map(
      (c) => `${c.field}: ${String(c.from ?? "—")} -> ${String(c.to ?? "—")}`
    );
    addSection(
      doc,
      "Identity evolution (initial -> now)",
      y,
      margin,
      pageW,
      ic.flatMap((l) => wrapLines(doc, l, maxW)),
      lineH
    );
  }

  if (data.recentScanHooks.length) {
    addSection(
      doc,
      "Latest weekly tracker hooks",
      y,
      margin,
      pageW,
      data.recentScanHooks.flatMap((h, i) =>
        wrapLines(doc, `${i + 1}. ${h}`, maxW)
      ),
      lineH
    );
  }

  const slug = data.periodLabel.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  doc.save(`kai-monthly-${slug || "report"}.pdf`);
}
