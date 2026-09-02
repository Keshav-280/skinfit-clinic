import { jsPDF } from "jspdf";
import type { RagKaiParamKey } from "@/src/lib/ragEightParams";
import { alignMonthlyProseToHeadlineKai } from "@/src/lib/patientInsightDisplay";
import type { DerivedSkinIdentity } from "@/src/lib/ragSkinIdentityDerive";
import { SCAN_REPORT_THEME as T } from "@/src/lib/scanReportTheme";
import { SCAN_REPORT_PDF_PAGE_BG } from "@/src/lib/scanReportPdfBackground";

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
  /** Deep notes on notable parameter moves. */
  parameterNotes?: string[];
  /** How habits likely shaped outcomes. */
  habitNotes?: string[];
  /** Narrative of scan-to-scan kAI path. */
  scanStory?: string | null;
  /** Warm closing line. */
  closingNote?: string | null;
  /** How city weather / wellness lifestyle shaped the month. */
  environmentNote?: string | null;
  kaiTrajectory: number[];
  /** Weighted kAI from mean of each parameter score across scans in this month. */
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

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function signed(n: number): string {
  return `${n > 0 ? "+" : ""}${n}`;
}

function deltaTone(n: number | null): { label: string; cls: string } {
  if (n == null) return { label: "-", cls: "delta-flat" };
  if (n >= 3) return { label: `${signed(n)} improved`, cls: "delta-up" };
  if (n <= -3) return { label: `${signed(n)} softer`, cls: "delta-down" };
  return { label: `${signed(n)} steady`, cls: "delta-flat" };
}

function formatGeneratedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function listItems(items: string[], ordered: boolean): string {
  if (!items.length) return `<p class="empty">Nothing to show here yet.</p>`;
  const tag = ordered ? "ol" : "ul";
  return `<${tag} class="list">${items
    .map((x) => `<li>${esc(x)}</li>`)
    .join("")}</${tag}>`;
}

function habitCard(label: string, value: string, hint?: string): string {
  return `<div class="habit">
    <p class="habit-k">${esc(label)}</p>
    <p class="habit-v">${esc(value)}</p>
    ${hint ? `<p class="habit-h">${esc(hint)}</p>` : ""}
  </div>`;
}

function fallbackParamNotes(
  params: MonthlyReportDetail["parameters"]
): string[] {
  return params
    .filter((p) => p.vsMonthStart != null && Math.abs(p.vsMonthStart) >= 2)
    .sort(
      (a, b) => Math.abs(b.vsMonthStart ?? 0) - Math.abs(a.vsMonthStart ?? 0)
    )
    .slice(0, 6)
    .map((p) => {
      const d = p.vsMonthStart ?? 0;
      const dir =
        d >= 3 ? "improved" : d <= -3 ? "softened" : "held mostly steady";
      const mean =
        p.monthMean != null ? ` Month average sat at ${p.monthMean}.` : "";
      const prior =
        p.vsPrior != null
          ? ` Versus the prior scan: ${signed(p.vsPrior)}.`
          : "";
      return `${p.label} ${dir} across the month (${signed(d)} from open to latest; latest ${p.latest ?? "-"}).${mean}${prior}`;
    });
}

function fallbackHabitNotes(
  ad: MonthlyReportDetail["adherence30d"]
): string[] {
  const notes = [
    `Full AM+PM routine on ${ad.fullRoutineDays} of ${ad.windowDays} days, with checklist consistency at ${ad.routineWeightedConsistencyPct}% (AM avg ${ad.avgAmRoutineStepPct}%, PM avg ${ad.avgPmRoutineStepPct}%).`,
    `Sleep averaged ${ad.avgSleepHours}h. Stress averaged ${ad.avgStress}/10 with ${ad.highStressDays} high-stress day${ad.highStressDays === 1 ? "" : "s"}.`,
    `Skin journal on ${ad.journalDays} of ${ad.windowDays} days (${ad.journalCompliancePct}%); about ${ad.journalMissedDays} day${ad.journalMissedDays === 1 ? "" : "s"} missed.`,
  ];
  if (ad.avgWaterGlasses > 0) {
    notes.push(
      `Hydration averaged ${ad.avgWaterGlasses} glasses daily - steady water intake supports barrier recovery.`
    );
  }
  return notes;
}

