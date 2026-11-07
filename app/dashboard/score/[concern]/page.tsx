import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { format } from "date-fns";
import {
  ArrowLeft,
  ChevronRight,
  FileText,
  Lightbulb,
  LineChart,
  Sparkles,
} from "lucide-react";
import { db } from "@/src/db";
import { scans, users } from "@/src/db/schema";
import { getSessionUserId } from "@/src/lib/auth/get-session";
import { classifySkinParamMetric } from "@/src/lib/clarityGrade";
import { presentTrackerReportNarrative } from "@/src/lib/patientTrackerLockedCopy";
import { webPatientScoresUnlocked } from "@/src/lib/webPatientScores";
import {
  textMentionsConcern,
  type SkinConcernSlug,
} from "@/src/lib/skinConcernSlug";
import { loadScanTrackerReport } from "@/src/lib/scanTrackerSnapshot";
import { isOnboardingBaselineFocusActions } from "@/src/lib/onboardingBaselineFocusActions";
import { ScoreTrendChart } from "@/components/dashboard/ScoreTrendChart";
import { computeScoreChange, describeScoreChange } from "@/src/lib/scoreChange";
import { getConcernInsight } from "@/src/lib/concernInsight";
import {
  concernRawScore,
  isScorePageSlug,
  scorePageTitle,
  toHundred,
  trendDeltaLabel,
  type ScorePageSlug,
} from "@/src/lib/scoreConcernPage";

type PageProps = {
  params: Promise<{ concern: string }>;
};

function scorePillClass(score: number): string {
  if (score >= 70) return "border-[#242A5F]/20 bg-[#242A5F]/10 text-[#242A5F]";
  if (score >= 45) return "border-[#DF9DA4]/50 bg-[#F8EDEE] text-[#1E1B31]";
  return "border-[#4A2630]/20 bg-[#F8EDEE] text-[#4A2630]";
}

