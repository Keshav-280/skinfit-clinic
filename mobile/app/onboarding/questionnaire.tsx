import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AgeDropdown } from "@/components/onboarding/AgeDropdown";
import { SKINFIT_GRADIENT } from "@/lib/skinfitTheme";
import { useAuth } from "@/contexts/AuthContext";
import { ApiError, apiJson } from "@/lib/api";
import { setOnboardingDashboardSkip } from "@/lib/onboardingDashboardSkip";
import {
  applyOnboardingQuestionnaireDraft,
  buildOnboardingQuestionnaireDraft,
  mergeOnboardingQuestionnaireDrafts,
  ONBOARDING_QUESTIONNAIRE_DRAFT_KEY,
  parseOnboardingQuestionnaireDraft,
  type OnboardingQuestionnaireDraftV2,
} from "@/lib/onboardingQuestionnaireDraft";
import { parseOnboardingAge } from "../../../src/lib/onboardingAgeOptions";
import {
  buildOnboardingQuestionnairePayload,
  expandSkippedStepsForSkip,
  mergeOnboardingStepSkipPatches,
  ONBOARDING_QUESTIONNAIRE_LAST_STEP,
  OVERALL_SKIN_HEALTH_OPTIONS,
  prepareQuestionnaireBack,
  prepareQuestionnaireNext,
  reconcileSkippedSteps,
  removeSkippedStepsForAnswer,
  nextOnboardingQuestionnaireStepAfterSkip,
  normalizeOnboardingQuestionnaireStep,
  questionnaireProgress,
  type BaselineDietType,
  type BaselineHydration,
  type BaselineSleep,
  type BaselineSunExposure,
  type ConcernDuration,
  type ConcernSeverity,
  type OnboardingQuestionnaireFormState,
  type OverallSkinHealth,
  type QuestionnaireEntryMode,
  type SkinSensitivity,
} from "../../../src/lib/onboardingQuestionnaireDefaults";
import {
  REFERRAL_SOURCE_OPTIONS,
  type ReferralSourceId,
} from "../../../src/lib/onboardingReferralSource";

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

const NAVY = "#2C3E6B";
const NAVY_DARK = "#1E3264";
const NAVY_LIGHT = "#E2E8F0";

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
const SKIN_TYPES = ["Dry", "Oily", "Combination", "Normal", "Sensitive"] as const;

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

function parseQuestionnaireEntryMode(value: string | string[] | undefined): QuestionnaireEntryMode {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "start" ? "start" : "resume";
}

