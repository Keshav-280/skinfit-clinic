import { isRagMonthlyPayloadV1 } from "@/src/lib/ragCronMonthlyPayload";
import type { MonthlyReportDetail } from "@/src/lib/ragMonthlyReportPdf";

/** Client-safe monthly report shape (no DB imports). */
export type MonthlyReportDisplay = {
  kind: "rag" | "placeholder" | "unknown";
  scans: number | null;
  loggedDays: number | null;
  kaiMonthAvg: number | null;
  summaryTitle: string | null;
  summaryBody: string | null;
  highlights: string[];
  risks: string[];
  nextMonthFocus: string[];
  parameterNotes: string[];
  habitNotes: string[];
  scanStory: string | null;
  closingNote: string | null;
  detail: MonthlyReportDetail | null;
};

/**
 * Align LLM prose with the headline month kAI shown in the UI.
 * Fixes older payloads where the model cited a per-scan score (e.g. 73)
 * instead of kaiMonthAvgFromParams (e.g. 72).
 */
export function alignMonthlyProseToHeadlineKai<
  T extends {
    summaryTitle?: string | null;
    summaryBody?: string | null;
    highlights?: string[] | null;
    risks?: string[] | null;
    nextMonthFocus?: string[] | null;
    parameterNotes?: string[] | null;
    habitNotes?: string[] | null;
    scanStory?: string | null;
    closingNote?: string | null;
    kaiMonthAvgFromParams?: number | null;
  },
>(monthly: T): T {
  const headline = monthly.kaiMonthAvgFromParams;
  if (headline == null || !Number.isFinite(headline)) return monthly;

  const fixProse = (text: string) =>
    text
      .replace(
        /\b((?:overall|month(?:ly)?)\s+)?kAI\s+score\s+(?:was|is|of|at)\s+\d+\b/gi,
        (match) => match.replace(/\d+/, String(headline))
      )
      .replace(
        /\b(?:overall|month(?:ly)?)\s+kAI\s+(?:was|is|of|at)\s+\d+\b/gi,
        (match) => match.replace(/\d+/, String(headline))
      )
      .replace(
        /\byour\s+kAI\s+(?:was|is|of|at)\s+\d+\b/gi,
        (match) => match.replace(/\d+/, String(headline))
      );

  return {
    ...monthly,
    summaryTitle: monthly.summaryTitle != null ? fixProse(monthly.summaryTitle) : monthly.summaryTitle,
    summaryBody: monthly.summaryBody != null ? fixProse(monthly.summaryBody) : monthly.summaryBody,
    highlights: (monthly.highlights ?? []).map(fixProse),
    risks: (monthly.risks ?? []).map(fixProse),
    nextMonthFocus: (monthly.nextMonthFocus ?? []).map(fixProse),
    parameterNotes: (monthly.parameterNotes ?? []).map(fixProse),
    habitNotes: (monthly.habitNotes ?? []).map(fixProse),
    scanStory:
      monthly.scanStory != null ? fixProse(monthly.scanStory) : monthly.scanStory,
    closingNote:
      monthly.closingNote != null ? fixProse(monthly.closingNote) : monthly.closingNote,
  };
}

export type PatientMonthlyInsightSnapshot = {
  locked: boolean;
  nextInsightAt: string | null;
  latestMonthStart: string | null;
  monthly: MonthlyReportDisplay | null;
};

export function parseMonthlyReportDisplay(payload: unknown): MonthlyReportDisplay {
  const empty: MonthlyReportDisplay = {
    kind: "unknown",
    scans: null,
    loggedDays: null,
    kaiMonthAvg: null,
    summaryTitle: null,
    summaryBody: null,
    highlights: [],
    risks: [],
    nextMonthFocus: [],
    parameterNotes: [],
    habitNotes: [],
    scanStory: null,
    closingNote: null,
    detail: null,
  };

  if (isRagMonthlyPayloadV1(payload)) {
    const m = alignMonthlyProseToHeadlineKai(payload.monthly);
    const detail = m.detail
      ? alignMonthlyProseToHeadlineKai(m.detail)
      : null;
    return {
      kind: "rag",
      scans: payload.totals?.scans ?? null,
      loggedDays: payload.totals?.loggedDaysApprox ?? null,
      kaiMonthAvg:
        typeof m.kaiMonthAvgFromParams === "number" ? m.kaiMonthAvgFromParams : null,
      summaryTitle: m.summaryTitle?.trim() || null,
      summaryBody: m.summaryBody?.trim() || null,
      highlights: (m.highlights ?? []).filter(Boolean),
      risks: (m.risks ?? []).filter(Boolean),
      nextMonthFocus: (m.nextMonthFocus ?? []).filter(Boolean),
      parameterNotes: (m.parameterNotes ?? detail?.parameterNotes ?? []).filter(Boolean),
      habitNotes: (m.habitNotes ?? detail?.habitNotes ?? []).filter(Boolean),
      scanStory: m.scanStory?.trim() || detail?.scanStory?.trim() || null,
      closingNote: m.closingNote?.trim() || detail?.closingNote?.trim() || null,
      detail,
    };
  }

  if (payload && typeof payload === "object") {
    const note = (payload as Record<string, unknown>).note;
    if (typeof note === "string" && /placeholder/i.test(note)) {
      return { ...empty, kind: "placeholder" };
    }
  }

  return empty;
}