export default async function ScoreConcernPage({ params }: PageProps) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const { concern } = await params;
  if (!isScorePageSlug(concern)) notFound();

  const slug = concern as ScorePageSlug;
  const displayName = scorePageTitle(slug);
  const isOverall = slug === "overall";

  const [user, history] = await Promise.all([
    db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { clinicVisitedAt: true },
    }),
    db.query.scans.findMany({
      where: eq(scans.userId, userId),
      orderBy: [desc(scans.createdAt), desc(scans.id)],
      limit: 12,
      columns: {
        id: true,
        createdAt: true,
        scores: true,
        overallScore: true,
        acne: true,
        wrinkles: true,
        pigmentation: true,
        hydration: true,
        texture: true,
        trackerSnapshot: true,
      },
    }),
  ]);

  const scoresUnlocked = webPatientScoresUnlocked(
    (user?.clinicVisitedAt ?? null) != null
  );

  const latestScan = history[0] ?? null;
  const previousScan = history[1] ?? null;

  const currentRaw = latestScan
    ? concernRawScore(slug, latestScan)
    : null;
  const previousRaw = previousScan
    ? concernRawScore(slug, previousScan)
    : null;
  const current100 = toHundred(currentRaw);
  const previous100 = toHundred(previousRaw);
  const gradeInfo =
    currentRaw != null ? classifySkinParamMetric(currentRaw) : null;

  const chartPoints = [...history]
    .reverse()
    .map((scan) => {
      const raw = concernRawScore(slug, scan);
      const score100 = toHundred(raw);
      if (score100 == null) return null;
      return {
        label: format(scan.createdAt, "d MMM"),
        score100,
      };
    })
    .filter((p): p is { label: string; score100: number } => p != null);

  // Compare with the last scan, then two scans back, then the first, so slow progress shows.
  const concernChange = computeScoreChange(
    [...history]
      .reverse()
      .flatMap((scan) => {
        const v = toHundred(concernRawScore(slug, scan));
        return v == null ? [] : [{ at: scan.createdAt, value: v }];
      })
  );
  const deltaLabel = trendDeltaLabel(current100, previous100, concernChange);

  const tracker = latestScan
    ? await loadScanTrackerReport(
        userId,
        latestScan.id,
        latestScan.trackerSnapshot ?? null
      )
    : null;

  const narrative = tracker
    ? presentTrackerReportNarrative(tracker, scoresUnlocked)
    : null;

  // Every sentence on this screen is written by the AI and checked by a second AI and by code
  // (see src/lib/aiVerified.ts). If nothing passes, the cards are hidden: no canned text.
  const personal = latestScan
    ? await getConcernInsight({
        userId,
        scanId: latestScan.id,
        scanDate: latestScan.createdAt,
        scanScores: latestScan.scores,
        slug,
        concernLabel: displayName,
        scoresUnlocked,
        score100: current100,
        changeNote: describeScoreChange(concernChange),
        scanCount: history.length,
      })
    : null;

  const analysisLines: string[] = personal ? [personal.insight] : [];
  const recommendations: string[] = personal ? personal.actions : [];

  const reportHref = latestScan
    ? `/dashboard/scans/${latestScan.id}/report`
    : "/dashboard/scan";

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1E1B31] transition hover:underline"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Dashboard
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-headline text-2xl font-bold tracking-tight text-[#1E1B31] md:text-[28px]">
          {displayName}
        </h1>
        {current100 != null && gradeInfo ? (
          <div className="flex flex-col items-end gap-1">
            <span
              className={`inline-flex items-center rounded-full border px-3.5 py-1.5 text-sm font-bold ${scorePillClass(current100)}`}
            >
              {current100}/100
              <span className="ml-1.5 font-semibold opacity-80">
                · {gradeInfo.sublabel}
              </span>
            </span>
            {deltaLabel ? (
              <span className="text-[11px] font-semibold text-[#6B7280]">
                {deltaLabel}
              </span>
            ) : null}
          </div>
        ) : (
          <span className="text-sm text-[#6B7280]">No score yet</span>
        )}
      </div>

      <section className="rounded-2xl border border-[#E4E6F0] bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex items-center gap-2">
          <LineChart className="h-4 w-4 text-[#1E1B31]" aria-hidden />
          <h2 className="text-sm font-bold text-[#1E1B31]">Score trend</h2>
        </div>
        <ScoreTrendChart
          points={chartPoints}
          emptyHint={`No scan history for ${displayName.toLowerCase()} yet. Take a scan to start this trend.`}
        />
      </section>

      {analysisLines.length > 0 ? (
      <section className="rounded-2xl border border-[#E4E6F0] bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#1E1B31]" aria-hidden />
          <h2 className="text-sm font-bold text-[#1E1B31]">What’s moving</h2>
        </div>
        <div className="space-y-2.5">
          {analysisLines.map((line, i) => (
            <p key={i} className="text-sm leading-relaxed text-[#6B7280]">
              {line}
            </p>
          ))}
        </div>
      </section>
      ) : null}

      {recommendations.length > 0 ? (
      <section className="rounded-2xl border border-[#E4E6F0] bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-[#1E1B31]" aria-hidden />
          <h2 className="text-sm font-bold text-[#1E1B31]">Recommendations</h2>
        </div>
        <ul className="space-y-2">
            {recommendations.map((rec, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-sm text-[#1E1B31]"
              >
                <ChevronRight
                  className="mt-0.5 h-4 w-4 shrink-0 text-[#242A5F]"
                  aria-hidden
                />
                <span>{rec}</span>
              </li>
            ))}
        </ul>
      </section>
      ) : null}

      <Link
        href={reportHref}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1E1B31] py-3 text-sm font-semibold text-white transition hover:bg-[#242A5F]"
      >
        <FileText className="h-4 w-4" aria-hidden />
        {latestScan ? "View full scan report" : "Take a scan"}
      </Link>
    </div>
  );
}
