"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  ONBOARDING_QUESTIONNAIRE_DRAFT_KEY,
  ONBOARDING_QUESTIONNAIRE_DRAFT_SCHEMA,
  type OnboardingQuestionnaireDraftV2,
} from "@/src/lib/onboardingQuestionnaireDraft";
import {
  ONBOARDING_AGE_OPTIONS,
  parseOnboardingAge,
} from "@/src/lib/onboardingAgeOptions";
import {
  applyOnboardingStepSkip,
  buildOnboardingQuestionnairePayload,
  type BaselineDietType,
  type BaselineHydration,
  type BaselineSleep,
  type BaselineSunExposure,
  type ConcernDuration,
  type ConcernSeverity,
  type OnboardingQuestionnaireFormState,
  type SkinSensitivity,
} from "@/src/lib/onboardingQuestionnaireDefaults";
import {
  REFERRAL_SOURCE_OPTIONS,
  type ReferralSourceId,
} from "@/src/lib/onboardingReferralSource";

const GENDER_OPTIONS: { value: string; label: string }[] = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "other", label: "Other" },
  { value: "prefer_not_say", label: "Prefer not to say" },
];

type Concern = "acne" | "pigmentation" | "ageing" | "hair" | "general";

const VALID_CONCERN = new Set<string>([
  "acne",
  "pigmentation",
  "ageing",
  "hair",
  "general",
]);

const CONCERNS: { id: Concern; label: string }[] = [
  { id: "acne", label: "Acne & breakouts" },
  { id: "pigmentation", label: "Pigmentation & dark spots" },
  { id: "ageing", label: "Ageing & wrinkles" },
  { id: "hair", label: "Hair loss & scalp" },
  { id: "general", label: "General skin health" },
];

const TRIGGERS: { id: string; label: string }[] = [
  { id: "hormonal", label: "Hormonal (cycle, PCOS, pregnancy)" },
  { id: "diet", label: "Diet" },
  { id: "stress", label: "Stress & poor sleep" },
  { id: "environmental", label: "Environment (sun, pollution, humidity)" },
  { id: "products", label: "Products or ingredients" },
  { id: "unsure", label: "I'm not sure" },
];
const SKIN_TYPES = [
  "Dry",
  "Oily",
  "Combination",
  "Normal",
  "Sensitive",
] as const;

/** Visible step index / total (skips treatment-detail step when prior treatment = no). */
function questionnaireProgress(
  step: number,
  priorTx: "yes" | "no" | null
): { displayStep: number; totalSteps: number } {
  if (priorTx === "yes") {
    return { displayStep: step + 1, totalSteps: 12 };
  }
  if (priorTx === "no") {
    const order = [0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11];
    const ix = order.indexOf(step);
    return {
      displayStep: ix >= 0 ? ix + 1 : step + 1,
      totalSteps: 11,
    };
  }
  return { displayStep: step + 1, totalSteps: 12 };
}

function copyForConcern(
  concern: Concern | null,
  q: "sevTitle" | "sevA" | "sevB" | "sevC" | "durTitle" | "trigTitle"
) {
  const map: Record<Concern, Record<string, string>> = {
    acne: {
      sevTitle: "How bad are your breakouts?",
      sevA: "A few pimples occasionally",
      sevB: "Frequent breakouts, some scarring",
      sevC: "Cystic or painful acne constantly",
      durTitle: "How long have you had breakouts?",
      trigTitle: "What triggers your breakouts?",
    },
    pigmentation: {
      sevTitle: "How noticeable is the uneven tone?",
      sevA: "Slight patchiness I can see",
      sevB: "Visible patches or spots in photos",
      sevC: "Dark patches covering large areas",
      durTitle: "How long have you had pigmentation?",
      trigTitle: "What worsens your pigmentation?",
    },
    ageing: {
      sevTitle: "How visible are the signs of ageing?",
      sevA: "Fine lines only visible up close",
      sevB: "Wrinkles visible at rest, some sagging",
      sevC: "Deep wrinkles, significant volume loss",
      durTitle: "When did you first notice these signs?",
      trigTitle: "What accelerates ageing for you?",
    },
    hair: {
      sevTitle: "How significant is the hair loss?",
      sevA: "Slight thinning, mostly in parting",
      sevB: "Noticeable thinning or hairline recession",
      sevC: "Significant bald patches or rapid loss",
      durTitle: "When did you notice hair loss starting?",
      trigTitle: "What do you think causes your hair loss?",
    },
    general: {
      sevTitle: "How would you rate your overall skin health?",
      sevA: "Minor concerns, maintenance",
      sevB: "Several concerns, want to improve",
      sevC: "Multiple ongoing concerns",
      durTitle: "How long have you had these concerns?",
      trigTitle: "What affects your skin most?",
    },
  };
  const c = concern ?? "general";
  return map[c][q] ?? map.general[q];
}

