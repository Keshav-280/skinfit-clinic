// TEMPORARY — no-auth preview of the redesigned Build page top section: nav
// with the profile-completion ring badge, "Hi [Name]" greeting with a
// dynamic subtitle, the compact single-line date picker, and the redesigned
// Skin DNA card header. Mock data, no DB needed. Safe to delete once
// confirmed; not linked from anywhere in the app.
"use client";

import { useEffect, useState } from "react";
import { Activity, Bell, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { format, addDays } from "date-fns";
import { SkinDNACard } from "@/components/dashboard/SkinDNACard";
import { TopArticlesSection } from "@/components/dashboard/PatientDashboardDesktop";
import { DASHBOARD_SECTION_CARD } from "@/components/dashboard/DashboardSectionHeader";
import { PatientPortalBrandLogo } from "@/components/dashboard/PatientPortalBrandLogo";
import { AvatarIcon } from "@/components/dashboard/SkinDNACard";

const NAV_BADGE_SIZE = 36;
const NAV_BADGE_STROKE = 2.5;
const NAV_BADGE_RADIUS = (NAV_BADGE_SIZE - NAV_BADGE_STROKE) / 2;
const NAV_BADGE_CIRCUMFERENCE = 2 * Math.PI * NAV_BADGE_RADIUS;

/**
 * Mirrors ProfileNavBadge's markup exactly, but with a hardcoded fill —
 * the real component needs a login session to fetch photo/completion %,
 * which this no-auth preview doesn't have.
 */
function MockProfileNavBadge({ gender, pct }: { gender: "male" | "female"; pct: number }) {
  const offset = NAV_BADGE_CIRCUMFERENCE * (1 - pct / 100);
  return (
    <div
      className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
      title={`Profile ${pct}% complete`}
    >
      <svg width={NAV_BADGE_SIZE} height={NAV_BADGE_SIZE} className="absolute inset-0 -rotate-90" aria-hidden>
        <circle
          cx={NAV_BADGE_SIZE / 2}
          cy={NAV_BADGE_SIZE / 2}
          r={NAV_BADGE_RADIUS}
          fill="none"
          stroke="#E5E7EB"
          strokeWidth={NAV_BADGE_STROKE}
        />
        <circle
          cx={NAV_BADGE_SIZE / 2}
          cy={NAV_BADGE_SIZE / 2}
          r={NAV_BADGE_RADIUS}
          fill="none"
          stroke="#2C3E6B"
          strokeWidth={NAV_BADGE_STROKE}
          strokeLinecap="round"
          strokeDasharray={NAV_BADGE_CIRCUMFERENCE}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#2C3E6B]/10">
        <AvatarIcon gender={gender} />
      </span>
    </div>
  );
}

/** Mirrors the real compact date-picker row's markup/classes exactly. */
function MockDatePicker() {
  const [selected, setSelected] = useState(new Date());
  return (
    <div className="flex items-center justify-end gap-0.5">
      <button
        type="button"
        onClick={() => setSelected((d) => addDays(d, -1))}
        aria-label="Previous day"
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[#9CA3AF] transition hover:bg-[#F5F3EF] hover:text-[#2C3E6B]"
      >
        <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
      </button>
      <span className="min-w-0 truncate px-1 text-xs font-semibold text-[#18181b]">
        {format(selected, "EEE, d MMM")}
      </span>
      <button
        type="button"
        onClick={() => setSelected((d) => addDays(d, 1))}
        aria-label="Next day"
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[#9CA3AF] transition hover:bg-[#F5F3EF] hover:text-[#2C3E6B]"
      >
        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
      </button>
      <button
        type="button"
        aria-label="Choose a date from the calendar"
        className="ml-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[#9CA3AF] transition hover:bg-[#F5F3EF] hover:text-[#2C3E6B]"
      >
        <Calendar className="h-3.5 w-3.5" aria-hidden />
      </button>
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

export default function BuildPreviewPage() {
  const [gender, setGender] = useState<"male" | "female">("male");
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setGender(params.get("gender") === "female" ? "female" : "male");
  }, []);
  const name = gender === "female" ? "Priya" : "Keshav";
  const mockLastScanAt = "2026-08-13T09:00:00.000Z";

  return (
    <div className="min-h-dvh bg-[#F5F3EF]">
      {/* Mock top nav — mirrors app/dashboard/layout.tsx */}
      <nav className="sticky top-0 z-50 border-b border-[#E5E7EB] bg-white/80 shadow-[0_2px_16px_rgba(45,62,107,0.06)] backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 py-3 sm:gap-3 sm:px-6 md:px-8 sm:py-4">
          <PatientPortalBrandLogo />
          <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E5E7EB] bg-white text-[#2D3E6B] transition-colors hover:bg-white"
              title="Notifications"
            >
              <Bell className="h-4 w-4" />
            </button>
            <MockProfileNavBadge gender={gender} pct={60} />
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-3xl space-y-5 px-4 py-6 md:px-6">
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Preview only — mock data, no login. The nav profile badge above is
          a hardcoded stand-in (60% complete) showing what it looks like
          filled — the real one needs a login session to fetch your actual
          photo/completion %. Try <code>?gender=female</code> in the URL to
          see the other avatar. Scroll down to see the sticky-behind-card
          effect.
        </p>

        {/* 1. Greeting + date strip — sticks below the nav */}
        <div className="sticky top-14 z-0 sm:top-16">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-extrabold text-[#18181b] md:text-3xl">
                Hi {name} 👋
              </h1>
              <p className="mt-0.5 truncate text-sm text-[#6B7280]">
                Your skin improved 4% this week.
              </p>
            </div>

            <div className="shrink-0 pt-1">
              <MockDatePicker />
            </div>
          </div>
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
            lastScanAt={mockLastScanAt}
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