function fallbackScanStory(data: MonthlyReportDetail): string {
  if (!data.scans.length) {
    return "No scans were logged in this month window, so this recap leans on your latest available scan and daily check-ins.";
  }
  const series = data.scans.map((s) => s.kaiScore).join(" → ");
  return `You completed ${data.scans.length} scan${data.scans.length === 1 ? "" : "s"} this month. Per-scan kAI moved ${series}. Your headline month kAI is ${data.kaiMonthAvgFromParams ?? "-"}, which blends parameter averages across those scans rather than simply averaging the per-scan scores.`;
}

/** Fill missing deep-dive fields for older stored monthly payloads. */
export function enrichMonthlyReportDetail(
  raw: MonthlyReportDetail
): MonthlyReportDetail {
  const data = alignMonthlyProseToHeadlineKai(raw);
  const parameterNotes =
    data.parameterNotes?.length
      ? data.parameterNotes
      : fallbackParamNotes(data.parameters ?? []);
  const habitNotes =
    data.habitNotes?.length
      ? data.habitNotes
      : fallbackHabitNotes(data.adherence30d);
  const scanStory =
    data.scanStory?.trim() || fallbackScanStory(data);
  const closingNote =
    data.closingNote?.trim() ||
    "Carry the wins, fix the soft spots early, and keep your check-ins honest - next month’s insight gets sharper with every scan and note.";

  return {
    ...data,
    parameterNotes,
    habitNotes,
    scanStory,
    closingNote,
    environmentNote: data.environmentNote?.trim() || null,
    highlights: data.highlights ?? [],
    risks: data.risks ?? [],
    nextMonthFocus: data.nextMonthFocus ?? [],
    parameters: data.parameters ?? [],
    scans: data.scans ?? [],
    recentScanHooks: data.recentScanHooks ?? [],
  };
}

