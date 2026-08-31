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
import {
  buildScoreAnalysis,
  concernRawScore,
  defaultConcernRecommendations,
  isScorePageSlug,
  scorePageTitle,
  toTen,
  trendDeltaLabel,
  type ScorePageSlug,
} from "@/src/lib/scoreConcernPage";

type PageProps = {
  params: Promise<{ concern: string }>;
};

function scorePillClass(score: number): string {
  if (score >= 7) return "border-[#242A5F]/20 bg-[#242A5F]/10 text-[#242A5F]";
  if (score >= 4) return "border-[#DF9DA4]/50 bg-[#F8EDEE] text-[#1E1B31]";
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
  const current10 = toTen(currentRaw);
  const previous10 = toTen(previousRaw);
  const gradeInfo =
    currentRaw != null ? classifySkinParamMetric(currentRaw) : null;
  const deltaLabel = trendDeltaLabel(current10, previous10);

  const chartPoints = [...history]
    .reverse()
    .map((scan) => {
      const raw = concernRawScore(slug, scan);
      const score10 = toTen(raw);
      if (score10 == null) return null;
      return {
        label: format(scan.createdAt, "d MMM"),
        score10,
      };
    })
    .filter((p): p is { label: string; score10: number } => p != null);

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

  const extraLines = (() => {
    if (!narrative || isOverall) {
      return isOverall && narrative?.insightText
        ? [narrative.insightText]
        : [];
    }
    const fromCauses = narrative.causes
      .map((c) => c.text.replace(/^(Win|Drag|Watch|Environment):\s*/i, ""))
      .filter((t) => textMentionsConcern(t, slug as SkinConcernSlug));
    return fromCauses;
  })();

  const analysisLines = buildScoreAnalysis({
    title: displayName,
    slug,
    current10,
    previous10,
    scanCount: history.length,
    lastScanLabel: latestScan
      ? format(latestScan.createdAt, "d MMM")
      : null,
    extraLines,
  });

  const recommendations = (() => {
    const fallback = defaultConcernRecommendations(slug);
    if (!narrative) return fallback;
    if (isOnboardingBaselineFocusActions(narrative.focusActions)) {
      return fallback;
    }
    if (isOverall) {
      const titles = narrative.focusActions.slice(0, 3).map((a) => a.title);
      return titles.length > 0 ? titles : fallback;
    }
    const matched = narrative.focusActions
      .filter(
        (a) =>
          textMentionsConcern(a.title, slug as SkinConcernSlug) ||
          textMentionsConcern(a.detail, slug as SkinConcernSlug)
      )
      .map((a) => a.title);
    if (matched.length > 0) return matched;
    return fallback;
  })();

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
        {current10 != null && gradeInfo ? (
          <div className="flex flex-col items-end gap-1">
            <span
              className={`inline-flex items-center rounded-full border px-3.5 py-1.5 text-sm font-bold ${scorePillClass(current10)}`}
            >
              {current10}/10
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

      <section className="rounded-2xl border border-[#E4E6F0] bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-[#1E1B31]" aria-hidden />
          <h2 className="text-sm font-bold text-[#1E1B31]">Recommendations</h2>
        </div>
        {recommendations.length > 0 ? (
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
        ) : (
          <p className="text-sm text-[#6B7280]">
            Personalized recommendations will appear after your next report.
          </p>
        )}
      </section>

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
