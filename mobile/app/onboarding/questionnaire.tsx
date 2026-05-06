import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, type Href } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useAuth } from "@/contexts/AuthContext";
import { ApiError, apiJson } from "@/lib/api";
import {
  ONBOARDING_QUESTIONNAIRE_DRAFT_KEY,
  ONBOARDING_QUESTIONNAIRE_DRAFT_SCHEMA,
  type OnboardingQuestionnaireDraftV2,
} from "@/lib/onboardingQuestionnaireDraft";

const GENDER_OPTIONS: { value: string; label: string }[] = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "other", label: "Other" },
  { value: "prefer_not_say", label: "Prefer not to say" },
];

function parseOnboardingAge(raw: string): number | null {
  const n = parseInt(raw.trim(), 10);
  if (!Number.isFinite(n)) return null;
  if (n < 1 || n > 120) return null;
  return n;
}

type Concern = "acne" | "pigmentation" | "ageing" | "hair" | "general";

const VALID_CONCERN = new Set<string>([
  "acne",
  "pigmentation",
  "ageing",
  "hair",
  "general",
]);

const TEAL = "#0d9488";

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

function questionnaireProgress(
  step: number,
  priorTx: "yes" | "no" | null
): { displayStep: number; totalSteps: number } {
  if (priorTx === "yes") {
    return { displayStep: step + 1, totalSteps: 11 };
  }
  if (priorTx === "no") {
    const order = [0, 1, 2, 3, 4, 5, 7, 8, 9, 10];
    const ix = order.indexOf(step);
    return {
      displayStep: ix >= 0 ? ix + 1 : step + 1,
      totalSteps: 10,
    };
  }
  return { displayStep: step + 1, totalSteps: 11 };
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

export default function QuestionnaireScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [concern, setConcern] = useState<Concern | null>(null);
  const [severity, setSeverity] = useState<"mild" | "moderate" | "severe" | null>(null);
  const [duration, setDuration] = useState<"recent" | "ongoing" | "chronic" | null>(null);
  const [triggers, setTriggers] = useState<string[]>([]);
  const [priorTx, setPriorTx] = useState<"yes" | "no" | null>(null);
  const [txText, setTxText] = useState("");
  const [txDur, setTxDur] = useState("");
  const [sensitivity, setSensitivity] = useState<"low" | "moderate" | "high" | null>(null);
  const [sleep, setSleep] = useState<"under5" | "5to6" | "7to8" | "8plus" | null>(null);
  const [water, setWater] = useState<"under1l" | "1to1_5l" | "1_5to2l" | "2lplus" | null>(null);
  const [diet, setDiet] = useState<"vegetarian" | "vegan" | "nonveg" | "mixed" | null>(null);
  const [sun, setSun] = useState<"minimal" | "low" | "moderate" | "high" | null>(null);
  const [skinType, setSkinType] = useState<(typeof SKIN_TYPES)[number] | null>(null);
  const [ageInput, setAgeInput] = useState("");
  const [gender, setGender] = useState<string | null>(null);
  const [draftReady, setDraftReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(ONBOARDING_QUESTIONNAIRE_DRAFT_KEY);
        if (cancelled) return;
        if (!raw) return;
        const d = JSON.parse(raw) as OnboardingQuestionnaireDraftV2;
        if (d.v !== ONBOARDING_QUESTIONNAIRE_DRAFT_SCHEMA) return;
        if (typeof d.step === "number" && d.step >= 0 && d.step <= 10) {
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
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setDraftReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!draftReady) return;
    const t = setTimeout(() => {
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
      };
      void AsyncStorage.setItem(ONBOARDING_QUESTIONNAIRE_DRAFT_KEY, JSON.stringify(draft));
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
  ]);

  const toggleTrigger = (id: string) => {
    setTriggers((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]));
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
  ]);

  const { displayStep, totalSteps } = questionnaireProgress(step, priorTx);

  async function submit() {
    const age = parseOnboardingAge(ageInput);
    if (
      !token ||
      age == null ||
      !gender ||
      !concern ||
      !severity ||
      !duration ||
      !sensitivity ||
      !sleep ||
      !water ||
      !diet ||
      !sun ||
      !skinType ||
      !priorTx
    )
      return;
    setBusy(true);
    setErr(null);
    try {
      await apiJson("/api/onboarding/questionnaire", token, {
        method: "POST",
        body: JSON.stringify({
          age,
          gender,
          primaryConcern: concern,
          concernSeverity: severity,
          concernDuration: duration,
          triggers,
          priorTreatment: priorTx,
          treatmentHistoryText: priorTx === "yes" ? txText.trim() : undefined,
          treatmentHistoryDuration: priorTx === "yes" ? txDur.trim() : undefined,
          skinSensitivity: sensitivity,
          baselineSleep: sleep,
          baselineHydration: water,
          baselineDietType: diet,
          baselineSunExposure: sun,
          skinType,
        }),
      });
      await AsyncStorage.removeItem(ONBOARDING_QUESTIONNAIRE_DRAFT_KEY);
      router.push("/onboarding/capture" as Href);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Could not save questionnaire.");
    } finally {
      setBusy(false);
    }
  }

  function next() {
    if (step === 10) {
      void submit();
      return;
    }
    if (step === 5 && priorTx === "no") {
      setStep(7);
      return;
    }
    setStep((s) => s + 1);
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

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.progress}>
        Step {displayStep} / {totalSteps}
      </Text>
      {err ? <Text style={styles.err}>{err}</Text> : null}

      {step === 0 ? (
        <>
          <Text style={styles.q}>About you</Text>
          <Text style={styles.sub}>Age (years)</Text>
          <TextInput
            style={styles.ageInput}
            placeholder="e.g. 32"
            placeholderTextColor="#94a3b8"
            keyboardType="number-pad"
            value={ageInput}
            onChangeText={(t) => setAgeInput(t.replace(/[^\d]/g, "").slice(0, 3))}
          />
          <Text style={styles.sub2}>Gender</Text>
          {GENDER_OPTIONS.map((opt) => (
            <Pressable
              key={opt.value}
              style={[styles.chip, gender === opt.value && styles.chipOn]}
              onPress={() => setGender(opt.value)}
            >
              <Text style={[styles.chipText, gender === opt.value && styles.chipTextOn]}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </>
      ) : null}

      {step === 1 ? (
        <>
          <Text style={styles.q}>What brings you to SkinFit today?</Text>
          {CONCERNS.map((c) => (
            <Pressable
              key={c.id}
              style={[styles.chip, concern === c.id && styles.chipOn]}
              onPress={() => setConcern(c.id)}
            >
              <Text style={[styles.chipText, concern === c.id && styles.chipTextOn]}>{c.label}</Text>
            </Pressable>
          ))}
        </>
      ) : null}

      {step === 2 ? (
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
              onPress={() => setSeverity(id)}
            >
              <Text style={[styles.chipText, severity === id && styles.chipTextOn]}>{label}</Text>
            </Pressable>
          ))}
        </>
      ) : null}

      {step === 3 ? (
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
              onPress={() => setDuration(id)}
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

      {step === 4 ? (
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

      {step === 5 ? (
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
              onPress={() => setPriorTx(id)}
            >
              <Text style={[styles.chipText, priorTx === id && styles.chipTextOn]}>{label}</Text>
            </Pressable>
          ))}
        </>
      ) : null}

      {step === 6 && priorTx === "yes" ? (
        <>
          <Text style={styles.q}>What have you tried so far? For how long?</Text>
          <TextInput
            style={styles.input}
            placeholder="Describe treatments or products (min 10 characters)"
            placeholderTextColor="#94a3b8"
            value={txText}
            onChangeText={setTxText}
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
              onPress={() => setTxDur(id)}
            >
              <Text style={[styles.chipText, txDur === id && styles.chipTextOn]}>{label}</Text>
            </Pressable>
          ))}
        </>
      ) : null}

      {step === 7 ? (
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
              onPress={() => setSensitivity(id)}
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

      {step === 8 ? (
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
              onPress={() => setSleep(id)}
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

      {step === 9 ? (
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
              onPress={() => setWater(id)}
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
              onPress={() => setDiet(id)}
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
              onPress={() => setSun(id)}
            >
              <Text style={[styles.chipText, sun === id && styles.chipTextOn]}>{label}</Text>
            </Pressable>
          ))}
        </>
      ) : null}

      {step === 10 ? (
        <>
          <Text style={styles.q}>How would you describe your skin type?</Text>
          {SKIN_TYPES.map((v) => (
            <Pressable
              key={v}
              style={[styles.chip, skinType === v && styles.chipOn]}
              onPress={() => setSkinType(v)}
            >
              <Text style={[styles.chipText, skinType === v && styles.chipTextOn]}>{v}</Text>
            </Pressable>
          ))}
        </>
      ) : null}

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
              {step === 10 ? "Save & continue" : "Continue"}
            </Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40 },
  progress: { fontSize: 12, fontWeight: "700", color: TEAL, marginBottom: 12 },
  err: { color: "#b91c1c", marginBottom: 8 },
  q: { fontSize: 18, fontWeight: "700", color: "#18181b", marginBottom: 12 },
  sub: { fontSize: 13, color: "#71717a", marginBottom: 8 },
  sub2: { fontSize: 13, fontWeight: "600", color: "#52525b", marginTop: 12, marginBottom: 8 },
  chip: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: "#fff",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e4e4e7",
    marginBottom: 10,
  },
  chipOn: { backgroundColor: "#ccfbf1", borderColor: TEAL },
  chipText: { fontSize: 15, color: "#27272a", fontWeight: "600" },
  chipTextOn: { color: "#0f766e" },
  hint: {
    fontSize: 13,
    color: "#52525b",
    marginTop: 8,
    lineHeight: 20,
  },
  hintWarn: {
    fontSize: 13,
    fontWeight: "600",
    color: "#92400e",
    marginTop: 8,
  },
  ageInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e4e4e7",
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    backgroundColor: "#fff",
    marginBottom: 12,
    color: "#18181b",
  },
  input: {
    minHeight: 100,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e4e4e7",
    borderRadius: 12,
    padding: 12,
    textAlignVertical: "top",
    fontSize: 15,
    backgroundColor: "#fff",
    marginBottom: 12,
  },
  row: { flexDirection: "row", gap: 12, marginTop: 24 },
  btn: {
    flex: 1,
    backgroundColor: TEAL,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  btnGhost: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    borderWidth: 2,
    borderColor: TEAL,
  },
  btnGhostText: { color: TEAL, fontWeight: "700" },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  disabled: { opacity: 0.45 },
});