/** Patient-facing HTML for the monthly insight PDF (matches scan-report brand). */
export function buildMonthlyReportHtml(raw: MonthlyReportDetail): string {
  const data = enrichMonthlyReportDetail(raw);
  const monthKai =
    data.kaiMonthAvgFromParams != null
      ? String(data.kaiMonthAvgFromParams)
      : "-";
  const generated = formatGeneratedAt(data.generatedAt);
  const ad = data.adherence30d;

  const paramRows = data.parameters
    .map((p) => {
      const latest = p.latest != null ? String(p.latest) : "-";
      const bar = p.latest != null ? Math.max(0, Math.min(100, p.latest)) : 0;
      const move = deltaTone(p.vsMonthStart);
      const mean = p.monthMean != null ? String(p.monthMean) : "-";
      const prior =
        p.vsPrior != null
          ? p.vsPrior >= 0
            ? `+${p.vsPrior}`
            : String(p.vsPrior)
          : "-";
      return `<div class="param-block">
        <div class="param-row">
          <span class="param-label">${esc(p.label)}</span>
          <div class="param-bar"><div class="param-fill" style="width:${bar}%"></div></div>
          <span class="param-val">${esc(latest)}</span>
          <span class="param-delta ${move.cls}">${esc(move.label)}</span>
        </div>
        <p class="param-meta">Month avg ${esc(mean)} · vs prior scan ${esc(prior)}</p>
      </div>`;
    })
    .join("");

  const scanChips =
    data.scans.length > 0
      ? `<div class="scan-chips">${data.scans
          .map(
            (s) =>
              `<span class="scan-chip"><span class="scan-chip-d">${esc(
                s.date
              )}</span><span class="scan-chip-v">kAI ${s.kaiScore}</span></span>`
          )
          .join("")}</div>`
      : `<p class="empty">No scans in this period.</p>`;

  const trajectory =
    data.kaiTrajectory.length > 0
      ? `<p class="body-copy">Scan path: ${esc(data.kaiTrajectory.join(" → "))}</p>`
      : "";

  const identityPills = [
    data.identity?.skinType,
    data.identity?.primaryConcern,
    data.identity?.uvSensitivity
      ? `UV sensitivity: ${data.identity.uvSensitivity}`
      : null,
    data.identity?.hormonalCorrelation
      ? `Hormonal: ${data.identity.hormonalCorrelation}`
      : null,
    data.identity?.sensitivityIndex != null
      ? `Sensitivity ${data.identity.sensitivityIndex}/10`
      : null,
  ]
    .filter((x): x is string => Boolean(x && String(x).trim()))
    .map((x) => `<span class="pill">${esc(String(x))}</span>`)
    .join("");

  const hooks =
    data.recentScanHooks.length > 0
      ? listItems(data.recentScanHooks.slice(0, 4), true)
      : "";

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
    color: ${T.ink};
    background: ${SCAN_REPORT_PDF_PAGE_BG};
    -webkit-font-smoothing: antialiased;
  }
  .page {
    width: 720px;
    padding: 28px 28px 24px;
    background: ${SCAN_REPORT_PDF_PAGE_BG};
  }
  .brand-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 18px;
  }
  .brand-kicker {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: ${T.navyMid};
  }
  .brand-title {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 28px;
    font-weight: 500;
    line-height: 1.15;
    color: ${T.navyDark};
    margin-top: 4px;
  }
  .meta {
    text-align: right;
    font-size: 11px;
    line-height: 1.45;
    color: ${T.inkMuted};
  }
  .meta strong {
    display: block;
    font-size: 13px;
    font-weight: 700;
    color: ${T.navy};
    margin-bottom: 2px;
  }
  .hero {
    display: flex;
    gap: 16px;
    align-items: stretch;
    padding: 18px 18px 18px 16px;
    border-radius: 20px;
    background: linear-gradient(135deg, ${T.navyDark} 0%, ${T.navy} 55%, ${T.navyMid} 100%);
    color: #fff;
    box-shadow: 0 18px 40px -18px rgba(30, 50, 100, 0.55);
  }
  .hero-score {
    flex: 0 0 110px;
    padding: 10px 12px;
    border-radius: 16px;
    background: rgba(255,255,255,0.1);
    border: 1px solid rgba(255,255,255,0.16);
    text-align: center;
  }
  .hero-score-k {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.72);
  }
  .hero-score-v {
    margin-top: 6px;
    font-size: 42px;
    font-weight: 800;
    line-height: 1;
    letter-spacing: -0.02em;
  }
  .hero-copy { flex: 1; min-width: 0; padding-top: 2px; }
  .hero-title {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.72);
  }
  .hero-body {
    margin-top: 8px;
    font-size: 13px;
    line-height: 1.55;
    color: rgba(255,255,255,0.94);
  }
  .card {
    margin-top: 14px;
    padding: 14px 16px;
    border-radius: 18px;
    border: 1px solid rgba(255,255,255,0.72);
    background: linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,251,255,0.94) 55%, rgba(232,239,248,0.9) 100%);
    box-shadow: 0 14px 32px -18px rgba(30, 27, 49,0.28), inset 0 1px 0 rgba(255,255,255,0.95);
  }
  .kicker {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: ${T.navyMid};
  }
  .body-copy {
    margin-top: 8px;
    font-size: 12px;
    line-height: 1.55;
    color: #3f3f46;
  }
  .closing {
    margin-top: 10px;
    font-size: 13px;
    line-height: 1.5;
    color: ${T.navy};
    font-weight: 600;
  }
  .list {
    margin: 10px 0 0 1.1rem;
    padding: 0;
    font-size: 12px;
    line-height: 1.5;
    color: #3f3f46;
  }
  .list li { margin-top: 7px; }
  .list li:first-child { margin-top: 0; }
  .empty { margin-top: 8px; font-size: 12px; color: #71717a; }
  .habits {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin-top: 10px;
  }
  .habit {
    padding: 10px 10px 12px;
    border-radius: 14px;
    border: 1px solid rgba(30, 27, 49,0.12);
    background: rgba(255,255,255,0.92);
  }
  .habit-k {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: ${T.navyMid};
  }
  .habit-v {
    margin-top: 6px;
    font-size: 18px;
    font-weight: 700;
    color: ${T.navy};
    line-height: 1.1;
  }
  .habit-h {
    margin-top: 4px;
    font-size: 10px;
    line-height: 1.35;
    color: #71717a;
  }
  .param-block { margin-top: 10px; }
  .param-block:first-of-type { margin-top: 10px; }
  .param-row {
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(0, 1.4fr) 36px minmax(0, 0.9fr);
    gap: 8px;
    align-items: center;
    font-size: 11px;
  }
  .param-label { font-weight: 600; color: #3f3f46; }
  .param-bar {
    height: 8px;
    border-radius: 999px;
    background: rgba(30, 27, 49,0.12);
    overflow: hidden;
  }
  .param-fill {
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(90deg, ${T.navyLight}, ${T.navy});
  }
  .param-val { text-align: right; font-weight: 700; color: ${T.navy}; }
  .param-delta { text-align: right; font-weight: 600; font-size: 10px; }
  .param-meta {
    margin-top: 3px;
    font-size: 10px;
    color: #71717a;
  }
  .delta-up { color: ${T.navy}; }
  .delta-down { color: ${T.navyLight}; }
  .delta-flat { color: #a1a1aa; }
  .scan-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 10px;
  }
  .scan-chip {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border-radius: 999px;
    border: 1px solid rgba(30, 27, 49,0.14);
    background: #fff;
    font-size: 11px;
  }
  .scan-chip-d { color: #71717a; }
  .scan-chip-v { font-weight: 700; color: ${T.navy}; }
  .pills { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
  .pill {
    display: inline-block;
    padding: 4px 10px;
    border-radius: 999px;
    border: 1px solid rgba(30, 27, 49,0.14);
    background: #fff;
    font-size: 11px;
    font-weight: 600;
    color: ${T.navy};
  }
  .foot {
    margin-top: 16px;
    padding: 12px 14px;
    border-radius: 16px;
    border: 1px solid rgba(157,185,255,0.35);
    background: linear-gradient(120deg, rgba(11, 24, 50, 0.84), rgba(8, 17, 36, 0.74));
    font-size: 9px;
    line-height: 1.45;
    color: #c2d1f6;
  }
  .foot strong {
    display: block;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    font-weight: 700;
    color: #eaf1ff;
    margin-bottom: 4px;
  }
</style></head>
<body>
  <div class="page" data-monthly-pdf-root>
    <header class="brand-row">
      <div>
        <p class="brand-kicker">kAI · SkinFit</p>
        <h1 class="brand-title">Monthly insight</h1>
      </div>
      <div class="meta">
        <strong>${esc(data.patientName)}</strong>
        ${esc(data.periodLabel)}
        ${generated ? `<br/>Prepared ${esc(generated)}` : ""}
      </div>
    </header>

    <section class="hero">
      <div class="hero-score">
        <p class="hero-score-k">Month kAI</p>
        <p class="hero-score-v">${esc(monthKai)}</p>
      </div>
      <div class="hero-copy">
        <p class="hero-title">${esc(data.summaryTitle || "Your month in review")}</p>
        <p class="hero-body">${esc(data.summaryBody || "Your monthly recap will appear here once enough scan and check-in data is available.")}</p>
      </div>
    </section>

    <section class="card">
      <p class="kicker">Highlights</p>
      ${listItems((data.highlights ?? []).slice(0, 8), false)}
    </section>

    <section class="card">
      <p class="kicker">Watch-outs</p>
      ${listItems((data.risks ?? []).slice(0, 8), false)}
    </section>

    <section class="card">
      <p class="kicker">Parameter deep dive</p>
      ${paramRows || `<p class="empty">No parameter scores for this month.</p>`}
      ${
        (data.parameterNotes ?? []).length
          ? `<div style="margin-top:12px">${listItems((data.parameterNotes ?? []).slice(0, 8), false)}</div>`
          : ""
      }
    </section>

    <section class="card">
      <p class="kicker">Habits this month</p>
      <div class="habits">
        ${habitCard(
          "Routine",
          `${ad.fullRoutineDays}/${ad.windowDays}`,
          "Full AM + PM days"
        )}
        ${habitCard(
          "AM days",
          String(ad.amDays),
          `Checklist avg ${ad.avgAmRoutineStepPct}%`
        )}
        ${habitCard(
          "PM days",
          String(ad.pmDays),
          `Checklist avg ${ad.avgPmRoutineStepPct}%`
        )}
        ${habitCard(
          "Consistency",
          `${ad.routineWeightedConsistencyPct}%`,
          "Checklist completion"
        )}
        ${habitCard(
          "Sleep",
          `${ad.avgSleepHours}h`,
          "Average per night"
        )}
        ${habitCard(
          "Water",
          `${ad.avgWaterGlasses}`,
          "Glasses daily avg"
        )}
        ${habitCard(
          "Stress",
          `${ad.avgStress}/10`,
          `${ad.highStressDays} high-stress days`
        )}
        ${habitCard(
          "Journal",
          `${ad.journalCompliancePct}%`,
          `${ad.journalDays} of ${ad.windowDays} days`
        )}
      </div>
      ${
        (data.habitNotes ?? []).length
          ? `<div style="margin-top:12px">${listItems((data.habitNotes ?? []).slice(0, 6), false)}</div>`
          : ""
      }
    </section>

    ${
      data.environmentNote?.trim()
        ? `<section class="card">
      <p class="kicker">Environment &amp; lifestyle</p>
      <p class="body-copy">${esc(data.environmentNote)}</p>
    </section>`
        : ""
    }

    <section class="card">
      <p class="kicker">Scan story</p>
      <p class="body-copy">${esc(data.scanStory || "")}</p>
      ${trajectory}
      ${scanChips}
    </section>

    ${
      hooks
        ? `<section class="card">
      <p class="kicker">From your weekly check-ins</p>
      ${hooks}
    </section>`
        : ""
    }

    ${
      identityPills
        ? `<section class="card">
      <p class="kicker">Your skin profile</p>
      <div class="pills">${identityPills}</div>
    </section>`
        : ""
    }

    <section class="card">
      <p class="kicker">Next month focus</p>
      ${listItems((data.nextMonthFocus ?? []).slice(0, 8), true)}
      ${
        data.closingNote
          ? `<p class="closing">${esc(data.closingNote)}</p>`
          : ""
      }
    </section>

    <footer class="foot">
      <strong>SkinFit clinic</strong>
      This monthly insight is for personal skin tracking and education. It is not a medical diagnosis.
      Share it with your clinician if you have questions about your progress.
    </footer>
  </div>
</body></html>`;
}

async function renderHtmlToPdf(html: string, fileName: string): Promise<void> {
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText =
    "position:fixed;left:-10000px;top:0;width:720px;pointer-events:none;opacity:0;";
  host.innerHTML = html;
  document.body.appendChild(host);

  try {
    const root = host.querySelector(
      "[data-monthly-pdf-root]"
    ) as HTMLElement | null;
    if (!root) throw new Error("Monthly PDF root missing");

    const html2canvas = (await import("html2canvas-pro")).default;
    const canvas = await html2canvas(root, {
      scale: 2,
      backgroundColor: SCAN_REPORT_PDF_PAGE_BG,
      useCORS: true,
      logging: false,
      width: 720,
      windowWidth: 720,
    });

    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 8;
    const usableWidth = pageWidth - margin * 2;
    const usableHeight = pageHeight - margin * 2;
    const imgWidth = usableWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const imgData = canvas.toDataURL("image/jpeg", 0.92);

    let heightLeft = imgHeight;
    let y = margin;

    pdf.addImage(imgData, "JPEG", margin, y, imgWidth, imgHeight);
    heightLeft -= usableHeight;

    while (heightLeft > 0.5) {
      y = margin - (imgHeight - heightLeft);
      pdf.addPage();
      pdf.addImage(imgData, "JPEG", margin, y, imgWidth, imgHeight);
      heightLeft -= usableHeight;
    }

    if (typeof pdf.setDisplayMode === "function") {
      pdf.setDisplayMode("fullwidth", "continuous");
    }

    pdf.save(fileName);
  } finally {
    host.remove();
  }
}

export async function downloadMonthlyKaiReportPdf(
  data: MonthlyReportDetail
): Promise<void> {
  const html = buildMonthlyReportHtml(data);
  const slug = data.periodLabel.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  await renderHtmlToPdf(html, `skinfit-monthly-${slug || "insight"}.pdf`);
}
