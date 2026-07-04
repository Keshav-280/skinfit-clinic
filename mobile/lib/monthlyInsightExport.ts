import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Alert } from "react-native";

import { NAVY } from "@/components/profile/theme";

export type MonthlyInsightExportData = {
  summaryTitle: string;
  summaryBody: string;
  highlights: string[];
  risks: string[];
  nextMonthFocus: string[];
  parameterNotes?: string[];
  habitNotes?: string[];
  scanStory?: string | null;
  closingNote?: string | null;
  kaiMonthAvgFromParams: number | null;
  periodLabel?: string;
  patientName?: string;
  detail?: {
    periodLabel?: string;
    parameters?: Array<{
      key: string;
      label: string;
      latest: number | null;
      vsPrior: number | null;
      vsMonthStart: number | null;
      monthMean: number | null;
    }>;
    adherence30d?: {
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
      journalDays: number;
    };
    scans?: Array<{ index: number; date: string; kaiScore: number }>;
    recentScanHooks?: string[];
    parameterNotes?: string[];
    habitNotes?: string[];
    scanStory?: string | null;
    closingNote?: string | null;
  };
};

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function listItems(arr: string[], ordered: boolean): string {
  if (!arr.length) return `<p class="empty">Nothing to show here yet.</p>`;
  const tag = ordered ? "ol" : "ul";
  const inner = arr.map((x) => `<li>${escHtml(x)}</li>`).join("");
  return `<${tag} class="list">${inner}</${tag}>`;
}

function signed(n: number): string {
  return `${n > 0 ? "+" : ""}${n}`;
}

