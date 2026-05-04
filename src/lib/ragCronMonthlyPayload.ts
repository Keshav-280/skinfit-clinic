import type { RagKaiTestPackage } from "@/src/lib/ragKaiTestService";

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

export function buildMonthlyRagCronPayload(
  pkg: RagKaiTestPackage,
  monthStartYmd: string
): MonthlyRagCronPayloadV1 {
  return {
    kind: "rag_monthly_v1",
    monthStart: monthStartYmd,
    generatedAt: pkg.generatedAt,
    patient: pkg.user,
    monthly: pkg.monthly,
    monthlies: pkg.monthlies,
    totals: { scans: pkg.totalScans, loggedDaysApprox: pkg.totalDays },
    llm: pkg.llm,
  };
}
