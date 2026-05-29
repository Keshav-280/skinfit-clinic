"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Sun, Check, Loader2 } from "lucide-react";
import { useJournalTrackerDate } from "@/src/hooks/useJournalTrackerDate";

const STEP_COLORS = [
  "#FDE68A",
  "#FCA5A5",
  "#BBF7D0",
  "#C4B5FD",
  "#FBCFE8",
  "#BAE6FD",
  "#FED7AA",
  "#DDD6FE",
];

type HomeResponse = {
  amItems: string[];
  pmItems: string[];
  todayLog: {
    routineAmSteps?: boolean[] | null;
    routinePmSteps?: boolean[] | null;
  } | null;
};

function ProgressRing({
  completed,
  total,
}: {
  completed: number;
  total: number;
}) {
  const radius = 40;
  const stroke = 6;
  const circumference = 2 * Math.PI * radius;
  const progress = total === 0 ? 0 : (completed / total) * circumference;

  return (
    <div className="relative flex items-center justify-center">
      <svg width={100} height={100} className="-rotate-90">
        <circle
          cx={50}
          cy={50}
          r={radius}
          fill="none"
          className="stroke-slate-200"
          strokeWidth={stroke}
        />
        <circle
          cx={50}
          cy={50}
          r={radius}
          fill="none"
          className="stroke-green-500 transition-all duration-500 ease-out"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
        />
      </svg>
      <span className="absolute text-sm font-bold text-[#2C3E6B]">
        {completed}/{total}
      </span>
    </div>
  );
}

export default function MorningRoutinePage() {
  const journalDate = useJournalTrackerDate();
  const [loading, setLoading] = useState(true);
  const [amItems, setAmItems] = useState<string[]>([]);
  const [checked, setChecked] = useState<boolean[]>([]);
  const [pmSteps, setPmSteps] = useState<boolean[]>([]);

  useEffect(() => {
    fetch(`/api/patient/home?date=${encodeURIComponent(journalDate)}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data: HomeResponse) => {
        setAmItems(data.amItems ?? []);
        const amLen = data.amItems?.length ?? 0;
        const pmLen = data.pmItems?.length ?? 0;
        setChecked(
          data.todayLog?.routineAmSteps ?? new Array(amLen).fill(false),
        );
        setPmSteps(
          data.todayLog?.routinePmSteps ?? new Array(pmLen).fill(false),
        );
      })
      .finally(() => setLoading(false));
  }, [journalDate]);

  const save = useCallback(
    (nextAm: boolean[]) => {
      fetch("/api/journal", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: journalDate,
          routineAmSteps: nextAm,
          routinePmSteps: pmSteps,
        }),
      });
    },
    [journalDate, pmSteps],
  );

  const toggle = useCallback(
    (index: number) => {
      setChecked((prev) => {
        const next = prev.map((v, i) => (i === index ? !v : v));
        save(next);
        return next;
      });
    },
    [save],
  );

  const completedCount = checked.filter(Boolean).length;

  if (loading) {
    return (
      <section className="mx-auto flex max-w-md items-center justify-center pt-32">
        <Loader2 className="h-8 w-8 animate-spin text-[#2C3E6B]" />
      </section>
    );
  }

  if (amItems.length === 0) {
    return (
      <section className="mx-auto flex max-w-md flex-col items-center gap-4 pt-20 text-center">
        <Sun className="h-10 w-10 text-amber-400" />
        <p className="text-sm font-medium text-slate-500">
          No morning routine configured yet.
        </p>
        <Link
          href="/dashboard"
          className="text-sm font-semibold text-[#2C3E6B] underline underline-offset-2"
        >
          Back to dashboard
        </Link>
      </section>
    );
  }

  return (
    <section className="mx-auto flex max-w-md flex-col gap-6 pb-10">
      {/* Header */}
      <header className="flex items-center gap-3 pt-2">
        <Link
          href="/dashboard"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/60 bg-white/35 backdrop-blur-sm"
          aria-label="Back to dashboard"
        >
          <ArrowLeft className="h-5 w-5 text-[#2C3E6B]" />
        </Link>
        <div className="flex items-center gap-2">
          <Sun className="h-5 w-5 text-amber-500" />
          <h1 className="text-xl font-bold tracking-tight text-[#2C3E6B]">
            Morning Routine
          </h1>
        </div>
      </header>

      {/* Motivational Quote */}
      <div className="rounded-2xl border border-white/60 bg-white/35 px-5 py-4 text-center backdrop-blur-sm">
        <p className="text-sm font-medium italic text-slate-500">
          &ldquo;Consistency is your superpower.&rdquo;
        </p>
      </div>

      {/* Progress Ring */}
      <div className="flex flex-col items-center gap-1 rounded-2xl border border-white/60 bg-white/35 py-5 backdrop-blur-sm">
        <ProgressRing completed={completedCount} total={amItems.length} />
        <p className="mt-1 text-xs font-medium text-slate-400">
          {completedCount === amItems.length
            ? "All done! Great job today."
            : `${amItems.length - completedCount} steps remaining`}
        </p>
      </div>

      {/* Step Cards */}
      <ul className="flex flex-col gap-3">
        {amItems.map((step, i) => {
          const color = STEP_COLORS[i % STEP_COLORS.length];
          const done = checked[i];

          return (
            <li key={step}>
              <button
                type="button"
                onClick={() => toggle(i)}
                className="flex w-full items-center gap-4 rounded-2xl border border-white/60 bg-white/35 px-4 py-3.5 backdrop-blur-sm transition-transform active:scale-[0.98]"
                style={{ borderLeft: `4px solid ${color}` }}
              >
                <span
                  className={`text-sm font-medium transition-colors ${
                    done
                      ? "text-slate-400 line-through"
                      : "text-[#2C3E6B]"
                  }`}
                >
                  {step}
                </span>

                <span
                  className={`ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                    done
                      ? "border-green-500 bg-green-500 text-white"
                      : "border-slate-300 bg-white/50"
                  }`}
                  aria-hidden="true"
                >
                  {done && <Check className="h-4 w-4" />}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
