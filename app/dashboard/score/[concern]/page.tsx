import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
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
import {
  classifySkinParamMetric,
  patientClarityToGrade,
} from "@/src/lib/clarityGrade";
import { isPatientClinicVisited } from "@/src/lib/patientClinicVisit";
import { presentTrackerReportNarrative } from "@/src/lib/patientTrackerLockedCopy";
import { analysisResultsToParams } from "@/src/lib/skinScanAnalysis";
import {
  isSkinConcernSlug,
  slugToDisplayName,
  textMentionsConcern,
  type SkinConcernSlug,
} from "@/src/lib/skinConcernSlug";
import { loadScanTrackerReport } from "@/src/lib/scanTrackerSnapshot";
import { ClinicScoreUnlockCta } from "@/components/dashboard/ClinicScoreUnlockCta";

type PageProps = {
  params: Promise<{ concern: string }>;
};

function gradePillClass(grade: string): string {
  switch (grade) {
    case "A":
    case "B":
      return "bg-green-100 text-green-800 border-green-200";
    case "C":
      return "bg-amber-100 text-amber-800 border-amber-200";
    default:
      return "bg-red-100 text-red-800 border-red-200";
  }
}

function valueForConcern(
  slug: SkinConcernSlug,
  displayName: string,
  scoresJson: unknown,
  columns: {
    hydration: number;
    texture: number;
  }
): number | null {
  const rows = analysisResultsToParams(scoresJson);
  const hit = rows.find((r) => r.label === displayName);
  if (hit && typeof hit.value === "number") return hit.value;
  if (slug === "hydration") return columns.hydration;
  if (slug === "texture") return columns.texture;
  return null;
}

export default async function ScoreConcernPage({ params }: PageProps) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const { concern } = await params;
  if (!isSkinConcernSlug(concern)) notFound();

  const displayName = slugToDisplayName(concern);
  const slug = concern;

  const [user, latestScan] = await Promise.all([
    db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { clinicVisitedAt: true },
    }),
    db.query.scans.findFirst({
      where: eq(scans.userId, userId),
      orderBy: [desc(scans.createdAt), desc(scans.id)],
      columns: {
        id: true,
        scores: true,
        hydration: true,
        texture: true,
        trackerSnapshot: true,
      },
    }),
  ]);

  const scoresUnlocked = isPatientClinicVisited(user?.clinicVisitedAt ?? null);

  const currentValue = latestScan
    ? valueForConcern(slug, displayName, latestScan.scores, {
        hydration: latestScan.hydration,
        texture: latestScan.texture,
      })
    : null;

  const gradeInfo =
    currentValue != null ? classifySkinParamMetric(currentValue) : null;
  const gradeLetter =
    currentValue != null ? patientClarityToGrade(currentValue) : null;

  let tracker = latestScan
    ? await loadScanTrackerReport(
        userId,
        latestScan.id,
        latestScan.trackerSnapshot ?? null
      )
    : null;

  const narrative = tracker
    ? presentTrackerReportNarrative(tracker, scoresUnlocked)
    : null;

  const analysisLines = (() => {
    if (!narrative) return [] as string[];
    const fromCauses = narrative.causes
      .map((c) => c.text.replace(/^(Win|Drag|Watch|Environment):\s*/i, ""))
      .filter((t) => textMentionsConcern(t, slug));
    if (fromCauses.length > 0) return fromCauses;
    if (narrative.predictionText) return [narrative.predictionText];
    if (narrative.insightText) return [narrative.insightText];
    return [] as string[];
  })();

  const recommendations = (() => {
    if (!narrative) return [] as string[];
    const matched = narrative.focusActions
      .filter(
        (a) =>
          textMentionsConcern(a.title, slug) ||
          textMentionsConcern(a.detail, slug)
      )
      .map((a) => a.title);
    if (matched.length > 0) return matched;
    return narrative.focusActions.slice(0, 3).map((a) => a.title);
  })();

  const reportHref =
    latestScan != null
      ? `/dashboard/history/scans/${latestScan.id}`
      : "/dashboard/scan";

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#2C3E6B] transition hover:underline"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Dashboard
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight text-[#18181b] md:text-[28px]">
          {displayName}
        </h1>
        {gradeLetter && gradeInfo ? (
          <span
            className={`inline-flex items-center rounded-full border px-3.5 py-1.5 text-sm font-bold ${gradePillClass(gradeLetter)}`}
          >
            Grade {gradeLetter}
            <span className="ml-1.5 font-semibold opacity-80">
              · {gradeInfo.sublabel}
            </span>
          </span>
        ) : (
          <span className="text-sm text-[#6B7280]">No score yet</span>
        )}
      </div>

      {!scoresUnlocked ? <ClinicScoreUnlockCta compact /> : null}

      <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex items-center gap-2">
          <LineChart className="h-4 w-4 text-[#2C3E6B]" aria-hidden />
          <h2 className="text-sm font-bold text-[#18181b]">Score Trend</h2>
        </div>
        {/* TODO: wire real per-scan history series for this concern */}
        <div className="flex h-36 items-center justify-center rounded-lg bg-[#F3F4F6] px-4 text-center text-sm text-[#6B7280]">
          Score history chart — coming soon
        </div>
      </section>

      <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#2C3E6B]" aria-hidden />
          <h2 className="text-sm font-bold text-[#18181b]">AI Analysis</h2>
        </div>
        {analysisLines.length > 0 ? (
          <div className="space-y-2">
            {analysisLines.map((line, i) => (
              <p key={i} className="text-sm leading-relaxed text-[#6B7280]">
                {line}
              </p>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#6B7280]">
            Complete a scan to unlock kAI analysis for {displayName.toLowerCase()}
            .
          </p>
        )}
      </section>

      <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-[#2C3E6B]" aria-hidden />
          <h2 className="text-sm font-bold text-[#18181b]">Recommendations</h2>
        </div>
        {recommendations.length > 0 ? (
          <ul className="space-y-2">
            {recommendations.map((rec, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-sm text-[#6B7280]"
              >
                <ChevronRight
                  className="mt-0.5 h-4 w-4 shrink-0 text-[#2C3E6B]"
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
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[rgba(44,62,107,0.2)] bg-white py-3 text-sm font-semibold text-[#2C3E6B] shadow-sm transition hover:bg-[#F8FAFC]"
      >
        <FileText className="h-4 w-4" aria-hidden />
        {latestScan ? "View full scan report" : "Take a scan"}
      </Link>
    </div>
  );
}
