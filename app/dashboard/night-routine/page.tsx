"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, CloudMoon } from "lucide-react";
import { SkinFitLoader } from "@/components/dashboard/SkinFitLoader";
import { useJournalTrackerDate } from "@/src/hooks/useJournalTrackerDate";
import { RoutineStepList } from "@/components/dashboard/RoutineStepList";
import { normalizeRoutineSteps } from "@/src/lib/routine";

type HomeResponse = {
  amItems: string[];
  pmItems: string[];
  todayLog: {
    routineAmSteps?: boolean[] | null;
    routinePmSteps?: boolean[] | null;
  } | null;
};

export default function NightRoutinePage() {
  const journalDate = useJournalTrackerDate();
  const [loading, setLoading] = useState(true);
  const [pmItems, setPmItems] = useState<string[]>([]);
  const [checked, setChecked] = useState<boolean[]>([]);
  const [amSteps, setAmSteps] = useState<boolean[]>([]);

  useEffect(() => {
    fetch(`/api/patient/home?date=${encodeURIComponent(journalDate)}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data: HomeResponse) => {
        const pm = data.pmItems ?? [];
        setPmItems(pm);
        const amLen = data.amItems?.length ?? 0;
        setChecked(
          normalizeRoutineSteps(data.todayLog?.routinePmSteps, pm.length, undefined)
        );
        setAmSteps(
          normalizeRoutineSteps(data.todayLog?.routineAmSteps, amLen, undefined)
        );
      })
      .finally(() => setLoading(false));
  }, [journalDate]);

  const save = useCallback(
    (nextPm: boolean[]) => {
      fetch("/api/journal", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: journalDate,
          routineAmSteps: amSteps,
          routinePmSteps: nextPm,
        }),
      });
    },
    [journalDate, amSteps],
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

  const markAll = useCallback(() => {
    const next = pmItems.map(() => true);
    setChecked(next);
    save(next);
  }, [pmItems, save]);

  if (loading) {
    return (
      <SkinFitLoader
        title="Opening night routine"
        subtitle="kAI is fetching tonight’s steps."
      />
    );
  }

  if (pmItems.length === 0) {
    return (
      <section className="mx-auto flex max-w-md flex-col items-center gap-4 pt-20 text-center">
        <CloudMoon className="h-10 w-10 text-indigo-400" />
        <p className="text-sm font-medium text-slate-500">
          No night routine configured yet.
        </p>
        <Link
          href="/dashboard"
          className="text-sm font-semibold text-[#1E1B31] underline underline-offset-2"
        >
          Back to dashboard
        </Link>
      </section>
    );
  }

  return (
    <section className="mx-auto flex max-w-md flex-col gap-5 pb-10">
      <header className="flex items-center gap-3 pt-2">
        <Link
          href="/dashboard"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/60 bg-white/35 backdrop-blur-sm"
          aria-label="Back to dashboard"
        >
          <ArrowLeft className="h-5 w-5 text-[#1E1B31]" />
        </Link>
        <div className="flex items-center gap-2">
          <CloudMoon className="h-5 w-5 text-indigo-400" />
          <h1 className="text-xl font-bold tracking-tight text-[#1E1B31]">
            Night Routine
          </h1>
        </div>
      </header>

      <RoutineStepList
        items={pmItems}
        checked={checked}
        onToggle={toggle}
        onMarkAll={markAll}
        variant="night"
        quote="Your night routine is tomorrow's glow."
      />
    </section>
  );
}
