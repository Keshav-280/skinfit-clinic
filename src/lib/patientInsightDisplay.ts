import { isRagMonthlyPayloadV1 } from "@/src/lib/ragCronMonthlyPayload";

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
};

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
  };

  if (isRagMonthlyPayloadV1(payload)) {
    const m = payload.monthly;
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
