"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Atom,
  Brain,
  Check,
  Droplet,
  FlaskConical,
  Leaf,
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

function stressDescriptor(level: number): { label: string; color: string; bg: string } {
  if (level <= 3)
    return { label: "Relaxed", color: "#15803D", bg: "rgba(48,209,88,0.14)" };
  if (level <= 6)
    return { label: "Balanced", color: "#A16207", bg: "rgba(202,138,4,0.14)" };
  if (level <= 8)
    return { label: "Tense", color: "#C2410C", bg: "rgba(245,158,11,0.16)" };
  return { label: "High stress", color: "#B91C1C", bg: "rgba(220,38,38,0.12)" };
}

const PILL_SELECTED =
  "border-[#2C3E6B] bg-[#2C3E6B] text-white shadow-[0_4px_14px_-4px_rgba(44,62,107,0.45)] ring-2 ring-[#2C3E6B]/20 ring-offset-1";
const PILL_IDLE =
  "border-[#E5E7EB] bg-white text-[#2C3E6B] hover:border-[#2C3E6B]/25 hover:bg-[#F2F9F2]";

function SectionBlock({
  label,
  helper,
  Icon,
  children,
  showDivider = true,
  className = "",
}: {
  label: string;
  helper: string;
  Icon: LucideIcon;
  children: ReactNode;
  showDivider?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`${showDivider ? "border-t border-[#E8EBE8] pt-8" : ""} ${className}`}
    >
      <div className="mb-6 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2C3E6B]/8 text-[#2C3E6B]">
          <Icon className="h-[18px] w-[18px]" aria-hidden />
        </span>
        <div className="min-w-0 pt-0.5">
          <p className="text-[13px] font-bold tracking-wide text-[#18181b]">
            {label}
          </p>
          <p className="mt-0.5 text-[13px] text-[#6B7280]">{helper}</p>
        </div>
      </div>
      <div className="space-y-7">{children}</div>
    </div>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-3 text-sm font-semibold text-[#18181b]">{children}</p>
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
              className={`rounded-full border px-4 py-3 text-sm font-semibold transition duration-150 active:scale-95 ${
                selected ? PILL_SELECTED : PILL_IDLE
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
  helper,
  Icon,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  helper: string;
  Icon: LucideIcon;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-3 block text-sm font-semibold text-[#18181b]"
      >
        {label}
      </label>
      <div className="relative">
        <Icon
          className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#2C3E6B]/40"
          aria-hidden
        />
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-2xl border border-[#E5E7EB] bg-[#F8FAF8] py-3.5 pl-12 pr-4 text-[15px] text-[#18181b] outline-none transition placeholder:text-[#9CA3AF] focus:border-[#2C3E6B]/25 focus:bg-white focus:shadow-[inset_0_0_0_3px_rgba(44,62,107,0.08)]"
        />
      </div>
      <p className="mt-2 text-xs text-[#9CA3AF]">{helper}</p>
    </div>
  );
}

export function WeeklyWellnessCheckinCard({
  initialCheckin = null,
  onCompletedChange,
}: {
  initialCheckin?: WellnessCheckinData | null;
  /** Kept for callers that still pass the week label (intro lives on the page). */
  initialWeekYmd: string;
  onCompletedChange?: (completed: boolean) => void;
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
      onCompletedChange?.(true);
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
    <section className="rounded-3xl border border-[#E5E7EB]/90 bg-white p-6 shadow-[0_8px_40px_-12px_rgba(44,62,107,0.18)] md:p-9">
      <div className="space-y-0">
        <SectionBlock
          label="Lifestyle"
          helper="How you've been living this week"
          Icon={Leaf}
          showDivider={false}
        >
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

        <SectionBlock
          label="Body & Mind"
          helper="What supports you — and what weighs on you"
          Icon={Brain}
          showDivider={false}
          className="pt-8"
        >
          <IconTextField
            id="wellness-supplements"
            label="Supplements"
            value={supplements}
            onChange={setSupplements}
            placeholder="e.g. Vitamin D, Biotin, Zinc…"
            helper="Optional — list anything you take regularly"
            Icon={Pill}
          />

          <div>
            <div className="mb-3 flex items-center justify-between gap-2">
              <FieldLabel>Level of Stress</FieldLabel>
              <span className="text-sm font-extrabold tabular-nums text-[#2C3E6B]">
                {stressTouched ? `${stressLevel}/10` : "—/10"}
              </span>
            </div>

            <div className="min-w-0 overflow-x-auto">
              <div className="flex w-max min-w-full flex-nowrap rounded-2xl bg-gradient-to-r from-[#30D158]/25 via-amber-300/30 to-red-400/30 p-1.5 sm:p-2">
                <div className="flex w-full min-w-0 flex-nowrap items-center justify-between gap-0.5 rounded-xl bg-white/70 p-1 backdrop-blur-[2px] sm:gap-1.5 sm:p-1.5">
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
                        className={`flex h-8 min-h-8 min-w-8 flex-1 basis-0 items-center justify-center rounded-full text-xs font-bold transition duration-150 active:scale-95 sm:h-10 sm:min-h-10 sm:min-w-10 sm:max-w-10 sm:flex-none sm:basis-auto sm:text-sm ${
                          selected ? PILL_SELECTED : PILL_IDLE
                        }`}
                        aria-label={`Stress level ${n}`}
                        aria-pressed={selected}
                      >
                        {n}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {stressTouched ? (
              <span
                className="mt-3 inline-flex items-center rounded-full px-3 py-1 text-xs font-bold transition-colors duration-300"
                style={{
                  color: stressMeta.color,
                  backgroundColor: stressMeta.bg,
                }}
              >
                {stressMeta.label}
              </span>
            ) : (
              <p className="mt-3 text-sm text-[#9CA3AF]">
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
            helper="Helps kAI factor in your local climate"
            Icon={MapPin}
          />
        </SectionBlock>

        <SectionBlock
          label="Skincare"
          helper="What you put on your skin this week"
          Icon={Sparkles}
        >
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
                    className={`inline-flex items-center gap-2 rounded-full border px-4 py-3 text-sm font-semibold transition duration-150 active:scale-95 ${
                      checked ? PILL_SELECTED : PILL_IDLE
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
            helper="Optional — actives you used this week"
            Icon={Atom}
          />
        </SectionBlock>
      </div>

      <div className="mt-10 space-y-3 border-t border-[#E8EBE8] pt-7">
        {error ? (
          <p
            role="alert"
            className="rounded-2xl border border-red-200/80 bg-red-50/90 px-4 py-3.5 text-sm leading-relaxed text-red-800 shadow-sm"
          >
            {error}
          </p>
        ) : null}
        {savedHint ? (
          <p
            role="status"
            className="inline-flex w-full items-start gap-2 rounded-2xl border border-[#30D158]/30 bg-[#F2F9F2] px-4 py-3.5 text-sm leading-relaxed text-[#18181b] shadow-sm"
          >
            <Check
              className="mt-0.5 h-4 w-4 shrink-0 text-[#30D158]"
              aria-hidden
            />
            <span>{savedHint}</span>
          </p>
        ) : null}

        <button
          type="button"
          disabled={!hasAny || saving}
          onClick={() => void onSave()}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#2C3E6B] to-[#3A4F86] px-7 py-4 text-sm font-bold text-white shadow-[0_10px_28px_-10px_rgba(44,62,107,0.55)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_32px_-10px_rgba(44,62,107,0.6)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none md:w-auto"
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