export function OnboardingQuestionnaireForm() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [concern, setConcern] = useState<Concern | null>(null);
  const [severity, setSeverity] = useState<ConcernSeverity | null>(null);
  const [duration, setDuration] = useState<ConcernDuration | null>(null);
  const [triggers, setTriggers] = useState<string[]>([]);
  const [priorTx, setPriorTx] = useState<"yes" | "no" | null>(null);
  const [txText, setTxText] = useState("");
  const [txDur, setTxDur] = useState("");
  const [sensitivity, setSensitivity] = useState<SkinSensitivity | null>(null);
  const [sleep, setSleep] = useState<BaselineSleep | null>(null);
  const [water, setWater] = useState<BaselineHydration | null>(null);
  const [diet, setDiet] = useState<BaselineDietType | null>(null);
  const [sun, setSun] = useState<BaselineSunExposure | null>(null);
  const [skinType, setSkinType] = useState<(typeof SKIN_TYPES)[number] | null>(null);
  const [ageInput, setAgeInput] = useState("");
  const [gender, setGender] = useState<string | null>(null);
  const [referralSource, setReferralSource] = useState<ReferralSourceId | null>(
    null
  );
  const [referralOther, setReferralOther] = useState("");
  const [draftReady, setDraftReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ONBOARDING_QUESTIONNAIRE_DRAFT_KEY);
      if (!raw) {
        setDraftReady(true);
        return;
      }
      const d = JSON.parse(raw) as OnboardingQuestionnaireDraftV2;
      if (d.v !== ONBOARDING_QUESTIONNAIRE_DRAFT_SCHEMA) {
        setDraftReady(true);
        return;
      }
      if (typeof d.step === "number" && d.step >= 0 && d.step <= 11) {
        setStep(d.step);
      }
      if (typeof d.ageInput === "string") setAgeInput(d.ageInput);
      if (
        d.gender === "female" ||
        d.gender === "male" ||
        d.gender === "other" ||
        d.gender === "prefer_not_say"
      ) {
        setGender(d.gender);
      }
      if (d.concern && VALID_CONCERN.has(d.concern)) {
        setConcern(d.concern as Concern);
      }
      if (d.severity === "mild" || d.severity === "moderate" || d.severity === "severe") {
        setSeverity(d.severity);
      }
      if (d.duration === "recent" || d.duration === "ongoing" || d.duration === "chronic") {
        setDuration(d.duration);
      }
      if (Array.isArray(d.triggers)) setTriggers(d.triggers);
      if (d.priorTx === "yes" || d.priorTx === "no") setPriorTx(d.priorTx);
      if (typeof d.txText === "string") setTxText(d.txText);
      if (typeof d.txDur === "string") setTxDur(d.txDur);
      if (d.sensitivity === "low" || d.sensitivity === "moderate" || d.sensitivity === "high") {
        setSensitivity(d.sensitivity);
      }
      if (
        d.sleep === "under5" ||
        d.sleep === "5to6" ||
        d.sleep === "7to8" ||
        d.sleep === "8plus"
      ) {
        setSleep(d.sleep);
      }
      if (
        d.water === "under1l" ||
        d.water === "1to1_5l" ||
        d.water === "1_5to2l" ||
        d.water === "2lplus"
      ) {
        setWater(d.water);
      }
      if (
        d.diet === "vegetarian" ||
        d.diet === "vegan" ||
        d.diet === "nonveg" ||
        d.diet === "mixed"
      ) {
        setDiet(d.diet);
      }
      if (
        d.sun === "minimal" ||
        d.sun === "low" ||
        d.sun === "moderate" ||
        d.sun === "high"
      ) {
        setSun(d.sun);
      }
      if (
        typeof d.skinType === "string" &&
        (SKIN_TYPES as readonly string[]).includes(d.skinType)
      ) {
        setSkinType(d.skinType as (typeof SKIN_TYPES)[number]);
      }
      if (
        typeof d.referralSource === "string" &&
        REFERRAL_SOURCE_OPTIONS.some((o) => o.id === d.referralSource)
      ) {
        setReferralSource(d.referralSource as ReferralSourceId);
      }
      if (typeof d.referralOther === "string") setReferralOther(d.referralOther);
    } catch {
      /* ignore */
    } finally {
      setDraftReady(true);
    }
  }, []);

  useEffect(() => {
    if (!draftReady) return;
    const t = window.setTimeout(() => {
      try {
        const draft: OnboardingQuestionnaireDraftV2 = {
          v: ONBOARDING_QUESTIONNAIRE_DRAFT_SCHEMA,
          step,
          ageInput,
          gender,
          concern,
          severity,
          duration,
          triggers,
          priorTx,
          txText,
          txDur,
          sensitivity,
          sleep,
          water,
          diet,
          sun,
          skinType,
          referralSource,
          referralOther,
        };
        localStorage.setItem(
          ONBOARDING_QUESTIONNAIRE_DRAFT_KEY,
          JSON.stringify(draft)
        );
      } catch {
        /* quota / private mode */
      }
    }, 450);
    return () => clearTimeout(t);
  }, [
    draftReady,
    step,
    concern,
    severity,
    duration,
    triggers,
    priorTx,
    txText,
    txDur,
    sensitivity,
    sleep,
    water,
    diet,
    sun,
    skinType,
    ageInput,
    gender,
    referralSource,
    referralOther,
  ]);

  const toggleTrigger = (id: string) => {
    setTriggers((t) =>
      t.includes(id) ? t.filter((x) => x !== id) : [...t, id]
    );
  };

  const canNext = useMemo(() => {
    switch (step) {
      case 0:
        return parseOnboardingAge(ageInput) != null && gender != null;
      case 1:
        return concern != null;
      case 2:
        return severity != null;
      case 3:
        return duration != null;
      case 4:
        return triggers.length > 0;
      case 5:
        return priorTx != null;
      case 6:
        if (priorTx !== "yes") return true;
        return txText.trim().length >= 10 && txDur.trim().length > 0;
      case 7:
        return sensitivity != null;
      case 8:
        return sleep != null;
      case 9:
        return water != null && diet != null && sun != null;
      case 10:
        return skinType != null;
      case 11:
        if (referralSource == null) return false;
        if (referralSource === "other") return referralOther.trim().length >= 3;
        return true;
      default:
        return false;
    }
  }, [
    step,
    ageInput,
    gender,
    concern,
    severity,
    duration,
    triggers,
    priorTx,
    txText,
    txDur,
    sensitivity,
    sleep,
    water,
    diet,
    sun,
    skinType,
    referralSource,
    referralOther,
  ]);

  const { displayStep, totalSteps } = questionnaireProgress(step, priorTx);

  function formState(): OnboardingQuestionnaireFormState {
    return {
      ageInput,
      gender,
      concern,
      severity,
      duration,
      triggers,
      priorTx,
      txText,
      txDur,
      sensitivity,
      sleep,
      water,
      diet,
      sun,
      skinType,
      referralSource,
      referralOther,
    };
  }

  function applySkipPatch(patch: Partial<OnboardingQuestionnaireFormState>) {
    if (patch.ageInput !== undefined) setAgeInput(patch.ageInput);
    if (patch.gender !== undefined) setGender(patch.gender);
    if (patch.concern !== undefined) setConcern(patch.concern as Concern);
    if (patch.severity !== undefined) setSeverity(patch.severity);
    if (patch.duration !== undefined) setDuration(patch.duration);
    if (patch.triggers !== undefined) setTriggers(patch.triggers);
    if (patch.priorTx !== undefined) setPriorTx(patch.priorTx);
    if (patch.txText !== undefined) setTxText(patch.txText);
    if (patch.txDur !== undefined) setTxDur(patch.txDur);
    if (patch.sensitivity !== undefined) setSensitivity(patch.sensitivity);
    if (patch.sleep !== undefined) setSleep(patch.sleep);
    if (patch.water !== undefined) setWater(patch.water);
    if (patch.diet !== undefined) setDiet(patch.diet);
    if (patch.sun !== undefined) setSun(patch.sun);
    if (patch.skinType !== undefined) {
      setSkinType(patch.skinType as (typeof SKIN_TYPES)[number]);
    }
    if (patch.referralSource !== undefined) setReferralSource(patch.referralSource);
    if (patch.referralOther !== undefined) setReferralOther(patch.referralOther);
  }

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/onboarding/questionnaire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildOnboardingQuestionnairePayload(formState())),
      });
      const data = (await res.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
      };
      if (!res.ok) {
        setErr(
          typeof data.message === "string"
            ? data.message
            : "Could not save questionnaire."
        );
        return;
      }
      try {
        localStorage.removeItem(ONBOARDING_QUESTIONNAIRE_DRAFT_KEY);
      } catch {
        /* */
      }
      const resumeRes = await fetch("/api/onboarding/resume", {
        credentials: "include",
      });
      const resume = (await resumeRes.json().catch(() => ({}))) as {
        hasBaselineScan?: boolean;
        baselineScanPending?: boolean;
      };
      if (resume.hasBaselineScan || resume.baselineScanPending) {
        router.push("/dashboard");
        router.refresh();
      } else {
        router.push("/onboarding/capture");
      }
    } catch {
      setErr("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function next() {
    if (step === 11) {
      void submit();
      return;
    }
    if (step === 5 && priorTx === "no") {
      setStep(7);
      return;
    }
    setStep((s) => s + 1);
  }

  function skip() {
    applySkipPatch(applyOnboardingStepSkip(step));
    next();
  }

  function back() {
    if (step <= 0) {
      router.back();
      return;
    }
    if (step === 7 && priorTx === "no") {
      setStep(5);
      return;
    }
    setStep((s) => s - 1);
  }

  const chip = (active: boolean) =>
    `w-full rounded-2xl border px-4 py-3.5 text-left text-[15px] font-semibold transition-colors ${
      active
        ? "border-skinfit-navy bg-skinfit-mint text-skinfit-navy"
        : "border-zinc-200 bg-white text-zinc-800 hover:border-zinc-300"
    }`;

  return (
    <div className="space-y-4">
      <p className="text-xs font-bold text-skinfit-navy">
        Step {displayStep} / {totalSteps}
      </p>
      {err ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {err}
        </div>
      ) : null}

      {step === 0 ? (
        <>
          <h2 className="text-lg font-bold text-zinc-900">About you</h2>
          <p className="text-sm text-zinc-500">Age (years)</p>
          <select
            autoComplete="bday-year"
            className="mb-4 w-full appearance-none rounded-xl border border-zinc-200 bg-white bg-[length:1rem] bg-[right_0.75rem_center] bg-no-repeat px-3 py-3 text-[15px] text-zinc-900 outline-none focus:border-skinfit-navy focus:ring-2 focus:ring-skinfit-navy/20"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' viewBox='0 0 24 24' stroke='%2371717a'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E\")",
            }}
            value={ageInput}
            onChange={(e) => setAgeInput(e.target.value)}
          >
            <option value="">Select age</option>
            {ONBOARDING_AGE_OPTIONS.map((age) => (
              <option key={age} value={String(age)}>
                {age}
              </option>
            ))}
          </select>
          <p className="text-sm font-semibold text-zinc-600">Gender</p>
          <div className="mt-2 space-y-2">
            {GENDER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={chip(gender === opt.value)}
                onClick={() => setGender(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      ) : null}

      {step === 1 ? (
        <>
          <h2 className="text-lg font-bold text-zinc-900">
            What brings you to SkinFit today?
          </h2>
          <div className="space-y-2">
            {CONCERNS.map((c) => (
              <button
                key={c.id}
                type="button"
                className={chip(concern === c.id)}
                onClick={() => setConcern(c.id)}
              >
                {c.label}
              </button>
            ))}
          </div>
        </>
      ) : null}

      {step === 2 ? (
        <>
          <h2 className="text-lg font-bold text-zinc-900">
            {concern
              ? copyForConcern(concern, "sevTitle")
              : "How would you rate severity for your main concern?"}
          </h2>
          <div className="space-y-2">
            {(
              [
                ["mild", copyForConcern(concern ?? "general", "sevA")],
                ["moderate", copyForConcern(concern ?? "general", "sevB")],
                ["severe", copyForConcern(concern ?? "general", "sevC")],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={chip(severity === id)}
                onClick={() => setSeverity(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      ) : null}

      {step === 3 ? (
        <>
          <h2 className="text-lg font-bold text-zinc-900">
            {copyForConcern(concern, "durTitle")}
          </h2>
          <div className="space-y-2">
            {(
              [
                ["recent", "Recent — under 3 months"],
                ["ongoing", "Ongoing — 3 months to 1 year"],
                ["chronic", "Chronic — over 1 year"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={chip(duration === id)}
                onClick={() => setDuration(id)}
              >
                {label}
              </button>
            ))}
            {duration === "chronic" ? (
              <p className="text-sm font-medium text-rose-800">
                Chronic concern flags your kAI report and alerts your clinician.
              </p>
            ) : null}
          </div>
        </>
      ) : null}

      {step === 4 ? (
        <>
          <h2 className="text-lg font-bold text-zinc-900">
            {copyForConcern(concern, "trigTitle")}
          </h2>
          <p className="text-sm text-zinc-500">Select all that apply.</p>
          <div className="space-y-2">
            {TRIGGERS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={chip(triggers.includes(t.id))}
                onClick={() => toggleTrigger(t.id)}
              >
                {t.label}
              </button>
            ))}
            {triggers.includes("unsure") ? (
              <p className="text-sm text-zinc-600">
                kAI will identify patterns from journal data.
              </p>
            ) : null}
          </div>
        </>
      ) : null}

      {step === 5 ? (
        <>
          <h2 className="text-lg font-bold text-zinc-900">
            Have you tried treating this before?
          </h2>
          <div className="space-y-2">
            {(
              [
                ["yes", "Yes — I've tried treatments or seen a doctor"],
                ["no", "No — first time seeking proper treatment"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={chip(priorTx === id)}
                onClick={() => setPriorTx(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      ) : null}

      {step === 6 && priorTx === "yes" ? (
        <>
          <h2 className="text-lg font-bold text-zinc-900">
            What have you tried so far? For how long?
          </h2>
          <textarea
            className="min-h-[100px] w-full rounded-xl border border-zinc-200 bg-white p-3 text-[15px] text-zinc-900 outline-none focus:border-skinfit-navy focus:ring-2 focus:ring-skinfit-navy/20"
            placeholder="Describe treatments or products (min 10 characters)"
            value={txText}
            onChange={(e) => setTxText(e.target.value)}
          />
          {txText.trim().length > 0 && txText.trim().length < 10 ? (
            <p className="text-sm font-medium text-amber-800">
              Add a little more detail (at least 10 characters).
            </p>
          ) : null}
          <p className="text-sm font-semibold text-zinc-600">Duration</p>
          <div className="space-y-2">
            {(
              [
                ["under1m", "Under 1 month"],
                ["1to3m", "1–3 months"],
                ["3to6m", "3–6 months"],
                ["6to12m", "6–12 months"],
                ["over1y", "Over 1 year"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={chip(txDur === id)}
                onClick={() => setTxDur(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      ) : null}

      {step === 7 ? (
        <>
          <h2 className="text-lg font-bold text-zinc-900">
            How would you describe your skin&apos;s sensitivity?
          </h2>
          <div className="space-y-2">
            {(
              [
                ["low", "Low — rarely reacts"],
                ["moderate", "Moderate — occasional irritation"],
                ["high", "High — frequent redness or reactions"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={chip(sensitivity === id)}
                onClick={() => setSensitivity(id)}
              >
                {label}
              </button>
            ))}
            {sensitivity === "high" ? (
              <p className="text-sm font-medium text-rose-800">
                High sensitivity flags your kAI report and alerts your clinician to review product
                prescriptions.
              </p>
            ) : null}
          </div>
        </>
      ) : null}

      {step === 8 ? (
        <>
          <h2 className="text-lg font-bold text-zinc-900">
            How&apos;s your sleep most nights?
          </h2>
          <div className="space-y-2">
            {(
              [
                ["under5", "Under 5 hours"],
                ["5to6", "5–6 hours"],
                ["7to8", "7–8 hours"],
                ["8plus", "8+ hours"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={chip(sleep === id)}
                onClick={() => setSleep(id)}
              >
                {label}
              </button>
            ))}
            {sleep === "under5" ? (
              <p className="mt-2 text-sm text-zinc-600">
                Poor sleep is linked to elevated cortisol and skin inflammation — this will appear
                on your kAI report.
              </p>
            ) : null}
          </div>
        </>
      ) : null}

      {step === 9 ? (
        <>
          <h2 className="text-lg font-bold text-zinc-900">
            Lifestyle snapshot
          </h2>
          <p className="text-sm text-zinc-500">Daily water intake</p>
          <div className="space-y-2">
            {(
              [
                ["under1l", "Under 1L"],
                ["1to1_5l", "1–1.5L"],
                ["1_5to2l", "1.5–2L"],
                ["2lplus", "2L+"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={chip(water === id)}
                onClick={() => setWater(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-sm font-semibold text-zinc-600">Diet type</p>
          <div className="space-y-2">
            {(
              [
                ["vegetarian", "Vegetarian"],
                ["vegan", "Vegan"],
                ["nonveg", "Non-vegetarian"],
                ["mixed", "Mixed"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={chip(diet === id)}
                onClick={() => setDiet(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-sm font-semibold text-zinc-600">
            Typical sun exposure
          </p>
          <div className="space-y-2">
            {(
              [
                ["minimal", "Minimal (mostly indoors)"],
                ["low", "Low (~30 min)"],
                ["moderate", "Moderate (1–2 hrs)"],
                ["high", "High (2+ hrs)"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={chip(sun === id)}
                onClick={() => setSun(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      ) : null}

      {step === 10 ? (
        <>
          <h2 className="text-lg font-bold text-zinc-900">
            How would you describe your skin type?
          </h2>
          <div className="space-y-2">
            {SKIN_TYPES.map((v) => (
              <button
                key={v}
                type="button"
                className={chip(skinType === v)}
                onClick={() => setSkinType(v)}
              >
                {v}
              </button>
            ))}
          </div>
        </>
      ) : null}

      {step === 11 ? (
        <>
          <h2 className="text-lg font-bold text-zinc-900">
            How did you hear about SkinFit Wellness?
          </h2>
          <p className="text-sm text-zinc-500">
            This helps us understand what brought you here.
          </p>
          <div className="mt-2 space-y-2">
            {REFERRAL_SOURCE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={chip(referralSource === opt.id)}
                onClick={() => setReferralSource(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {referralSource === "other" ? (
            <input
              type="text"
              className="mt-3 w-full rounded-xl border border-zinc-200 bg-white px-3 py-3 text-[15px] text-zinc-900 outline-none focus:border-skinfit-navy focus:ring-2 focus:ring-skinfit-navy/20"
              placeholder="Please specify (min 3 characters)"
              value={referralOther}
              onChange={(e) => setReferralOther(e.target.value)}
            />
          ) : null}
        </>
      ) : null}

      <div className="pt-4">
        <button
          type="button"
          onClick={skip}
          disabled={busy}
          className="mb-3 w-full py-2 text-center text-sm font-semibold text-zinc-500 transition-colors hover:text-skinfit-navy disabled:opacity-50"
        >
          Skip this question
        </button>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={back}
            disabled={busy}
            className="flex-1 rounded-2xl border-2 border-skinfit-navy py-3.5 text-center text-[15px] font-bold text-skinfit-navy transition-colors hover:bg-white/60 disabled:opacity-50"
          >
            Back
          </button>
          <button
            type="button"
            onClick={next}
            disabled={!canNext || busy}
            className="flex-1 rounded-2xl bg-skinfit-navy py-3.5 text-center text-[15px] font-bold text-white shadow-md shadow-skinfit-navy/25 transition-colors hover:bg-skinfit-navy-mid disabled:cursor-not-allowed disabled:opacity-45"
          >
            {busy ? "Saving…" : step === 11 ? "Save & continue" : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
