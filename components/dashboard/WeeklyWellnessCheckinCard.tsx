"use client";

import { useMemo, useState, type ReactNode } from "react";
import { format, parseISO } from "date-fns";
import type { LucideIcon } from "lucide-react";
import {
  Atom,
  Check,
  Droplet,
  FlaskConical,
  Loader2,
  MapPin,
  Pill,
  Sparkles,
  Sun,
} from "lucide-react";

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

const ROUTINE_ICONS: Record<(typeof ROUTINE_OPTIONS)[number], LucideIcon> = {
  Cleanser: Droplet,
  "Toner/Serum": FlaskConical,
  Moisturiser: Sparkles,
  Sunscreen: Sun,
};

function stressDescriptor(level: number): { label: string; color: string } {
  if (level <= 3) return { label: "Relaxed", color: "#4CAF50" };
  if (level <= 6) return { label: "Balanced", color: "#CA8A04" };
  if (level <= 8) return { label: "Tense", color: "#F59E0B" };
  return { label: "High stress", color: "#DC2626" };
}

function SectionBlock({
  label,
  children,
  showDivider = true,
}: {
  label: string;
  children: ReactNode;
  showDivider?: boolean;
}) {
  return (
    <div className={showDivider ? "border-t border-[#E5E7EB]/80 pt-7" : ""}>
      <p className="mb-5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#2C3E6B]/55">
        {label}
      </p>
      <div className="space-y-6">{children}</div>
    </div>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2.5 text-sm font-semibold text-[#18181b]">{children}</p>
  );
}

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
      <FieldLabel>{label}</FieldLabel>
      <div className="flex flex-wrap gap-2.5">
        {options.map((opt) => {
          const selected = value === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(selected ? null : opt)}
              className={`rounded-full border px-4 py-2.5 text-sm font-semibold transition active:scale-95 ${
                selected
                  ? "border-[#2C3E6B] bg-[#2C3E6B] text-white shadow-sm ring-2 ring-[#2C3E6B]/25 ring-offset-1"
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

function IconTextField({
  id,
  label,
  value,
  onChange,
  placeholder,
  Icon,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  Icon: LucideIcon;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-2.5 block text-sm font-semibold text-[#18181b]">
        {label}
      </label>
      <div className="relative">
        <Icon
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#2C3E6B]/45"
          aria-hidden
        />
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-2xl border border-[#E5E7EB] bg-[#F8FAF8] py-3 pl-11 pr-4 text-sm text-[#18181b] outline-none transition placeholder:text-[#9CA3AF] focus:border-[#2C3E6B]/30 focus:bg-white focus:ring-2 focus:ring-[#2C3E6B]/15"
        />
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

  const stressMeta = stressDescriptor(stressLevel);

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

  const weekOfLabel = useMemo(() => {
    try {
      return format(parseISO(`${initialWeekYmd}T00:00:00`), "d MMM");
    } catch {
      return initialWeekYmd;
    }
  }, [initialWeekYmd]);

  return (
    <div className="mx-auto w-full max-w-2xl">
      {/* Intro header */}
      <header className="mb-10 text-center md:mb-12 md:text-left">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#2C3E6B]/55">
          Weekly Ritual
        </p>
        <h1 className="mt-3 font-serif text-[1.85rem] font-semibold leading-[1.15] tracking-tight text-[#18181b] md:text-[2.35rem]">
          Beautiful skin is built from within.
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-[#6B7280] md:mx-0">
          A few moments each week to log how you&apos;re living — so kAI can
          tune your care to your life.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5 md:justify-start">
          <span className="inline-flex items-center rounded-full border border-[#2C3E6B]/12 bg-white/60 px-3.5 py-1.5 text-xs font-medium text-[#2C3E6B]/80 backdrop-blur-sm">
            Week of {weekOfLabel}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium ${
              completed
                ? "border-emerald-200/80 bg-emerald-50/60 text-emerald-800"
                : "border-amber-200/70 bg-amber-50/50 text-amber-900/80"
            }`}
          >
            {completed ? (
              <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
            ) : null}
            {completed ? "Completed" : "Pending"}
          </span>
        </div>
      </header>

      {/* Questionnaire card */}
      <section className="rounded-3xl bg-white p-6 shadow-[0_4px_24px_-8px_rgba(44,62,107,0.15)] md:p-8">
        <div className="space-y-0">
          <SectionBlock label="Lifestyle" showDivider={false}>
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
          </SectionBlock>

          <SectionBlock label="Body & Mind">
            <IconTextField
              id="wellness-supplements"
              label="Supplements"
              value={supplements}
              onChange={setSupplements}
              placeholder="e.g. Vitamin D, Biotin, Zinc…"
              Icon={Pill}
            />

            <div>
              <div className="mb-2.5 flex items-center justify-between gap-2">
                <FieldLabel>Level of Stress</FieldLabel>
                <span className="text-sm font-extrabold tabular-nums text-[#2C3E6B]">
                  {stressTouched ? `${stressLevel}/10` : "—/10"}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {Array.from({ length: 10 }, (_, i) => {
                  const n = i + 1;
                  const selected = stressTouched && stressLevel === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => {
                        setStressTouched(true);
                        setStressLevel(n);
                      }}
                      className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition active:scale-95 sm:h-10 sm:w-10 ${
                        selected
                          ? "bg-[#2C3E6B] text-white shadow-sm ring-2 ring-[#2C3E6B]/25 ring-offset-1"
                          : "border border-[#E5E7EB] bg-white text-[#2C3E6B] hover:border-[#2C3E6B]/40 hover:bg-[#F2F9F2]"
                      }`}
                      aria-label={`Stress level ${n}`}
                      aria-pressed={selected}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
              {stressTouched ? (
                <p
                  className="mt-2.5 text-sm font-semibold"
                  style={{ color: stressMeta.color }}
                >
                  {stressMeta.label}
                </p>
              ) : (
                <p className="mt-2.5 text-sm text-[#9CA3AF]">
                  Tap a number to rate your stress
                </p>
              )}
            </div>

            <IconTextField
              id="wellness-city"
              label="City"
              value={city}
              onChange={setCity}
              placeholder="e.g. Mumbai, Delhi…"
              Icon={MapPin}
            />
          </SectionBlock>

          <SectionBlock label="Skincare">
            <div>
              <FieldLabel>Skincare Routine</FieldLabel>
              <div className="flex flex-wrap gap-2.5">
                {ROUTINE_OPTIONS.map((item) => {
                  const checked = routine.includes(item);
                  const Icon = ROUTINE_ICONS[item];
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => toggleRoutine(item)}
                      aria-pressed={checked}
                      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition active:scale-95 ${
                        checked
                          ? "border-[#2C3E6B] bg-[#2C3E6B] text-white shadow-sm ring-2 ring-[#2C3E6B]/25 ring-offset-1"
                          : "border-[#E5E7EB] bg-white text-[#2C3E6B] hover:border-[#2C3E6B]/40 hover:bg-[#F2F9F2]"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                      {item}
                    </button>
                  );
                })}
              </div>
            </div>

            <IconTextField
              id="wellness-actives"
              label="Active Ingredients"
              value={activeIngredients}
              onChange={setActiveIngredients}
              placeholder="e.g. Retinol, Niacinamide, Vitamin C…"
              Icon={Atom}
            />
          </SectionBlock>
        </div>

        <div className="mt-8 space-y-3 border-t border-[#E5E7EB]/80 pt-6">
          {error ? (
            <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </p>
          ) : null}
          {savedHint ? (
            <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              {savedHint}
            </p>
          ) : null}

          <button
            type="button"
            disabled={!hasAny || saving}
            onClick={() => void onSave()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#2C3E6B] to-[#3A4F86] px-6 py-3.5 text-sm font-bold text-white shadow-[0_8px_20px_-10px_rgba(44,62,107,0.55)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none md:w-auto"
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
    </div>
  );
}
