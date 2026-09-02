"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { format, parseISO } from "date-fns";
import type { LastTreatmentVisit } from "@/components/dashboard/LastTreatmentCard";
import { WeeklyCheckinEntryCard } from "@/components/checkin/WeeklyCheckinEntryCard";
import type { CheckinConcernPath } from "@/src/lib/checkin/definitions";
import type { WellnessCheckinData } from "@/components/dashboard/WeeklyWellnessCheckinCard";

/** Kept for page.tsx / mobile type compatibility - calendar UI removed from Maintain. */
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

/** Placeholder shown for any doctor without a profile photo on file. */
const DEFAULT_DOCTOR_PHOTO = "/images/dr-ruby.png";

function useRotatingMessage(messages: string[], intervalMs = 4200): string {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    setIndex(0);
    if (messages.length <= 1) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % messages.length);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [messages.length, intervalMs]);
  return messages[index % messages.length] ?? "";
}

/** Doctor's-eye insight lines drawn from this week's actual check-in answers. */
function buildDoctorInsights(
  completed: boolean,
  summary: Array<{ label: string; value: string }> | null
): string[] {
  if (!completed || !summary || summary.length === 0) {
    return [
      "Log this week's check-in so I can tailor your plan.",
      "A minute now saves guesswork at your next visit.",
    ];
  }

  const byLabel = Object.fromEntries(
    summary.map((s) => [s.label.toLowerCase(), s.value])
  );
  const messages: string[] = [];

  if (byLabel.sleep) {
    messages.push(`Sleeping ${byLabel.sleep}, that's supporting your skin's repair cycle.`);
  }
  if (byLabel.stress) {
    messages.push(`Stress noted as "${byLabel.stress}", I'll watch for flare patterns this week.`);
  }
  if (byLabel.exercise) {
    messages.push(`${byLabel.exercise} of movement logged, keep that circulation going.`);
  }
  if (byLabel.water) {
    messages.push(`Water intake at ${byLabel.water}, I'll factor that into your care plan.`);
  } else if (byLabel.fuel) {
    messages.push(`Fuel intake at ${byLabel.fuel}, I'll factor that into your care plan.`);
  }
  if (messages.length === 0) {
    messages.push("Thanks for checking in, I'm reviewing your answers now.");
  }
  return messages;
}

function DoctorInsightBubble({
  message,
  className = "",
}: {
  message: string;
  className?: string;
}) {
  return (
    <div
      className={`relative rounded-2xl bg-white/90 px-3 py-2 shadow-[0_10px_24px_-8px_rgba(0,0,0,0.3)] backdrop-blur-sm ${className}`}
    >
      <AnimatePresence mode="wait">
        <motion.p
          key={message}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="text-[10.5px] font-medium leading-snug text-[#1E293B] sm:text-[11px]"
        >
          {message}
        </motion.p>
      </AnimatePresence>
      <span
        className="absolute -right-1 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rotate-45 rounded-[1px] bg-white/90"
        aria-hidden
      />
    </div>
  );
}

