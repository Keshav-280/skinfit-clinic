"use client";

import { useMemo, useState } from "react";
import { ClipboardList, Loader2 } from "lucide-react";
import {
  DASHBOARD_SECTION_CARD,
  DashboardSectionHeader,
} from "@/components/dashboard/DashboardSectionHeader";

export type WellnessCheckinData = {
  id?: string;
  nutritionLevel: string | null;
  exerciseHours: string | null;
  sleepHours: string | null;
  supplements: string | null;
  stressLevel: number | null;
  city: string | null;
  skincareRoutine: string[] | null;
  activeIngredients: string | null;
  weekYmd: string;
};

const NUTRITION_OPTIONS = [
  "High Protein",
  "Low Protein",
  "Low Calorie",
  "Eating Outside",
] as const;

const EXERCISE_OPTIONS = ["0-2", "2-4", "4-6", "6+"] as const;
const SLEEP_OPTIONS = ["<4", "4-6", "6-8", "8+"] as const;
const ROUTINE_OPTIONS = [
  "Cleanser",
  "Toner/Serum",
  "Moisturiser",
  "Sunscreen",
] as const;

function PillGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly string[];
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-bold text-[#2C3E6B]">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const selected = value === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(selected ? null : opt)}
              className={`rounded-full border px-3.5 py-2 text-sm font-semibold transition ${
                selected
                  ? "border-[#2C3E6B] bg-[#2C3E6B] text-white"
                  : "border-[#E5E7EB] bg-white text-[#2C3E6B] hover:border-[#2C3E6B]/40 hover:bg-[#F2F9F2]"
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function WeeklyWellnessCheckinCard({
  initialCheckin = null,
  initialWeekYmd,
}: {
  initialCheckin?: WellnessCheckinData | null;
  initialWeekYmd: string;
}) {
  const [nutritionLevel, setNutritionLevel] = useState<string | null>(
    initialCheckin?.nutritionLevel ?? null
  );
  const [exerciseHours, setExerciseHours] = useState<string | null>(
    initialCheckin?.exerciseHours ?? null
  );
  const [sleepHours, setSleepHours] = useState<string | null>(
    initialCheckin?.sleepHours ?? null
  );
  const [supplements, setSupplements] = useState(
    initialCheckin?.supplements ?? ""
  );
  const [stressLevel, setStressLevel] = useState<number>(
    initialCheckin?.stressLevel ?? 5
  );
  const [stressTouched, setStressTouched] = useState(
    initialCheckin?.stressLevel != null
  );
  const [city, setCity] = useState(initialCheckin?.city ?? "");
  const [routine, setRoutine] = useState<string[]>(
    initialCheckin?.skincareRoutine ?? []
  );
  const [activeIngredients, setActiveIngredients] = useState(
    initialCheckin?.activeIngredients ?? ""
  );
  const [completed, setCompleted] = useState(Boolean(initialCheckin));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedHint, setSavedHint] = useState<string | null>(null);

  const hasAny = useMemo(() => {
    return (
      nutritionLevel != null ||
      exerciseHours != null ||
      sleepHours != null ||
      supplements.trim().length > 0 ||
      stressTouched ||
      city.trim().length > 0 ||
      routine.length > 0 ||
      activeIngredients.trim().length > 0
    );
  }, [
    nutritionLevel,
    exerciseHours,
    sleepHours,
    supplements,
    stressTouched,
    city,
    routine,
    activeIngredients,
  ]);

  function toggleRoutine(item: string) {
    setRoutine((prev) =>
      prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]
    );
  }

  async function onSave() {
    if (!hasAny || saving) return;
    setSaving(true);
    setError(null);
    setSavedHint(null);
    try {
      const res = await fetch("/api/patient/wellness-checkin", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nutritionLevel,
          exerciseHours,
          sleepHours,
          supplements: supplements.trim() || null,
          stressLevel: stressTouched ? stressLevel : null,
          city: city.trim() || null,
          skincareRoutine: routine,
          activeIngredients: activeIngredients.trim() || null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        updated?: boolean;
      };
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Could not save check-in.");
      }
      setCompleted(true);
      setSavedHint(
        data.updated
          ? "Updated this week's check-in."
          : "Saved this week's check-in."
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save check-in.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={`${DASHBOARD_SECTION_CARD} min-w-0`}>
      <DashboardSectionHeader
        icon={ClipboardList}
        title="WEEKLY WELLNESS CHECK-IN"
        action={
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
              completed
                ? "bg-emerald-100 text-emerald-800"
                : "bg-amber-100 text-amber-900"
            }`}
          >
            {completed
              ? "This week's check-in: ✓ Completed"
              : "This week's check-in: Pending"}
          </span>
        }
      />

      <p className="mb-1 text-xs font-medium text-[#6B7280]">
        Week of {initialWeekYmd}
      </p>

      <div className="mt-4 space-y-5">
        <PillGroup
          label="Nutrition Levels"
          options={NUTRITION_OPTIONS}
          value={nutritionLevel}
          onChange={setNutritionLevel}
        />
        <PillGroup
          label="Exercise Hours"
          options={EXERCISE_OPTIONS}
          value={exerciseHours}
          onChange={setExerciseHours}
        />
        <PillGroup
          label="Sleep Hours / Day"
          options={SLEEP_OPTIONS}
          value={sleepHours}
          onChange={setSleepHours}
        />

        <div>
          <label
            htmlFor="wellness-supplements"
            className="mb-2 block text-sm font-bold text-[#2C3E6B]"
          >
            Supplements
          </label>
          <input
            id="wellness-supplements"
            value={supplements}
            onChange={(e) => setSupplements(e.target.value)}
            placeholder="e.g. Vitamin D, Biotin, Zinc…"
            className="w-full rounded-xl border border-[#E5E7EB] bg-white px-3.5 py-2.5 text-sm text-[#18181b] outline-none ring-[#2C3E6B]/15 placeholder:text-[#9CA3AF] focus:ring-2"
          />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <label
              htmlFor="wellness-stress"
              className="text-sm font-bold text-[#2C3E6B]"
            >
              Level of Stress
            </label>
            <span className="text-sm font-extrabold tabular-nums text-[#2C3E6B]">
              {stressTouched ? `${stressLevel}/10` : "—/10"}
            </span>
          </div>
          <input
            id="wellness-stress"
            type="range"
            min={1}
            max={10}
            step={1}
            value={stressLevel}
            onChange={(e) => {
              setStressTouched(true);
              setStressLevel(Number(e.target.value));
            }}
            className="w-full accent-[#2C3E6B]"
          />
          <div className="mt-1 flex justify-between text-[11px] font-medium text-[#9CA3AF]">
            <span>1</span>
            <span>10</span>
          </div>
        </div>

        <div>
          <label
            htmlFor="wellness-city"
            className="mb-2 block text-sm font-bold text-[#2C3E6B]"
          >
            City
          </label>
          <input
            id="wellness-city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="e.g. Mumbai, Delhi…"
            className="w-full rounded-xl border border-[#E5E7EB] bg-white px-3.5 py-2.5 text-sm text-[#18181b] outline-none ring-[#2C3E6B]/15 placeholder:text-[#9CA3AF] focus:ring-2"
          />
        </div>

        <div>
          <p className="mb-2 text-sm font-bold text-[#2C3E6B]">Skincare Routine</p>
          <div className="flex flex-wrap gap-3">
            {ROUTINE_OPTIONS.map((item) => {
              const checked = routine.includes(item);
              return (
                <label
                  key={item}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-semibold text-[#2C3E6B]"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleRoutine(item)}
                    className="h-4 w-4 rounded border-[#E5E7EB] accent-[#2C3E6B]"
                  />
                  {item}
                </label>
              );
            })}
          </div>
        </div>

        <div>
          <label
            htmlFor="wellness-actives"
            className="mb-2 block text-sm font-bold text-[#2C3E6B]"
          >
            Active Ingredients
          </label>
          <input
            id="wellness-actives"
            value={activeIngredients}
            onChange={(e) => setActiveIngredients(e.target.value)}
            placeholder="e.g. Retinol, Niacinamide, Vitamin C…"
            className="w-full rounded-xl border border-[#E5E7EB] bg-white px-3.5 py-2.5 text-sm text-[#18181b] outline-none ring-[#2C3E6B]/15 placeholder:text-[#9CA3AF] focus:ring-2"
          />
        </div>

        {error ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        ) : null}
        {savedHint ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            {savedHint}
          </p>
        ) : null}

        <button
          type="button"
          disabled={!hasAny || saving}
          onClick={() => void onSave()}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#2C3E6B] px-5 py-3.5 text-sm font-bold text-white transition hover:bg-[#243456] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Saving…
            </>
          ) : (
            "Save Weekly Check-in"
          )}
        </button>
      </div>
    </section>
  );
}
