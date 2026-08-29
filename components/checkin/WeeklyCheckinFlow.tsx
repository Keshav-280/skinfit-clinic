"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
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

const easeOut = [0.22, 1, 0.36, 1] as const;

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
    return (
      <CheckinCompletion
        weekYmd={weekYmd}
        concern={concern}
        lines={summaryLines(answers)}
        onEdit={() => {
          setMode("form");
          setStep(0);
        }}
        onBackToMaintain={() => router.push("/dashboard/schedules")}
      />
    );
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={step}
        initial={{ opacity: 0, x: dir === "forward" ? 24 : -24 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: dir === "forward" ? -60 : 60 }}
        transition={{ duration: 0.28, ease: easeOut }}
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
            <p className="text-[13px] text-red-600">{error}</p>
          ) : null}
        </CheckinScreen>
      </motion.div>
    </AnimatePresence>
  );
}

/** UPI-style success animation — big centered tick, then shrinks and docks
 * to the top before revealing the summary + next-step buttons. */
function CheckinCompletion({
  weekYmd,
  concern,
  lines,
  onEdit,
  onBackToMaintain,
}: {
  weekYmd: string;
  concern: CheckinConcernPath;
  lines: Array<{ label: string; value: string }>;
  onEdit: () => void;
  onBackToMaintain: () => void;
}) {
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setSettled(true), 1500);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center px-6"
      animate={{ backgroundColor: settled ? "#FAF8F5" : "#1E1B31" }}
      transition={{ duration: 0.6, ease: easeOut }}
    >
      <div
        className={`flex w-full flex-1 flex-col items-center ${
          settled ? "justify-start pt-16" : "justify-center"
        }`}
      >
        <motion.div
          layout
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{
            layout: { duration: 0.6, ease: easeOut },
            scale: { type: "spring", stiffness: 260, damping: 18 },
            opacity: { duration: 0.25 },
          }}
          className={`flex items-center justify-center rounded-full bg-white shadow-xl ${
            settled ? "h-16 w-16" : "h-28 w-28"
          }`}
        >
          <svg
            width={settled ? 28 : 48}
            height={settled ? 28 : 48}
            viewBox="0 0 52 52"
            fill="none"
          >
            <motion.path
              d="M14 27l7 7 17-17"
              stroke="#1E1B31"
              strokeWidth={5}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.45, delay: 0.35, ease: "easeOut" }}
            />
          </svg>
        </motion.div>

        {!settled ? (
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.55, ease: easeOut }}
            className="mt-6 text-lg font-bold text-white"
          >
            Check-in complete
          </motion.p>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.15, ease: easeOut }}
            className="mt-6 text-center"
          >
            <h1 className="text-2xl font-extrabold text-[#18181b]">
              You&apos;re all set!
            </h1>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-[#6B7280]">
              Week of {weekYmd} · {CONCERN_PATH_LABELS[concern]} path. kAI can
              now read your next scan in context.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-2">
              {lines.map((l) => (
                <div
                  key={l.label}
                  className="rounded-xl border border-[#E5E7EB] bg-white px-3.5 py-3 text-left"
                >
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[#6B7280]">
                    {l.label}
                  </p>
                  <p className="mt-0.5 text-sm font-semibold capitalize text-[#18181b]">
                    {l.value}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {settled ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.3, ease: easeOut }}
          className="mb-8 flex w-full max-w-md flex-col gap-3"
        >
          <button
            type="button"
            onClick={onBackToMaintain}
            className="w-full rounded-2xl bg-[#1E1B31] py-4 text-center text-[15px] font-bold text-white transition hover:bg-[#242A5F]"
          >
            Back to Maintain
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="w-full rounded-2xl border border-[#1E1B31]/25 bg-white py-4 text-center text-[15px] font-bold text-[#1E1B31] transition hover:bg-[#1E1B31]/5"
          >
            Edit answers
          </button>
        </motion.div>
      ) : null}
    </motion.div>
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
