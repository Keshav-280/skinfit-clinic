"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  applyOnboardingQuestionnaireDraft,
  buildOnboardingQuestionnaireDraft,
  mergeOnboardingQuestionnaireDrafts,
  ONBOARDING_QUESTIONNAIRE_DRAFT_KEY,
  parseOnboardingQuestionnaireDraft,
  type OnboardingQuestionnaireDraftV2,
} from "@/src/lib/onboardingQuestionnaireDraft";
import {
  ONBOARDING_AGE_OPTIONS,
  parseOnboardingAge,
} from "@/src/lib/onboardingAgeOptions";
import {
  buildOnboardingQuestionnairePayload,
  expandSkippedStepsForSkip,
  mergeOnboardingStepSkipPatches,
  reconcileSkippedSteps,
  nextOnboardingQuestionnaireStep,
  nextOnboardingQuestionnaireStepAfterSkip,
  normalizeOnboardingQuestionnaireStep,
  prevOnboardingQuestionnaireStep,
  questionnaireProgress,
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
      sevTitle: "What best describes your skin goals?",
      sevA: "Maintenance",
      sevB: "Need to improve",
      sevC: "Ongoing concerns",
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
  const [skippedSteps, setSkippedSteps] = useState<number[]>([]);
  const [draftReady, setDraftReady] = useState(false);
  const draftReadyRef = useRef(false);
  const hydratingRef = useRef(true);

  const fieldsRef = useRef({
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
    skippedSteps,
  });
  fieldsRef.current = {
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
    skippedSteps,
  };

  useEffect(() => {
    const normalized = normalizeOnboardingQuestionnaireStep(step, priorTx);
    if (normalized !== step) setStep(normalized);
    if (priorTx === "no" && (txText || txDur)) {
      setTxText("");
      setTxDur("");
    }
  }, [step, priorTx, txText, txDur]);

  function draftSetters() {
    return {
      setStep,
      setAgeInput,
      setGender,
      setConcern: (value: string | null) =>
        setConcern(value && VALID_CONCERN.has(value) ? (value as Concern) : null),
      setSeverity: (value: string | null) =>
        setSeverity(
          value === "mild" || value === "moderate" || value === "severe"
            ? value
            : null
        ),
      setDuration: (value: string | null) =>
        setDuration(
          value === "recent" || value === "ongoing" || value === "chronic"
            ? value
            : null
        ),
      setTriggers,
      setPriorTx: (value: string | null) =>
        setPriorTx(value === "yes" || value === "no" ? value : null),
      setTxText,
      setTxDur,
      setSensitivity: (value: string | null) =>
        setSensitivity(
          value === "low" || value === "moderate" || value === "high"
            ? value
            : null
        ),
      setSleep: (value: string | null) =>
        setSleep(
          value === "under5" ||
            value === "5to6" ||
            value === "7to8" ||
            value === "8plus"
            ? value
            : null
        ),
      setWater: (value: string | null) =>
        setWater(
          value === "under1l" ||
            value === "1to1_5l" ||
            value === "1_5to2l" ||
            value === "2lplus"
            ? value
            : null
        ),
      setDiet: (value: string | null) =>
        setDiet(
          value === "vegetarian" ||
            value === "vegan" ||
            value === "nonveg" ||
            value === "mixed"
            ? value
            : null
        ),
      setSun: (value: string | null) =>
        setSun(
          value === "minimal" ||
            value === "low" ||
            value === "moderate" ||
            value === "high"
            ? value
            : null
        ),
      setSkinType: (value: string | null) =>
        setSkinType(
          value && (SKIN_TYPES as readonly string[]).includes(value)
            ? (value as (typeof SKIN_TYPES)[number])
            : null
        ),
      setReferralSource: (value: string | null) =>
        setReferralSource(
          value && REFERRAL_SOURCE_OPTIONS.some((o) => o.id === value)
            ? (value as ReferralSourceId)
            : null
        ),
      setReferralOther,
      setSkippedSteps,
    };
  }

  function persistDraft(
    stepOverride?: number,
    patch: Partial<OnboardingQuestionnaireDraftV2> = {},
    skippedOverride?: number[]
  ) {
    const base = fieldsRef.current;
    const draft = buildOnboardingQuestionnaireDraft({
      step: stepOverride ?? patch.step ?? base.step,
      ageInput: patch.ageInput ?? base.ageInput,
      gender: patch.gender !== undefined ? patch.gender : base.gender,
      concern: patch.concern !== undefined ? patch.concern : base.concern,
      severity: patch.severity !== undefined ? patch.severity : base.severity,
      duration: patch.duration !== undefined ? patch.duration : base.duration,
      triggers: patch.triggers ?? base.triggers,
      priorTx: patch.priorTx !== undefined ? patch.priorTx : base.priorTx,
      txText: patch.txText ?? base.txText,
      txDur: patch.txDur ?? base.txDur,
      sensitivity:
        patch.sensitivity !== undefined ? patch.sensitivity : base.sensitivity,
      sleep: patch.sleep !== undefined ? patch.sleep : base.sleep,
      water: patch.water !== undefined ? patch.water : base.water,
      diet: patch.diet !== undefined ? patch.diet : base.diet,
      sun: patch.sun !== undefined ? patch.sun : base.sun,
      skinType: patch.skinType !== undefined ? patch.skinType : base.skinType,
      referralSource:
        patch.referralSource !== undefined
          ? patch.referralSource
          : base.referralSource,
      referralOther: patch.referralOther ?? base.referralOther,
      skippedSteps: skippedOverride ?? patch.skippedSteps ?? base.skippedSteps,
    });
    try {
      localStorage.setItem(ONBOARDING_QUESTIONNAIRE_DRAFT_KEY, JSON.stringify(draft));
    } catch {
      /* quota / private mode */
    }
    void fetch("/api/onboarding/questionnaire/draft", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({ draft }),
    }).catch(() => {
      /* offline */
    });
  }

  function saveAnswer(patch: Partial<OnboardingQuestionnaireDraftV2>) {
    persistDraft(undefined, patch);
  }

  useEffect(() => {
    let cancelled = false;

    (async () => {
      let localDraft: OnboardingQuestionnaireDraftV2 | null = null;
      try {
        const raw = localStorage.getItem(ONBOARDING_QUESTIONNAIRE_DRAFT_KEY);
        if (raw) {
          localDraft = parseOnboardingQuestionnaireDraft(JSON.parse(raw));
        }
      } catch {
        /* ignore */
      }

      let serverDraft: OnboardingQuestionnaireDraftV2 | null = null;
      try {
        const res = await fetch("/api/onboarding/questionnaire/draft", {
          credentials: "include",
        });
        if (res.ok) {
          const data = (await res.json()) as { draft?: unknown };
          serverDraft = parseOnboardingQuestionnaireDraft(data.draft ?? null);
        }
      } catch {
        /* offline */
      }

      if (cancelled) return;

      const merged = mergeOnboardingQuestionnaireDrafts(localDraft, serverDraft);
      if (merged) {
        merged.skippedSteps = reconcileSkippedSteps(merged.skippedSteps ?? []);
        applyOnboardingQuestionnaireDraft(merged, draftSetters());
        try {
          localStorage.setItem(
            ONBOARDING_QUESTIONNAIRE_DRAFT_KEY,
            JSON.stringify(merged)
          );
        } catch {
          /* */
        }
      }

      hydratingRef.current = false;
      draftReadyRef.current = true;
      setDraftReady(true);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount
  }, []);

  useEffect(() => {
    if (!draftReady || hydratingRef.current) return;
    const t = window.setTimeout(() => persistDraft(), 400);
    return () => {
      clearTimeout(t);
      if (draftReadyRef.current) persistDraft();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- persist when form fields change
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
    skippedSteps,
  ]);

  const toggleTrigger = (id: string) => {
    setTriggers((t) => {
      const next = t.includes(id) ? t.filter((x) => x !== id) : [...t, id];
      saveAnswer({ triggers: next });
      return next;
    });
  };

  const activeStep = normalizeOnboardingQuestionnaireStep(step, priorTx);

  const canNext = useMemo(() => {
    switch (activeStep) {
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
    activeStep,
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

  const { displayStep, totalSteps } = questionnaireProgress(activeStep, priorTx);

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
        body: JSON.stringify(
          buildOnboardingQuestionnairePayload(formState(), { skippedSteps })
        ),
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
      void fetch("/api/onboarding/questionnaire/draft", {
        method: "DELETE",
      }).catch(() => {
        /* */
      });
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setErr("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function next() {
    if (activeStep === 11) {
      void submit();
      return;
    }
    const nextStep = nextOnboardingQuestionnaireStep(activeStep, priorTx);
    setStep(nextStep);
    persistDraft(nextStep);
  }

  function skip() {
    if (activeStep === 11) {
      void submit();
      return;
    }
    const patch = mergeOnboardingStepSkipPatches(activeStep);
    const nextSkipped = expandSkippedStepsForSkip(activeStep, skippedSteps);
    setSkippedSteps(nextSkipped);
    applySkipPatch(patch);
    const effectivePriorTx =
      patch.priorTx === "yes" || patch.priorTx === "no" ? patch.priorTx : priorTx;
    const nextStep = nextOnboardingQuestionnaireStepAfterSkip(
      activeStep,
      effectivePriorTx,
      patch
    );
    setStep(nextStep);
    persistDraft(nextStep, patch, nextSkipped);
  }

  function back() {
    if (activeStep <= 0) {
      router.back();
      return;
    }
    const prevStep = prevOnboardingQuestionnaireStep(activeStep, priorTx);
    setStep(prevStep);
    persistDraft(prevStep);
  }

  function skipToDashboard() {
    persistDraft();
    router.replace("/dashboard");
  }

  const chip = (active: boolean) =>
    `w-full rounded-2xl border px-4 py-3.5 text-left text-[15px] font-semibold transition-colors ${
      active
        ? "border-skinfit-navy bg-skinfit-mint text-skinfit-navy"
        : "border-zinc-200 bg-white text-zinc-800 hover:border-zinc-300"
    }`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold text-skinfit-navy">
          Step {displayStep} / {totalSteps}
        </p>
        <button
          type="button"
          onClick={skipToDashboard}
          disabled={busy}
          className="shrink-0 text-sm font-semibold text-[#2C3E6B]/80 underline-offset-2 transition hover:text-[#2C3E6B] hover:underline disabled:opacity-50"
        >
          Skip to dashboard
        </button>
      </div>
      {err ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {err}
        </div>
      ) : null}

      {activeStep === 0 ? (
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
            onChange={(e) => {
              setAgeInput(e.target.value);
              saveAnswer({ ageInput: e.target.value });
            }}
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
                onClick={() => {
                  setGender(opt.value);
                  saveAnswer({ gender: opt.value });
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      ) : null}

      {activeStep === 1 ? (
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
                onClick={() => {
                  setConcern(c.id);
                  saveAnswer({ concern: c.id });
                }}
              >
                {c.label}
              </button>
            ))}
          </div>
        </>
      ) : null}

      {activeStep === 2 ? (
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
                onClick={() => {
                  setSeverity(id);
                  saveAnswer({ severity: id });
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      ) : null}

      {activeStep === 3 ? (
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
                onClick={() => {
                  setDuration(id);
                  saveAnswer({ duration: id });
                }}
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

      {activeStep === 4 ? (
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

      {activeStep === 5 ? (
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
                onClick={() => {
                  setPriorTx(id);
                  if (id === "no") {
                    setTxText("");
                    setTxDur("");
                    saveAnswer({ priorTx: id, txText: "", txDur: "" });
                  } else {
                    saveAnswer({ priorTx: id });
                  }
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      ) : null}

      {activeStep === 6 ? (
        <>
          <h2 className="text-lg font-bold text-zinc-900">
            What have you tried so far? For how long?
          </h2>
          <textarea
            className="min-h-[100px] w-full rounded-xl border border-zinc-200 bg-white p-3 text-[15px] text-zinc-900 outline-none focus:border-skinfit-navy focus:ring-2 focus:ring-skinfit-navy/20"
            placeholder="Describe treatments or products (min 10 characters)"
            value={txText}
            onChange={(e) => {
              setTxText(e.target.value);
              saveAnswer({ txText: e.target.value });
            }}
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
                onClick={() => {
                  setTxDur(id);
                  saveAnswer({ txDur: id });
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      ) : null}

      {activeStep === 7 ? (
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
                onClick={() => {
                  setSensitivity(id);
                  saveAnswer({ sensitivity: id });
                }}
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

      {activeStep === 8 ? (
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
                onClick={() => {
                  setSleep(id);
                  saveAnswer({ sleep: id });
                }}
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

      {activeStep === 9 ? (
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
                onClick={() => {
                  setWater(id);
                  saveAnswer({ water: id });
                }}
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
                onClick={() => {
                  setDiet(id);
                  saveAnswer({ diet: id });
                }}
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
                onClick={() => {
                  setSun(id);
                  saveAnswer({ sun: id });
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      ) : null}

      {activeStep === 10 ? (
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
                onClick={() => {
                  setSkinType(v);
                  saveAnswer({ skinType: v });
                }}
              >
                {v}
              </button>
            ))}
          </div>
        </>
      ) : null}

      {activeStep === 11 ? (
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
                onClick={() => {
                  setReferralSource(opt.id);
                  saveAnswer({ referralSource: opt.id });
                }}
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
              onChange={(e) => {
                setReferralOther(e.target.value);
                saveAnswer({ referralOther: e.target.value });
              }}
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
            {busy ? "Saving…" : activeStep === 11 ? "Save & continue" : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