function HeroRingsMotif({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 320 320"
      fill="none"
      aria-hidden
    >
      <circle cx="200" cy="80" r="140" stroke="#1E1B31" strokeWidth="1" />
      <circle cx="200" cy="80" r="100" stroke="#1E1B31" strokeWidth="1" />
      <circle cx="200" cy="80" r="60" stroke="#1E1B31" strokeWidth="1" />
      <circle cx="200" cy="80" r="24" stroke="#1E1B31" strokeWidth="1" />
      <path
        d="M48 220c28-36 72-48 108-28 22 12 40 18 62 16"
        stroke="#1E1B31"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <path
        d="M70 248c22-28 56-38 86-22"
        stroke="#1E1B31"
        strokeWidth="1"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Maintain tab - weekly check-in entry (5-screen flow).
 */
export default function SchedulesPageClient({
  initialWellnessCheckin = null,
  wellnessWeekYmd,
  checkinConcern = "acne",
  checkinSummary = null,
  checkinCompleted = false,
  weeklyCheckinStreak = 0,
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
  weeklyCheckinStreak?: number;
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

  const summary = useMemo(
    () =>
      checkinSummary ??
      (initialWellnessCheckin
        ? [
            {
              label: "Sleep",
              value: initialWellnessCheckin.sleepHours ?? "-",
            },
            {
              label: "Stress",
              value:
                initialWellnessCheckin.stressLevel != null
                  ? String(initialWellnessCheckin.stressLevel)
                  : "-",
            },
            {
              label: "Exercise",
              value: initialWellnessCheckin.exerciseHours ?? "-",
            },
            {
              label: "Fuel",
              value: initialWellnessCheckin.nutritionLevel ?? "-",
            },
          ]
        : null),
    [checkinSummary, initialWellnessCheckin]
  );

  const doctorInsights = useMemo(
    () => buildDoctorInsights(completed, summary),
    [completed, summary]
  );
  const doctorInsight = useRotatingMessage(doctorInsights, 4200);

  return (
    <div className="relative">
      <div className="relative -mx-4 -mt-6 overflow-hidden bg-gradient-to-b from-[#1E1B31] to-[#242A5F] px-4 pb-10 pt-5 md:-mx-8 md:px-8 md:pb-12 md:pt-6">
        <svg
          viewBox="0 0 500 40"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-x-0 bottom-0 block h-8 w-full text-[#F0EAE2]"
          aria-hidden
        >
          <path
            d="M0,22 C125,44 375,-4 500,18 L500,40 L0,40 Z"
            fill="currentColor"
          />
        </svg>

        <div
          className={`relative mx-auto w-full max-w-5xl ${
            assignedDoctor ? "md:flex md:flex-row-reverse md:items-center md:justify-between md:gap-10 lg:gap-14" : ""
          }`}
        >
          {assignedDoctor ? (
            <div className="pointer-events-none absolute inset-y-0 right-0 w-[40%] sm:w-[38%] md:relative md:inset-auto md:h-[240px] md:w-[220px] md:shrink-0 lg:h-[280px] lg:w-[260px]">
              <img
                src={assignedDoctor.photoUrl ?? DEFAULT_DOCTOR_PHOTO}
                alt={assignedDoctor.name}
                className="h-full w-full object-contain object-right-bottom md:object-bottom"
              />
              <DoctorInsightBubble
                message={doctorInsight}
                className="absolute top-[18%] right-full z-10 mr-3 hidden w-[13.5rem] md:block lg:w-[15rem]"
              />
            </div>
          ) : (
            <HeroRingsMotif className="pointer-events-none absolute -right-8 -top-6 h-64 w-64 opacity-[0.06] md:-right-4 md:h-80 md:w-80" />
          )}

          <header
            className={`relative z-10 text-left ${
              assignedDoctor
                ? "max-w-[58%] md:max-w-xl md:flex-1"
                : ""
            }`}
          >
            <h1 className="font-headline text-2xl font-semibold leading-[1.14] tracking-tight text-white sm:text-3xl md:text-[2.15rem] md:leading-[1.15]">
              Beautiful Skin Is Built From{" "}
              <span className="text-[#AEB9E8]">Within.</span>
            </h1>

            <p className="mt-2 text-sm font-medium leading-snug text-white/80 sm:text-[15px]">
              Week of {weekOfLabel}
              <span className="mx-2 text-white/35" aria-hidden>
                ·
              </span>
              {completed ? (
                <span className="text-[#C5E0CC]">Completed</span>
              ) : (
                <span className="text-amber-200">Pending</span>
              )}
            </p>

            <div className="mt-2 flex items-center gap-2">
              <span className="text-lg leading-none" aria-hidden>
                🔥
              </span>
              <p className="text-sm font-semibold text-white/90 sm:text-[15px]">
                {weeklyCheckinStreak > 0
                  ? `${weeklyCheckinStreak} week${weeklyCheckinStreak === 1 ? "" : "s"} streak`
                  : "Start your weekly streak"}
              </p>
            </div>

            {assignedDoctor ? (
              <DoctorInsightBubble
                message={doctorInsight}
                className="mt-3 max-w-[16.5rem] md:hidden"
              />
            ) : null}
          </header>
        </div>
      </div>

      <div className="relative mx-auto mt-5 max-w-md px-4 pb-4 md:mt-6 md:max-w-2xl md:px-8">
        <WeeklyCheckinEntryCard
          weekYmd={wellnessWeekYmd}
          weekOfLabel={weekOfLabel}
          completed={completed}
          summary={summary}
        />
      </div>
    </div>
  );
}
