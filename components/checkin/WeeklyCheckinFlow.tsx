"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { CheckinScreen } from "@/components/checkin/CheckinScreen";
import { AnchoredScaleField } from "@/components/checkin/fields/AnchoredScaleField";
import { SingleSelectField } from "@/components/checkin/fields/SingleSelectField";
import { MultiSelectField } from "@/components/checkin/fields/MultiSelectField";
import { AutocompleteMultiField } from "@/components/checkin/fields/AutocompleteMultiField";
import { ConditionalField } from "@/components/checkin/fields/ConditionalField";
import { NumberField } from "@/components/checkin/fields/NumberField";
import {
  CONCERN_PATH_LABELS,
  screensForConcern,
  showCyclePhaseField,
  type CheckinConcernPath,
  type FieldDef,
} from "@/src/lib/checkin/definitions";
import {
  emptyCheckinAnswers,
  type CheckinAnswers,
} from "@/src/lib/checkin/types";

function draftKey(weekYmd: string) {
  return `skinfit_weekly_checkin_draft_v1_${weekYmd}`;
}

function screenComplete(
  fields: FieldDef[],
  answers: CheckinAnswers,
  showCycle: boolean
): boolean {
  for (const f of fields) {
    if (f.conditional === "cycle_phase" && !showCycle) continue;
    if (f.type === "multi" || f.type === "autocomplete_multi") {
      const v =
        f.key === "nutrition" || f.key === "supplements"
          ? (answers[f.key as "nutrition" | "supplements"] as string[])
          : (answers.concernSpecific[f.key] as string[] | undefined);
      if (!Array.isArray(v) || v.length === 0) return false;
      continue;
    }
    if (f.type === "number") {
      const v = answers.concernSpecific[f.key];
      if (typeof v !== "number" || !Number.isFinite(v)) return false;
      continue;
    }
    if (f.key === "sleep_hours" || f.key === "stress" || f.key === "water" || f.key === "exercise_hours") {
      if (!answers[f.key]) return false;
      continue;
    }
    const v = answers.concernSpecific[f.key];
    if (typeof v !== "string" || !v) return false;
  }
  return true;
}

function summaryLines(answers: CheckinAnswers): Array<{ label: string; value: string }> {
  return [
    { label: "Sleep", value: answers.sleep_hours ?? "—" },
    { label: "Stress", value: answers.stress?.replace(/_/g, " ") ?? "—" },
    { label: "Water", value: answers.water ?? "—" },
    {
      label: "Exercise",
      value: answers.exercise_hours ?? "—",
    },
  ];
}

export type WeeklyCheckinFlowProps = {
  weekYmd: string;
  concern: CheckinConcernPath;
  gender: string | null;
  age: number | null;
  existing: {
    id: string;
    answers: CheckinAnswers;
    submittedAt: string | null;
    flags: string[];
  } | null;
  initialEdit?: boolean;
};

export function WeeklyCheckinFlow({
  weekYmd,
  concern,
  gender,
  age,
  existing,
  initialEdit = false,
}: WeeklyCheckinFlowProps) {
  const router = useRouter();
  const screens = useMemo(() => screensForConcern(concern), [concern]);
  const showCycle = showCyclePhaseField({ gender, age });

  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<"forward" | "back">("forward");
  const [answers, setAnswers] = useState<CheckinAnswers>(() =>
    existing?.answers ? existing.answers : emptyCheckinAnswers()
  );
  const [mode, setMode] = useState<"form" | "done">(
    existing && !initialEdit ? "done" : "form"
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (existing && !initialEdit) return;
    try {
      const raw = localStorage.getItem(draftKey(weekYmd));
      if (!raw) return;
      const parsed = JSON.parse(raw) as CheckinAnswers;
      if (parsed && typeof parsed === "object") {
        setAnswers({ ...emptyCheckinAnswers(), ...parsed });
      }
    } catch {
      /* ignore */
    }
  }, [weekYmd, existing, initialEdit]);

  const saveDraft = useCallback(
    (next: CheckinAnswers) => {
      try {
        localStorage.setItem(draftKey(weekYmd), JSON.stringify(next));
      } catch {
        /* ignore */
      }
    },
    [weekYmd]
  );

  const screen = screens[step]!;
  const isLast = step === screens.length - 1;
  const canNext = screenComplete(screen.fields, answers, showCycle);

  function setUniversal(
    key: "sleep_hours" | "stress" | "water" | "exercise_hours",
    value: string
  ) {
    setAnswers((prev) => {
      const next = { ...prev, [key]: value };
      saveDraft(next);
      return next;
    });
  }

  function setUniversalMulti(key: "nutrition" | "supplements", value: string[]) {
    setAnswers((prev) => {
      const next = { ...prev, [key]: value };
      saveDraft(next);
      return next;
    });
  }

  function setConcernValue(key: string, value: string | string[] | number | null) {
    setAnswers((prev) => {
      const next = {
        ...prev,
        concernSpecific: { ...prev.concernSpecific, [key]: value },
      };
      saveDraft(next);
      return next;
    });
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/patient/weekly-checkin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          weekYmd,
          concern,
          answers,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        ok?: boolean;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || `Save failed (${res.status})`);
      }
      try {
        localStorage.removeItem(draftKey(weekYmd));
      } catch {
        /* ignore */
      }
      setMode("done");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save check-in.");
    } finally {
      setSubmitting(false);
    }
  }

  function goNext() {
    if (!canNext) return;
    if (isLast) {
      void submit();
      return;
    }
    setDir("forward");
    setStep((s) => Math.min(s + 1, screens.length - 1));
    saveDraft(answers);
  }

  function goBack() {
    setDir("back");
    setStep((s) => Math.max(0, s - 1));
  }

  if (mode === "done") {
    const lines = summaryLines(answers);
    return (
      <div className="min-h-[100dvh] bg-kai-sage">
        <div className="mx-auto flex min-h-[100dvh] w-full max-w-[392px] flex-col bg-kai-paper px-6 py-10 shadow-[0_0_0_1px_rgba(43,55,87,0.06)]">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(78,155,114,0.15)] text-kai-good">
            <Check className="h-6 w-6" strokeWidth={2.5} aria-hidden />
          </div>
          <h1 className="font-serif text-[24px] font-light tracking-[-0.02em] text-kai-ink">
            Check-in complete
          </h1>
          <p className="mt-2 text-[13px] leading-[1.5] text-kai-ink-2">
            Week of {weekYmd} · {CONCERN_PATH_LABELS[concern]} path. kAI can
            now read your next scan in context.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-2">
            {lines.map((l) => (
              <div key={l.label} className="rounded-[12px] bg-kai-sage px-3 py-3">
                <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-kai-ink-3">
                  {l.label}
                </p>
                <p className="mt-1 text-[13px] font-semibold capitalize text-kai-ink">
                  {l.value}
                </p>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              setMode("form");
              setStep(0);
            }}
            className="mt-8 w-full rounded-[12px] border border-kai-rule bg-white py-3.5 text-[14px] font-semibold text-kai-ink"
          >
            Edit answers
          </button>
          <button
            type="button"
            onClick={() => router.push("/dashboard/schedules")}
            className="mt-2.5 w-full rounded-[12px] bg-kai-navy py-3.5 text-[14px] font-semibold text-white"
          >
            Back to Maintain
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      key={step}
      className={
        dir === "forward"
          ? "animate-[checkinSlideIn_220ms_ease-out]"
          : "animate-[checkinSlideBack_220ms_ease-out]"
      }
    >
      <CheckinScreen
        step={step + 1}
        totalSteps={screens.length}
        title={screen.title}
        subtitle={screen.subtitle}
        onNext={goNext}
        onBack={goBack}
        isLast={isLast}
        nextDisabled={!canNext}
        submitting={submitting}
      >
        {screen.fields.map((field) => (
          <FieldRenderer
            key={field.key}
            field={field}
            answers={answers}
            showCycle={showCycle}
            onUniversal={setUniversal}
            onUniversalMulti={setUniversalMulti}
            onConcern={setConcernValue}
          />
        ))}
        {error ? (
          <p className="text-[12px] text-kai-low">{error}</p>
        ) : null}
      </CheckinScreen>
    </div>
  );
}