export default function QuestionnaireScreen() {
  const router = useRouter();
  const { entry: entryParam } = useLocalSearchParams<{ entry?: string }>();
  const entryMode = parseQuestionnaireEntryMode(entryParam);
  const insets = useSafeAreaInsets();
  const { token, user, markOnboardingComplete, refreshUserFromProfile } = useAuth();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [concern, setConcern] = useState<Concern | null>(null);
  const [overallSkinHealth, setOverallSkinHealth] = useState<OverallSkinHealth | null>(
    null
  );
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
    overallSkinHealth,
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
    overallSkinHealth,
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
      setOverallSkinHealth: (value: string | null) =>
        setOverallSkinHealth(
          value === "maintenance" ||
            value === "need_improve" ||
            value === "ongoing_concerns"
            ? value
            : null
        ),
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
    if (!token) return;
    const base = fieldsRef.current;
    const draft = buildOnboardingQuestionnaireDraft({
      step: stepOverride ?? patch.step ?? base.step,
      ageInput: patch.ageInput ?? base.ageInput,
      gender: patch.gender !== undefined ? patch.gender : base.gender,
      concern: patch.concern !== undefined ? patch.concern : base.concern,
      overallSkinHealth:
        patch.overallSkinHealth !== undefined
          ? patch.overallSkinHealth
          : base.overallSkinHealth,
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
    void AsyncStorage.setItem(ONBOARDING_QUESTIONNAIRE_DRAFT_KEY, JSON.stringify(draft));
    void apiJson("/api/onboarding/questionnaire/draft", token, {
      method: "PUT",
      body: JSON.stringify({ draft }),
    }).catch(() => {
      /* offline */
    });
  }

  function saveAnswer(patch: Partial<OnboardingQuestionnaireDraftV2>) {
    const base = fieldsRef.current;
    const stepNow = normalizeOnboardingQuestionnaireStep(
      base.step,
      base.priorTx === "yes" || base.priorTx === "no" ? base.priorTx : null
    );
    const nextSkipped = base.skippedSteps.includes(stepNow)
      ? removeSkippedStepsForAnswer(stepNow, base.skippedSteps)
      : base.skippedSteps;
    if (nextSkipped.length !== base.skippedSteps.length) {
      setSkippedSteps(nextSkipped);
    }
    persistDraft(undefined, patch, nextSkipped);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let localDraft: OnboardingQuestionnaireDraftV2 | null = null;
      try {
        const raw = await AsyncStorage.getItem(ONBOARDING_QUESTIONNAIRE_DRAFT_KEY);
        if (raw) {
          localDraft = parseOnboardingQuestionnaireDraft(JSON.parse(raw));
        }
      } catch {
        /* ignore */
      }

      let serverDraft: OnboardingQuestionnaireDraftV2 | null = null;
      if (token) {
        try {
          const data = await apiJson<{ draft?: unknown }>(
            "/api/onboarding/questionnaire/draft",
            token,
            { method: "GET" }
          );
          serverDraft = parseOnboardingQuestionnaireDraft(data.draft ?? null);
        } catch {
          /* offline */
        }
      }

      if (cancelled) return;

      const merged = mergeOnboardingQuestionnaireDrafts(localDraft, serverDraft);
      if (merged) {
        merged.skippedSteps = reconcileSkippedSteps(merged.skippedSteps ?? []);
        applyOnboardingQuestionnaireDraft(merged, draftSetters(), entryMode);
        await AsyncStorage.setItem(
          ONBOARDING_QUESTIONNAIRE_DRAFT_KEY,
          JSON.stringify(merged)
        ).catch(() => {
          /* */
        });
      } else if (entryMode === "start") {
        setStep(0);
      }

      if (!cancelled) {
        hydratingRef.current = false;
        draftReadyRef.current = true;
        setDraftReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount
  }, [token, entryMode]);

  useEffect(() => {
    if (!draftReady || hydratingRef.current) return;
    const t = setTimeout(() => persistDraft(), 400);
    return () => {
      clearTimeout(t);
      if (draftReadyRef.current) persistDraft();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- persist when form fields change
  }, [
    draftReady,
    token,
    step,
    concern,
    overallSkinHealth,
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
        return overallSkinHealth != null;
      case 3:
        return severity != null;
      case 4:
        return duration != null;
      case 5:
        return triggers.length > 0;
      case 6:
        return priorTx != null;
      case 7:
        if (priorTx !== "yes") return true;
        return txText.trim().length >= 10 && txDur.trim().length > 0;
      case 8:
        return sensitivity != null;
      case 9:
        return sleep != null;
      case 10:
        return water != null && diet != null && sun != null;
      case 11:
        return skinType != null;
      case 12:
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
    overallSkinHealth,
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
      overallSkinHealth,
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
    if (patch.overallSkinHealth !== undefined) {
      setOverallSkinHealth(patch.overallSkinHealth);
    }
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

  async function submit(skippedOverride?: number[]) {
    if (!token) return;
    setBusy(true);
    setErr(null);
    try {
      const effectiveSkipped = skippedOverride ?? skippedSteps;
      await apiJson("/api/onboarding/questionnaire", token, {
        method: "POST",
        body: JSON.stringify(
          buildOnboardingQuestionnairePayload(formState(), {
            skippedSteps: effectiveSkipped,
          })
        ),
      });
      // Keep the draft when questions were skipped so a later "finish survey"
      // visit restores answers and lands on the first skipped question.
      if (effectiveSkipped.length === 0) {
        await AsyncStorage.removeItem(ONBOARDING_QUESTIONNAIRE_DRAFT_KEY);
        await apiJson("/api/onboarding/questionnaire/draft", token, {
          method: "DELETE",
        }).catch(() => {
          /* */
        });
      }
      // Refresh first, then apply optimistic flags last — a stale cached
      // profile must never overwrite "complete" or the drawer gate loops
      // back into onboarding forever.
      if (token) {
        await refreshUserFromProfile(token).catch(() => {});
      }
      await markOnboardingComplete();
      router.replace("/(drawer)" as Href);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Could not save questionnaire.");
    } finally {
      setBusy(false);
    }
  }

  function next() {
    if (activeStep === ONBOARDING_QUESTIONNAIRE_LAST_STEP) {
      void submit();
      return;
    }
    const { nextStep, nextSkipped } = prepareQuestionnaireNext(
      activeStep,
      priorTx,
      skippedSteps
    );
    if (nextSkipped.length !== skippedSteps.length) {
      setSkippedSteps(nextSkipped);
    }
    setStep(nextStep);
    persistDraft(nextStep, {}, nextSkipped);
  }

  function skip() {
    if (activeStep === ONBOARDING_QUESTIONNAIRE_LAST_STEP) {
      const nextSkipped = expandSkippedStepsForSkip(activeStep, skippedSteps);
      setSkippedSteps(nextSkipped);
      void submit(nextSkipped);
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
    const { prevStep, nextSkipped, clearPatch } = prepareQuestionnaireBack(
      activeStep,
      priorTx,
      skippedSteps
    );
    if (nextSkipped.length !== skippedSteps.length) {
      setSkippedSteps(nextSkipped);
    }
    if (Object.keys(clearPatch).length > 0) {
      applySkipPatch(clearPatch);
    }
    setStep(prevStep);
    persistDraft(prevStep, clearPatch, nextSkipped);
  }

  function skipToDashboard() {
    persistDraft();
    // Remember the explicit choice so the drawer gate lets the user in even
    // without a baseline scan (same as web's open /dashboard).
    if (user?.id) void setOnboardingDashboardSkip(user.id);
    router.replace("/(drawer)" as Href);
  }

  return (
    <LinearGradient colors={[...SKINFIT_GRADIENT.patient]} style={styles.flex}>
    <ScrollView
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.progressRow}>
        <Text style={styles.progress}>
          Step {displayStep} / {totalSteps}
        </Text>
        <Pressable onPress={skipToDashboard} disabled={busy} hitSlop={8}>
          <Text style={styles.skipDashboardText}>Skip to dashboard</Text>
        </Pressable>
      </View>
      {err ? <Text style={styles.err}>{err}</Text> : null}

      {activeStep === 0 ? (
        <>
          <Text style={styles.q}>About you</Text>
          <Text style={styles.sub}>Age (years)</Text>
          <AgeDropdown
            value={ageInput}
            onChange={(value) => {
              setAgeInput(value);
              saveAnswer({ ageInput: value });
            }}
          />
          <Text style={styles.sub2}>Gender</Text>
          {GENDER_OPTIONS.map((opt) => (
            <Pressable
              key={opt.value}
              style={[styles.chip, gender === opt.value && styles.chipOn]}
              onPress={() => {
                setGender(opt.value);
                saveAnswer({ gender: opt.value });
              }}
            >
              <Text style={[styles.chipText, gender === opt.value && styles.chipTextOn]}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </>
      ) : null}

      {activeStep === 1 ? (
        <>
          <Text style={styles.q}>What brings you to SkinFit today?</Text>
          {CONCERNS.map((c) => (
            <Pressable
              key={c.id}
              style={[styles.chip, concern === c.id && styles.chipOn]}
              onPress={() => {
                setConcern(c.id);
                saveAnswer({ concern: c.id });
              }}
            >
              <Text style={[styles.chipText, concern === c.id && styles.chipTextOn]}>{c.label}</Text>
            </Pressable>
          ))}
        </>
      ) : null}

      {activeStep === 2 ? (
        <>
          <Text style={styles.q}>How would you rate your overall skin health?</Text>
          {OVERALL_SKIN_HEALTH_OPTIONS.map((opt) => (
            <Pressable
              key={opt.id}
              style={[styles.chip, overallSkinHealth === opt.id && styles.chipOn]}
              onPress={() => {
                setOverallSkinHealth(opt.id);
                saveAnswer({ overallSkinHealth: opt.id });
              }}
            >
              <Text
                style={[
                  styles.chipText,
                  overallSkinHealth === opt.id && styles.chipTextOn,
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </>
      ) : null}

      {activeStep === 3 ? (
        <>
          <Text style={styles.q}>
            {concern
              ? copyForConcern(concern, "sevTitle")
              : "How would you rate severity for your main concern?"}
          </Text>
          {(
            [
              ["mild", copyForConcern(concern ?? "general", "sevA")],
              ["moderate", copyForConcern(concern ?? "general", "sevB")],
              ["severe", copyForConcern(concern ?? "general", "sevC")],
            ] as const
          ).map(([id, label]) => (
            <Pressable
              key={id}
              style={[styles.chip, severity === id && styles.chipOn]}
              onPress={() => {
                setSeverity(id);
                saveAnswer({ severity: id });
              }}
            >
              <Text style={[styles.chipText, severity === id && styles.chipTextOn]}>{label}</Text>
            </Pressable>
          ))}
        </>
      ) : null}

      {activeStep === 4 ? (
        <>
          <Text style={styles.q}>{copyForConcern(concern, "durTitle")}</Text>
          {(
            [
              ["recent", "Recent — under 3 months"],
              ["ongoing", "Ongoing — 3 months to 1 year"],
              ["chronic", "Chronic — over 1 year"],
            ] as const
          ).map(([id, label]) => (
            <Pressable
              key={id}
              style={[styles.chip, duration === id && styles.chipOn]}
              onPress={() => {
                setDuration(id);
                saveAnswer({ duration: id });
              }}
            >
              <Text style={[styles.chipText, duration === id && styles.chipTextOn]}>{label}</Text>
            </Pressable>
          ))}
          {duration === "chronic" ? (
            <Text style={styles.hintWarn}>
              Chronic concern flags your kAI report and alerts your clinician.
            </Text>
          ) : null}
        </>
      ) : null}

      {activeStep === 5 ? (
        <>
          <Text style={styles.q}>{copyForConcern(concern, "trigTitle")}</Text>
          <Text style={styles.sub}>Select all that apply.</Text>
          {TRIGGERS.map((t) => (
            <Pressable
              key={t.id}
              style={[styles.chip, triggers.includes(t.id) && styles.chipOn]}
              onPress={() => toggleTrigger(t.id)}
            >
              <Text style={[styles.chipText, triggers.includes(t.id) && styles.chipTextOn]}>
                {t.label}
              </Text>
            </Pressable>
          ))}
          {triggers.includes("unsure") ? (
            <Text style={styles.hint}>
              kAI will identify patterns from journal data.
            </Text>
          ) : null}
        </>
      ) : null}

      {activeStep === 6 ? (
        <>
          <Text style={styles.q}>Have you tried treating this before?</Text>
          {(
            [
              ["yes", "Yes — I've tried treatments or seen a doctor"],
              ["no", "No — first time seeking proper treatment"],
            ] as const
          ).map(([id, label]) => (
            <Pressable
              key={id}
              style={[styles.chip, priorTx === id && styles.chipOn]}
              onPress={() => {
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
              <Text style={[styles.chipText, priorTx === id && styles.chipTextOn]}>{label}</Text>
            </Pressable>
          ))}
        </>
      ) : null}

      {activeStep === 7 ? (
        <>
          <Text style={styles.q}>What have you tried so far? For how long?</Text>
          <TextInput
            style={styles.input}
            placeholder="Describe treatments or products (min 10 characters)"
            placeholderTextColor="#94a3b8"
            value={txText}
            onChangeText={(value) => {
              setTxText(value);
              saveAnswer({ txText: value });
            }}
            multiline
          />
          {txText.trim().length > 0 && txText.trim().length < 10 ? (
            <Text style={styles.hintWarn}>Add a little more detail (at least 10 characters).</Text>
          ) : null}
          <Text style={styles.sub2}>Duration tag</Text>
          {(
            [
              ["under1m", "Under 1 month"],
              ["1to3m", "1–3 months"],
              ["3to6m", "3–6 months"],
              ["6to12m", "6–12 months"],
              ["over1y", "Over 1 year"],
            ] as const
          ).map(([id, label]) => (
            <Pressable
              key={id}
              style={[styles.chip, txDur === id && styles.chipOn]}
              onPress={() => {
                setTxDur(id);
                saveAnswer({ txDur: id });
              }}
            >
              <Text style={[styles.chipText, txDur === id && styles.chipTextOn]}>{label}</Text>
            </Pressable>
          ))}
        </>
      ) : null}

      {activeStep === 8 ? (
        <>
          <Text style={styles.q}>How would you describe your skin&apos;s sensitivity?</Text>
          {(
            [
              ["low", "Low — rarely reacts"],
              ["moderate", "Moderate — occasional irritation"],
              ["high", "High — frequent redness or reactions"],
            ] as const
          ).map(([id, label]) => (
            <Pressable
              key={id}
              style={[styles.chip, sensitivity === id && styles.chipOn]}
              onPress={() => {
                setSensitivity(id);
                saveAnswer({ sensitivity: id });
              }}
            >
              <Text style={[styles.chipText, sensitivity === id && styles.chipTextOn]}>{label}</Text>
            </Pressable>
          ))}
          {sensitivity === "high" ? (
            <Text style={styles.hintWarn}>
              High sensitivity flags your kAI report; your clinician is alerted to review product
              prescriptions.
            </Text>
          ) : null}
        </>
      ) : null}

      {activeStep === 9 ? (
        <>
          <Text style={styles.q}>How&apos;s your sleep most nights?</Text>
          {(
            [
              ["under5", "Under 5 hours"],
              ["5to6", "5–6 hours"],
              ["7to8", "7–8 hours"],
              ["8plus", "8+ hours"],
            ] as const
          ).map(([id, label]) => (
            <Pressable
              key={id}
              style={[styles.chip, sleep === id && styles.chipOn]}
              onPress={() => {
                setSleep(id);
                saveAnswer({ sleep: id });
              }}
            >
              <Text style={[styles.chipText, sleep === id && styles.chipTextOn]}>{label}</Text>
            </Pressable>
          ))}
          {sleep === "under5" ? (
            <Text style={styles.hint}>
              Poor sleep is linked to elevated cortisol and skin inflammation — included in your
              kAI report.
            </Text>
          ) : null}
        </>
      ) : null}

      {activeStep === 10 ? (
        <>
          <Text style={styles.q}>Lifestyle snapshot</Text>
          <Text style={styles.sub}>Daily water intake</Text>
          {(
            [
              ["under1l", "Under 1L"],
              ["1to1_5l", "1–1.5L"],
              ["1_5to2l", "1.5–2L"],
              ["2lplus", "2L+"],
            ] as const
          ).map(([id, label]) => (
            <Pressable
              key={id}
              style={[styles.chip, water === id && styles.chipOn]}
              onPress={() => {
                setWater(id);
                saveAnswer({ water: id });
              }}
            >
              <Text style={[styles.chipText, water === id && styles.chipTextOn]}>{label}</Text>
            </Pressable>
          ))}
          <Text style={styles.sub2}>Diet type</Text>
          {(
            [
              ["vegetarian", "Vegetarian"],
              ["vegan", "Vegan"],
              ["nonveg", "Non-vegetarian"],
              ["mixed", "Mixed"],
            ] as const
          ).map(([id, label]) => (
            <Pressable
              key={id}
              style={[styles.chip, diet === id && styles.chipOn]}
              onPress={() => {
                setDiet(id);
                saveAnswer({ diet: id });
              }}
            >
              <Text style={[styles.chipText, diet === id && styles.chipTextOn]}>{label}</Text>
            </Pressable>
          ))}
          <Text style={styles.sub2}>Typical sun exposure</Text>
          {(
            [
              ["minimal", "Minimal (mostly indoors)"],
              ["low", "Low (~30 min)"],
              ["moderate", "Moderate (1–2 hrs)"],
              ["high", "High (2+ hrs)"],
            ] as const
          ).map(([id, label]) => (
            <Pressable
              key={id}
              style={[styles.chip, sun === id && styles.chipOn]}
              onPress={() => {
                setSun(id);
                saveAnswer({ sun: id });
              }}
            >
              <Text style={[styles.chipText, sun === id && styles.chipTextOn]}>{label}</Text>
            </Pressable>
          ))}
        </>
      ) : null}

      {activeStep === 11 ? (
        <>
          <Text style={styles.q}>How would you describe your skin type?</Text>
          {SKIN_TYPES.map((v) => (
            <Pressable
              key={v}
              style={[styles.chip, skinType === v && styles.chipOn]}
              onPress={() => {
                setSkinType(v);
                saveAnswer({ skinType: v });
              }}
            >
              <Text style={[styles.chipText, skinType === v && styles.chipTextOn]}>{v}</Text>
            </Pressable>
          ))}
        </>
      ) : null}

      {activeStep === 12 ? (
        <>
          <Text style={styles.q}>How did you hear about SkinFit Wellness?</Text>
          <Text style={styles.sub}>This helps us understand what brought you here.</Text>
          {REFERRAL_SOURCE_OPTIONS.map((opt) => (
            <Pressable
              key={opt.id}
              style={[styles.chip, referralSource === opt.id && styles.chipOn]}
              onPress={() => {
                setReferralSource(opt.id);
                saveAnswer({ referralSource: opt.id });
              }}
            >
              <Text
                style={[
                  styles.chipText,
                  referralSource === opt.id && styles.chipTextOn,
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          ))}
          {referralSource === "other" ? (
            <TextInput
              style={styles.input}
              placeholder="Please specify (min 3 characters)"
              placeholderTextColor="#94a3b8"
              value={referralOther}
              onChangeText={(value) => {
                setReferralOther(value);
                saveAnswer({ referralOther: value });
              }}
            />
          ) : null}
        </>
      ) : null}

      <Pressable style={styles.skipBtn} onPress={skip} disabled={busy}>
        <Text style={styles.skipBtnText}>Skip this question</Text>
      </Pressable>

      <View style={styles.row}>
        <Pressable style={styles.btnGhost} onPress={back} disabled={busy}>
          <Text style={styles.btnGhostText}>Back</Text>
        </Pressable>
        <Pressable
          style={[styles.btn, (!canNext || busy) && styles.disabled]}
          onPress={next}
          disabled={!canNext || busy}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>
              {activeStep === ONBOARDING_QUESTIONNAIRE_LAST_STEP ? "Save & continue" : "Continue"}
            </Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 24, flexGrow: 1 },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 16,
  },
  progress: {
    fontSize: 12,
    fontWeight: "700",
    color: NAVY,
    letterSpacing: 0.5,
  },
  skipDashboardText: {
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(44, 62, 107, 0.8)",
  },
  err: { color: "#DC2626", marginBottom: 8, fontSize: 13, fontWeight: "600" },
  q: { fontSize: 20, fontWeight: "800", color: "#1A1A2E", marginBottom: 14, letterSpacing: -0.3 },
  sub: { fontSize: 13, color: "#71717a", marginBottom: 10 },
  sub2: { fontSize: 13, fontWeight: "600", color: "#52525b", marginTop: 14, marginBottom: 8 },
  chip: {
    paddingVertical: 15,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "transparent",
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  chipOn: { backgroundColor: NAVY_LIGHT, borderColor: NAVY },
  chipText: { fontSize: 15, color: "#374151", fontWeight: "600" },
  chipTextOn: { color: NAVY_DARK },
  hint: {
    fontSize: 13,
    color: "#52525b",
    marginTop: 8,
    lineHeight: 20,
  },
  hintWarn: {
    fontSize: 13,
    fontWeight: "600",
    color: "#92400E",
    marginTop: 8,
  },
  input: {
    minHeight: 100,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    padding: 14,
    textAlignVertical: "top",
    fontSize: 15,
    backgroundColor: "#FFFFFF",
    marginBottom: 12,
    color: "#1A1A2E",
  },
  skipBtn: {
    marginTop: 24,
    paddingVertical: 10,
    alignItems: "center",
  },
  skipBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#71717a",
  },
  row: { flexDirection: "row", gap: 12, marginTop: 12 },
  btn: {
    flex: 1,
    backgroundColor: NAVY,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    shadowColor: NAVY,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 4,
  },
  btnGhost: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    borderWidth: 2,
    borderColor: NAVY,
    backgroundColor: "#FFFFFF",
  },
  btnGhostText: { color: NAVY, fontWeight: "700" },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 15, letterSpacing: 0.3 },
  disabled: { opacity: 0.4 },
});
