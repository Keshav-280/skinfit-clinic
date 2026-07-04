import type { MonthlyOutput, RagKaiTestPackage } from "@/src/lib/ragKaiTestService";

/** Stored in `monthly_reports.payload_json` when cron runs full RAG (no giant per-scan/day arrays). */
export type MonthlyRagCronPayloadV1 = {
  kind: "rag_monthly_v1";
  monthStart: string;
  generatedAt: string;
  patient: RagKaiTestPackage["user"];
  monthly: RagKaiTestPackage["monthly"];
  monthlies: RagKaiTestPackage["monthlies"];
  totals: { scans: number; loggedDaysApprox: number };
  llm: RagKaiTestPackage["llm"];
};

/** Pick the calendar-month report that matches a patient period start (YYYY-MM-DD). */
export function pickMonthlyForPeriodStart(
  monthlies: MonthlyOutput[],
  fallback: MonthlyOutput,
  monthStartYmd: string
): MonthlyOutput {
  const key = monthStartYmd.slice(0, 7); // YYYY-MM
  if (!/^\d{4}-\d{2}$/.test(key)) return fallback;

  const match = monthlies.find((mo) => mo.monthStart.slice(0, 7) === key);
  if (match) return match;

  // Period start mid-month still belongs to that calendar month's report.
  const byDetail = monthlies.find((mo) => {
    const label = mo.detail?.periodLabel ?? "";
    const [y, m] = key.split("-");
    const monthName = new Date(Number(y), Number(m) - 1, 1).toLocaleString(
      "en-US",
      { month: "long" }
    );
    return label.toLowerCase().includes(monthName.toLowerCase()) && label.includes(y!);
  });
  return byDetail ?? fallback;
}

export function buildMonthlyRagCronPayload(
  pkg: RagKaiTestPackage,
  monthStartYmd: string
): MonthlyRagCronPayloadV1 {
  const monthly = pickMonthlyForPeriodStart(
    pkg.monthlies,
    pkg.monthly,
    monthStartYmd
  );
  return {
    kind: "rag_monthly_v1",
    monthStart: monthStartYmd,
    generatedAt: pkg.generatedAt,
    patient: pkg.user,
    monthly,
    monthlies: pkg.monthlies,
    totals: { scans: pkg.totalScans, loggedDaysApprox: pkg.totalDays },
    llm: pkg.llm,
  };
}

export function isRagMonthlyPayloadV1(v: unknown): v is MonthlyRagCronPayloadV1 {
  if (!v || typeof v !== "object") return false;
  const x = v as Record<string, unknown>;
  return x.kind === "rag_monthly_v1" && !!x.monthly;
}