export function buildMonthlyInsightHtml(monthly: MonthlyInsightExportData): string {
  const detail = monthly.detail;
  const monthKai =
    monthly.kaiMonthAvgFromParams != null
      ? String(monthly.kaiMonthAvgFromParams)
      : "—";
  const name = monthly.patientName?.trim() || "";
  const period =
    monthly.periodLabel?.trim() || detail?.periodLabel?.trim() || "";
  const highlights = (monthly.highlights ?? []).slice(0, 8);
  const risks = (monthly.risks ?? []).slice(0, 8);
  const focus = (monthly.nextMonthFocus ?? []).slice(0, 8);
  const parameterNotes = (
    monthly.parameterNotes ??
    detail?.parameterNotes ??
    []
  ).slice(0, 8);
  const habitNotes = (monthly.habitNotes ?? detail?.habitNotes ?? []).slice(0, 6);
  const scanStory = monthly.scanStory ?? detail?.scanStory ?? null;
  const closingNote = monthly.closingNote ?? detail?.closingNote ?? null;
  const ad = detail?.adherence30d;
  const params = detail?.parameters ?? [];
  const scans = detail?.scans ?? [];
  const hooks = detail?.recentScanHooks ?? [];

  const paramHtml = params
    .map((p) => {
      const move =
        p.vsMonthStart == null
          ? "—"
          : p.vsMonthStart >= 3
            ? `${signed(p.vsMonthStart)} improved`
            : p.vsMonthStart <= -3
              ? `${signed(p.vsMonthStart)} softer`
              : `${signed(p.vsMonthStart)} steady`;
      return `<div class="param"><strong>${escHtml(p.label)}</strong> · latest ${
        p.latest ?? "—"
      } · month avg ${p.monthMean ?? "—"} · ${escHtml(move)}</div>`;
    })
    .join("");

  const habitHtml = ad
    ? `<div class="habits">
        <div class="habit"><span>Routine</span><b>${ad.fullRoutineDays}/${ad.windowDays}</b></div>
        <div class="habit"><span>Consistency</span><b>${ad.routineWeightedConsistencyPct}%</b></div>
        <div class="habit"><span>Sleep</span><b>${ad.avgSleepHours}h</b></div>
        <div class="habit"><span>Water</span><b>${ad.avgWaterGlasses}</b></div>
        <div class="habit"><span>Stress</span><b>${ad.avgStress}/10</b></div>
        <div class="habit"><span>Journal</span><b>${ad.journalCompliancePct}%</b></div>
      </div>`
    : "";

  const scanHtml = scans.length
    ? `<div class="scans">${scans
        .map(
          (s) =>
            `<span class="chip">${escHtml(s.date)} · kAI ${s.kaiScore}</span>`
        )
        .join("")}</div>`
    : "";

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width"/>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#2C3E6B;background:#F4F7FB;padding:20px;line-height:1.5}
  .brand-k{font-size:10px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#3d5080}
  .brand-t{font-family:Georgia,serif;font-size:26px;font-weight:500;color:#1E3264;margin-top:4px}
  .meta{margin-top:10px;font-size:12px;color:#52525b}
  .meta strong{color:${NAVY}}
  .hero{margin-top:16px;padding:16px;border-radius:18px;background:linear-gradient(135deg,#1E3264 0%,#2C3E6B 55%,#3d5080 100%);color:#fff}
  .score-k{font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.72)}
  .score-v{font-size:40px;font-weight:800;line-height:1;margin-top:4px}
  .hero-title{margin-top:14px;font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.72)}
  .hero-body{margin-top:6px;font-size:13px;line-height:1.55;color:rgba(255,255,255,.94)}
  .card{margin-top:12px;padding:14px;border-radius:16px;border:1px solid rgba(44,62,107,.12);background:#fff}
  .kicker{font-size:10px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#3d5080}
  .list{margin:10px 0 0 1.1rem;font-size:12px;color:#3f3f46}
  .list li{margin-top:7px}
  .empty{margin-top:8px;font-size:12px;color:#71717a}
  .body{margin-top:8px;font-size:12px;color:#3f3f46;line-height:1.55}
  .closing{margin-top:10px;font-size:13px;font-weight:600;color:${NAVY}}
  .param{margin-top:8px;font-size:12px;color:#3f3f46}
  .habits{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}
  .habit{padding:10px;border-radius:12px;background:#f8fafc;border:1px solid #e5e7eb}
  .habit span{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#64748b}
  .habit b{display:block;margin-top:4px;font-size:16px;color:${NAVY}}
  .scans{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
  .chip{display:inline-block;padding:4px 10px;border-radius:999px;background:#fff;border:1px solid #e5e7eb;font-size:11px;font-weight:600;color:${NAVY}}
  .foot{margin-top:16px;font-size:10px;color:#71717a;line-height:1.45}
</style></head><body>
  <p class="brand-k">kAI · SkinFit</p>
  <h1 class="brand-t">Monthly insight</h1>
  ${
    name || period
      ? `<p class="meta">${name ? `<strong>${escHtml(name)}</strong>` : ""}${
          name && period ? " · " : ""
        }${period ? escHtml(period) : ""}</p>`
      : ""
  }
  <section class="hero">
    <p class="score-k">Month kAI</p>
    <p class="score-v">${escHtml(monthKai)}</p>
    <p class="hero-title">${escHtml(monthly.summaryTitle || "Your month in review")}</p>
    <p class="hero-body">${escHtml(monthly.summaryBody || "")}</p>
  </section>
  <section class="card"><p class="kicker">Highlights</p>${listItems(highlights, false)}</section>
  <section class="card"><p class="kicker">Watch-outs</p>${listItems(risks, false)}</section>
  ${
    paramHtml || parameterNotes.length
      ? `<section class="card"><p class="kicker">Parameter deep dive</p>${paramHtml}${
          parameterNotes.length
            ? listItems(parameterNotes, false)
            : ""
        }</section>`
      : ""
  }
  ${
    habitHtml || habitNotes.length
      ? `<section class="card"><p class="kicker">Habits this month</p>${habitHtml}${
          habitNotes.length ? listItems(habitNotes, false) : ""
        }</section>`
      : ""
  }
  ${
    scanStory || scanHtml
      ? `<section class="card"><p class="kicker">Scan story</p>${
          scanStory ? `<p class="body">${escHtml(scanStory)}</p>` : ""
        }${scanHtml}</section>`
      : ""
  }
  ${
    hooks.length
      ? `<section class="card"><p class="kicker">From your weekly check-ins</p>${listItems(
          hooks.slice(0, 4),
          true
        )}</section>`
      : ""
  }
  <section class="card">
    <p class="kicker">Next month focus</p>
    ${listItems(focus, true)}
    ${closingNote ? `<p class="closing">${escHtml(closingNote)}</p>` : ""}
  </section>
  <p class="foot">This monthly insight is for personal skin tracking and education. It is not a medical diagnosis.</p>
</body></html>`;
}

export async function exportMonthlyInsightPdf(monthly: MonthlyInsightExportData) {
  try {
    const { uri } = await Print.printToFileAsync({
      html: buildMonthlyInsightHtml(monthly),
    });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle: "Monthly insight",
      });
    } else {
      Alert.alert("PDF", "Sharing is not available on this device.");
    }
  } catch (e) {
    Alert.alert("Export", e instanceof Error ? e.message : "Could not create PDF.");
  }
}
