"use client";

import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Check } from "lucide-react";
import {
  WeeklyWellnessCheckinCard,
  type WellnessCheckinData,
} from "@/components/dashboard/WeeklyWellnessCheckinCard";
import type { LastTreatmentVisit } from "@/components/dashboard/LastTreatmentCard";

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
 * Maintain tab — weekly wellness questionnaire only.
 * Props from page.tsx are accepted for compatibility; only wellness fields are used.
 */
export default function SchedulesPageClient({
  initialWellnessCheckin = null,
  wellnessWeekYmd,
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
}) {
  const [completed, setCompleted] = useState(Boolean(initialWellnessCheckin));

  const weekOfLabel = useMemo(() => {
    try {
      return format(parseISO(`${wellnessWeekYmd}T00:00:00`), "d MMM");
    } catch {
      return wellnessWeekYmd;
    }
  }, [wellnessWeekYmd]);

  return (
    <div className="relative">
      {/* Soft hero band */}
      <div className="relative -mx-4 -mt-5 overflow-hidden bg-gradient-to-b from-[#EEF4EA] via-[#EEF4EA]/80 to-transparent px-4 pb-2 pt-8 md:-mx-6 md:px-6 md:pt-10">
        <HeroRingsMotif className="pointer-events-none absolute -right-8 -top-6 h-64 w-64 opacity-[0.04] md:-right-4 md:h-80 md:w-80" />

        <header className="relative mx-auto max-w-2xl text-center md:text-left">
          <div className="inline-flex flex-col items-center md:items-start">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[#2C3E6B]/55">
              Weekly Ritual
            </p>
            <span
              className="mt-2.5 h-1 w-1 rounded-full bg-[#2C3E6B]/50"
              aria-hidden
            />
          </div>

          <h1 className="mt-5 font-serif text-3xl font-semibold leading-[1.12] tracking-tight text-[#18181b] md:text-4xl md:leading-[1.1]">
            Beautiful skin is built from within.
          </h1>

          <p className="mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-[#6B7280] md:mx-0 md:text-base">
            A few moments each week to log how you&apos;re living — so kAI can
            tune your care to your life.
          </p>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5 md:justify-start">
            <span className="inline-flex items-center rounded-full border border-[#2C3E6B]/12 bg-white/80 px-3.5 py-1.5 text-xs font-medium text-[#2C3E6B] shadow-sm backdrop-blur-sm">
              Week of {weekOfLabel}
            </span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium shadow-sm backdrop-blur-sm ${
                completed
                  ? "border-[#30D158]/35 bg-white/80 text-[#18181b]"
                  : "border-[#2C3E6B]/12 bg-white/80 text-[#6B7280]"
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

      <div className="relative mx-auto mt-8 max-w-2xl pb-4 md:mt-10">
        <WeeklyWellnessCheckinCard
          initialCheckin={initialWellnessCheckin}
          initialWeekYmd={wellnessWeekYmd}
          onCompletedChange={setCompleted}
        />
      </div>
    </div>
  );
}
