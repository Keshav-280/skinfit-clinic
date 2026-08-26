// TEMPORARY — no-auth preview of the Build page's redesigned Skin DNA card
// (gender avatar, gradient header, ring gauge) and the sticky-behind-scroll
// greeting effect, for local design review only. Mock data, no DB needed.
// Safe to delete once confirmed; not linked from anywhere in the app.
import { AlertTriangle, Activity } from "lucide-react";
import { SkinDNACard } from "@/components/dashboard/SkinDNACard";
import { TopArticlesSection } from "@/components/dashboard/PatientDashboardDesktop";
import { DASHBOARD_SECTION_CARD } from "@/components/dashboard/DashboardSectionHeader";

const MOCK_DATES = [22, 23, 24, 25, 26, 27, 28] as const;

function MockDatePicker() {
  return (
    <div className="flex items-center gap-1 overflow-x-auto rounded-2xl border border-[#E5E7EB] bg-white px-2 py-2 scrollbar-hide">
      {MOCK_DATES.map((d) => (
        <button
          key={d}
          type="button"
          className={
            d === 25
              ? "shrink-0 rounded-full bg-[#2C3E6B] px-4 py-2 text-sm font-bold text-white"
              : "shrink-0 rounded-full px-4 py-2 text-sm font-semibold text-[#6B7280] hover:bg-[#F5F3EF]"
          }
        >
          {d === 25 ? "Today" : d}
        </button>
      ))}
    </div>
  );
}

function FillerSection({ title }: { title: string }) {
  return (
    <section className={`${DASHBOARD_SECTION_CARD} min-w-0`}>
      <p className="text-xs font-bold uppercase tracking-wide text-[#6B7280]">
        {title}
      </p>
      <div className="mt-3 h-28 rounded-xl bg-[#F5F3EF]" />
    </section>
  );
}

export default async function BuildPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ gender?: string }>;
}) {
  const resolved = await searchParams;
  const gender = resolved.gender === "female" ? "female" : "male";

  return (
    <div className="min-h-dvh bg-[#F5F3EF] px-4 py-6 md:px-6">
      <div className="mx-auto max-w-3xl space-y-5">
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Preview only — mock data, no login. Try{" "}
          <code>?gender=female</code> in the URL to see the other avatar.
          Scroll down to see the sticky-behind-card effect.
        </p>

        {/* 1. Greeting + date strip — sticks below where a nav would be */}
        <div className="sticky top-4 z-0 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Good afternoon
              </p>
              <h1 className="mt-0.5 text-2xl font-extrabold text-[#18181b] md:text-3xl">
                {gender === "female" ? "Priya" : "Keshav"}
              </h1>
              <p className="mt-1 text-sm text-[#6B7280]">
                Here&apos;s your skin health today.
              </p>
            </div>
            <button
              type="button"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#EF4444] px-4 py-2.5 text-sm font-semibold text-white shadow-md"
            >
              <AlertTriangle className="h-4 w-4" />
              Urgent
            </button>
          </div>

          <MockDatePicker />
        </div>

        {/* Everything below rides a solid background over the sticky greeting */}
        <div className="relative z-10 space-y-5 rounded-t-3xl bg-[#F5F3EF] pt-1">
          {/* 2. Skin DNA — no profileImageUrl, so it falls back to the
              gender-matched avatar icon */}
          <SkinDNACard
            patientName={gender === "female" ? "Priya Sharma" : "Keshav Goyal"}
            profileImageUrl={null}
            gender={gender}
            kaiSkinScore={72}
            scoresUnlocked
            params={{
              acne: 78,
              pigmentation: 55,
              wrinkles: 88,
              hydration: 62,
              texture: 70,
            }}
            skinType="Oily"
            primaryConcern="Acne"
            fitzpatrick="III"
            weeklyDeltaScore={4}
            weeklyDeltaMeaningful
            streakCurrent={6}
            lastScanAt={new Date(Date.now() - 14 * 86400000).toISOString()}
            scanCount={10}
            hasScan
          />

          <FillerSection title="Doctor's Feedback" />
          <FillerSection title="Calendar" />
          <TopArticlesSection />
          <section className={`${DASHBOARD_SECTION_CARD} min-w-0`}>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#6B7280]">
              <Activity className="h-3.5 w-3.5" />
              Monthly Insight
            </div>
            <div className="mt-3 h-40 rounded-xl bg-[#F5F3EF]" />
          </section>
          <div className="h-64" />
        </div>
      </div>
    </div>
  );
}