function FieldRenderer({
  field,
  answers,
  showCycle,
  onUniversal,
  onUniversalMulti,
  onConcern,
}: {
  field: FieldDef;
  answers: CheckinAnswers;
  showCycle: boolean;
  onUniversal: (
    key: "sleep_hours" | "stress" | "water" | "exercise_hours",
    value: string
  ) => void;
  onUniversalMulti: (key: "nutrition" | "supplements", value: string[]) => void;
  onConcern: (key: string, value: string | string[] | number | null) => void;
}) {
  const inner = (() => {
    if (
      field.key === "sleep_hours" ||
      field.key === "stress" ||
      field.key === "water" ||
      field.key === "exercise_hours"
    ) {
      const uKey = field.key as "sleep_hours" | "stress" | "water" | "exercise_hours";
      return (
        <AnchoredScaleField
          label={field.label}
          options={field.type === "number" ? [] : field.options}
          value={answers[uKey]}
          onChange={(v) => onUniversal(uKey, v)}
        />
      );
    }
    if (field.key === "nutrition" || field.key === "supplements") {
      const mKey = field.key as "nutrition" | "supplements";
      const mField = field as Extract<FieldDef, { type: "multi" | "autocomplete_multi" }>;
      if (field.type === "autocomplete_multi") {
        return (
          <AutocompleteMultiField
            label={field.label}
            vocabulary={mField.vocabulary ?? mField.options}
            value={answers[mKey]}
            onChange={(v) => onUniversalMulti(mKey, v)}
            noneKey={mField.noneKey}
          />
        );
      }
      return (
        <MultiSelectField
          label={field.label}
          options={mField.options}
          value={answers[mKey]}
          onChange={(v) => onUniversalMulti(mKey, v)}
          noneKey={mField.noneKey}
        />
      );
    }
    if (field.type === "number") {
      const v = answers.concernSpecific[field.key];
      return (
        <NumberField
          label={field.label}
          unit={field.unit}
          value={typeof v === "number" ? v : null}
          onChange={(n) => onConcern(field.key, n)}
        />
      );
    }
    if (field.type === "multi" || field.type === "autocomplete_multi") {
      const v = answers.concernSpecific[field.key];
      const arr = Array.isArray(v) ? v : [];
      if (field.type === "autocomplete_multi") {
        return (
          <AutocompleteMultiField
            label={field.label}
            vocabulary={field.vocabulary ?? field.options}
            value={arr}
            onChange={(next) => onConcern(field.key, next)}
            noneKey={field.noneKey}
          />
        );
      }
      return (
        <MultiSelectField
          label={field.label}
          options={field.options}
          value={arr}
          onChange={(next) => onConcern(field.key, next)}
          noneKey={field.noneKey}
        />
      );
    }
    const v = answers.concernSpecific[field.key];
    const Comp = field.type === "anchored" ? AnchoredScaleField : SingleSelectField;
    return (
      <Comp
        label={field.label}
        options={field.options}
        value={typeof v === "string" ? v : null}
        onChange={(next) => onConcern(field.key, next)}
      />
    );
  })();

  if (field.conditional === "cycle_phase") {
    return <ConditionalField condition={showCycle}>{inner}</ConditionalField>;
  }
  return inner;
}
