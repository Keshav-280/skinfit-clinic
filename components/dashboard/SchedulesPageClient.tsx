"use client";

import { useMemo } from "react";
import { format, parseISO } from "date-fns";
import { Check } from "lucide-react";
import type { LastTreatmentVisit } from "@/components/dashboard/LastTreatmentCard";
import { WeeklyCheckinEntryCard } from "@/components/checkin/WeeklyCheckinEntryCard";
import type { CheckinConcernPath } from "@/src/lib/checkin/definitions";
import type { WellnessCheckinData } from "@/components/dashboard/WeeklyWellnessCheckinCard";

/** Kept for page.tsx / mobile type compatibility — calendar UI removed from Maintain. */
export type ScheduleEventRow = {
  id: string;
  eventDateYmd: string;
  eventTimeHm: string | null;
  eventSlotEndTimeHm?: string | null;
  title: string;
  eventKind?: string;
  completed: boolean;
  cancelled?: boolean;
  attachmentsCount?: number;
  crmPatientMessage?: string | null;
  cancellationReason?: string | null;
  doctorName?: string | null;
  doctorPhotoUrl?: string | null;
  appointmentType?: string | null;
};

export type PendingScheduleRequestRow = {
  id: string;
  preferredDateYmd: string;
  issue?: string;
  daysAffected?: number | null;
  timePreferences: string;
  attachmentsCount?: number;
  status: string;
  cancelledReason?: string | null;
};

type AssignedDoctorSummary = {
  name: string;
  photoUrl: string | null;
};

function HeroRingsMotif({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 320 320"
      fill="none"
      aria-hidden
    >
      <circle cx="200" cy="80" r="140" stroke="#2C3E6B" strokeWidth="1" />
      <circle cx="200" cy="80" r="100" stroke="#2C3E6B" strokeWidth="1" />
      <circle cx="200" cy="80" r="60" stroke="#2C3E6B" strokeWidth="1" />
      <circle cx="200" cy="80" r="24" stroke="#2C3E6B" strokeWidth="1" />
      <path
        d="M48 220c28-36 72-48 108-28 22 12 40 18 62 16"
        stroke="#2C3E6B"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <path
        d="M70 248c22-28 56-38 86-22"
        stroke="#2C3E6B"
        strokeWidth="1"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Maintain tab — weekly check-in entry (5-screen flow).
 */
export default function SchedulesPageClient({
  initialWellnessCheckin = null,
  wellnessWeekYmd,
  checkinConcern = "acne",
  checkinSummary = null,
  checkinCompleted = false,
  assignedDoctor = null,
}: {
  initialTreatmentEvents: ScheduleEventRow[];
  initialAppointmentEvents: ScheduleEventRow[];
  pendingScheduleRequests: PendingScheduleRequestRow[];
  closedScheduleRequests: PendingScheduleRequestRow[];
  initialScheduleUnreadCount?: number;
  latestVisit?: LastTreatmentVisit | null;
  assignedDoctor?: AssignedDoctorSummary | null;
  showKaiInsights?: boolean;
  patientHasPhone?: boolean;
  initialPhoneCountryCode?: string;
  initialPhone?: string | null;
  initialWellnessCheckin?: WellnessCheckinData | null;
  wellnessWeekYmd: string;
  checkinConcern?: CheckinConcernPath;
  checkinSummary?: Array<{ label: string; value: string }> | null;
  checkinCompleted?: boolean;
}) {
  const completed =
    checkinCompleted ||
    Boolean(initialWellnessCheckin?.sleepHours || initialWellnessCheckin?.id);

  const weekOfLabel = useMemo(() => {
    try {
      return format(parseISO(`${wellnessWeekYmd}T00:00:00`), "d MMM");
    } catch {
      return wellnessWeekYmd;
    }
  }, [wellnessWeekYmd]);

  const summary =
    checkinSummary ??
    (initialWellnessCheckin
      ? [
          {
            label: "Sleep",
            value: initialWellnessCheckin.sleepHours ?? "—",
          },
          {
            label: "Stress",
            value:
              initialWellnessCheckin.stressLevel != null
                ? String(initialWellnessCheckin.stressLevel)
                : "—",
          },
          {
            label: "Exercise",
            value: initialWellnessCheckin.exerciseHours ?? "—",
          },
          {
            label: "Fuel",
            value: initialWellnessCheckin.nutritionLevel ?? "—",
          },
        ]
      : null);

  return (
    <div className="relative">
      <div className="relative -mx-4 -mt-5 overflow-hidden bg-gradient-to-b from-[#2C3E6B] to-[#1E3264] px-4 pb-10 pt-8 md:-mx-6 md:px-6 md:pt-10">
        {assignedDoctor?.photoUrl ? (
          <div className="pointer-events-none absolute bottom-0 right-0 h-56 w-44 md:h-64 md:w-52">
            <img
              src={assignedDoctor.photoUrl}
              alt={assignedDoctor.name}
              className="h-full w-full object-contain object-bottom"
            />
          </div>
        ) : (
          <HeroRingsMotif className="pointer-events-none absolute -right-8 -top-6 h-64 w-64 opacity-[0.06] md:-right-4 md:h-80 md:w-80" />
        )}

        <header className="relative mx-auto max-w-2xl text-center md:text-left" style={{ maxWidth: assignedDoctor?.photoUrl ? "60%" : undefined }}>
          <div className="inline-flex flex-col items-center md:items-start">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/55">
              Weekly Ritual
            </p>
            <span
              className="mt-2.5 h-1 w-1 rounded-full bg-white/40"
              aria-hidden
            />
          </div>

          <h1 className="mt-5 font-serif text-3xl font-semibold leading-[1.12] tracking-tight text-white md:text-4xl md:leading-[1.1]">
            Beautiful Skin Is Built From Within.
          </h1>

          <p className="mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-white/70 md:mx-0 md:text-base">
            A few moments each week to log how you&apos;re living — so kAI can
            tune your care to your life.
          </p>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5 md:justify-start">
            <span className="inline-flex items-center rounded-full border border-white/20 bg-white/15 px-3.5 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
              Week of {weekOfLabel}
            </span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium backdrop-blur-sm ${
                completed
                  ? "border-[#30D158]/50 bg-white/15 text-white"
                  : "border-white/20 bg-white/10 text-white/70"
              }`}
            >
              {completed ? (
                <Check
                  className="h-3.5 w-3.5 shrink-0 text-[#30D158]"
                  aria-hidden
                />
              ) : null}
              {completed ? "Completed" : "Pending"}
            </span>
          </div>
        </header>
      </div>

      <div className="relative mx-auto mt-8 max-w-md pb-4 md:mt-10">
        <WeeklyCheckinEntryCard
          weekYmd={wellnessWeekYmd}
          weekOfLabel={weekOfLabel}
          completed={completed}
          concern={checkinConcern}
          summary={summary}
        />
      </div>
    </div>
  );
}
