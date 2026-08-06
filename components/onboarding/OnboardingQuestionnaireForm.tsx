"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { LogOut, Send } from "lucide-react";

import {
  applyOnboardingQuestionnaireDraft,
  buildOnboardingQuestionnaireDraft,
  mergeOnboardingQuestionnaireDrafts,
  ONBOARDING_QUESTIONNAIRE_DRAFT_KEY,
  parseOnboardingQuestionnaireDraft,
  type OnboardingQuestionnaireDraftV2,
} from "@/src/lib/onboardingQuestionnaireDraft";
import { parseOnboardingAge } from "@/src/lib/onboardingAgeOptions";
import {
  buildOnboardingQuestionnairePayload,
  type BaselineDietType,
  type BaselineSleep,
  type ConcernSeverity,
  type OnboardingQuestionnaireFormState,
  type QuestionnaireEntryMode,
  type SkinSensitivity,
} from "@/src/lib/onboardingQuestionnaireDefaults";
import {
  ONBOARDING_CONCERN_IDS,
  ONBOARDING_CONCERN_LABELS,
  formatOnboardingConcernLabels,
  primaryOnboardingConcern,
  type OnboardingConcernId,
} from "@/src/lib/onboardingConcerns";
import {
  onboardingChatFallbackAck,
  onboardingChatFallbackMessage,
  onboardingChatNextQuestionText,
  type OnboardingChatQuestionId,
} from "@/src/lib/onboardingChatKai";

const KAI_ACK_CACHE_KEY = "skinfit_onboarding_kai_acks_v1";
const KAI_ACK_MAX_WAIT_MS = 3000;

function kaiAckCacheKey(questionId: string, answer: unknown): string {
  try {
    return `${questionId}:${JSON.stringify(answer)}`;
  } catch {
    return `${questionId}:${String(answer)}`;
  }
}

function readKaiAckCache(key: string): string | null {
  try {
    const raw = sessionStorage.getItem(KAI_ACK_CACHE_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, unknown>;
    const value = map[key];
    return typeof value === "string" && value.trim() ? value.trim() : null;
  } catch {
    return null;
  }
}

function writeKaiAckCache(key: string, message: string) {
  try {
    const raw = sessionStorage.getItem(KAI_ACK_CACHE_KEY);
    let map: Record<string, string> = {};
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        map = parsed as Record<string, string>;
      }
    }
    map[key] = message;
    sessionStorage.setItem(KAI_ACK_CACHE_KEY, JSON.stringify(map));
  } catch {
    /* private mode / quota */
  }
}

function delayMs(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function typingMinMs(): number {
  return 500 + Math.floor(Math.random() * 500);
}

const GENDER_OPTIONS: { value: string; label: string }[] = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "other", label: "Other" },
  { value: "prefer_not_say", label: "Prefer not to say" },
];

const SLEEP_OPTIONS: { value: BaselineSleep; label: string }[] = [
  { value: "under5", label: "Under 5 hours" },
  { value: "5to6", label: "5–6 hours" },
  { value: "7to8", label: "7–8 hours" },
  { value: "8plus", label: "8+ hours" },
];

const DIET_OPTIONS: { value: BaselineDietType; label: string }[] = [
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan", label: "Vegan" },
  { value: "nonveg", label: "Non-vegetarian" },
  { value: "mixed", label: "Mixed / flexible" },
];

const SENSITIVITY_OPTIONS: { value: SkinSensitivity; label: string }[] = [
  { value: "low", label: "Not really" },
  { value: "moderate", label: "Sometimes" },
  { value: "high", label: "Yes, very easily" },
];

/** Chat question order → legacy draft step index for persistence. */
const CHAT_TO_DRAFT_STEP = [0, 1, 3, 9, 10, 8] as const;
type ChatQuestionId = OnboardingChatQuestionId;

const CHAT_QUESTIONS: ChatQuestionId[] = [
  "PROFILE_01",
  "CONCERN_01",
  "SEV_01",
  "LIFE_01",
  "LIFE_02b",
  "SENS_01",
];

type ChatMessage = {
  id: string;
  role: "kai" | "user";
  text: string;
};

type PendingInput =
  | { kind: "profile" }
  | { kind: "concerns" }
  | { kind: "severity" }
  | { kind: "sleep" }
  | { kind: "diet" }
  | { kind: "sensitivity" }
  | { kind: "summary" }
  | null;

function parseQuestionnaireEntryMode(value: string | null): QuestionnaireEntryMode {
  return value === "start" ? "start" : "resume";
}

function severityOptionsFor(concerns: readonly OnboardingConcernId[]) {
  const c = primaryOnboardingConcern(concerns);
  const map: Record<
    OnboardingConcernId,
    { mild: string; moderate: string; severe: string; ask: string }
  > = {
    acne: {
      ask: "Got it. On a scale, how bad would you say the breakouts have been?",
      mild: "A few pimples occasionally",
      moderate: "Frequent breakouts, some scarring",
      severe: "Cystic or painful acne constantly",
    },
    pigmentation: {
      ask: "Got it. On a scale, how noticeable is the uneven tone?",
      mild: "Slight patchiness I can see",
      moderate: "Visible patches or spots in photos",
      severe: "Dark patches covering large areas",
    },
    ageing: {
      ask: "Got it. On a scale, how visible are the signs of ageing?",
      mild: "Fine lines only visible up close",
      moderate: "Wrinkles visible at rest, some sagging",
      severe: "Deep wrinkles, significant volume loss",
    },
    hair: {
      ask: "Got it. On a scale, how significant is the hair loss?",
      mild: "Slight thinning, mostly in parting",
      moderate: "Noticeable thinning or hairline recession",
      severe: "Significant bald patches or rapid loss",
    },
    general: {
      ask: "Got it. On a scale, how bad would you say it's been?",
      mild: "Mild — mostly maintenance",
      moderate: "Moderate — needs improving",
      severe: "Severe — ongoing concerns",
    },
  };
  return map[c];
}

function ackForConcerns(concerns: OnboardingConcernId[]): string {
  return onboardingChatFallbackAck("CONCERN_01", concerns);
}

function ackForSeverity(sev: ConcernSeverity): string {
  return onboardingChatFallbackAck("SEV_01", sev);
}

function ackForSleep(sleep: BaselineSleep): string {
  return onboardingChatFallbackAck("LIFE_01", sleep);
}

function ackForDiet(diet: BaselineDietType): string {
  return onboardingChatFallbackAck("LIFE_02b", diet);
}

function ackForSensitivity(s: SkinSensitivity): string {
  return onboardingChatFallbackAck("SENS_01", s);
}

function genderLabel(value: string): string {
  return GENDER_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

function pendingKindForQuestion(q: ChatQuestionId): PendingInput {
  if (q === "PROFILE_01") return { kind: "profile" };
  if (q === "CONCERN_01") return { kind: "concerns" };
  if (q === "SEV_01") return { kind: "severity" };
  if (q === "LIFE_01") return { kind: "sleep" };
  if (q === "LIFE_02b") return { kind: "diet" };
  return { kind: "sensitivity" };
}

function buildSummaryText(answers: {
  ageInput: string;
  gender: string | null;
  concerns: OnboardingConcernId[];
  severity: ConcernSeverity | null;
  sleep: BaselineSleep | null;
  diet: BaselineDietType | null;
  sensitivity: SkinSensitivity | null;
}): string {
  const lines = [
    `Age & gender: ${answers.ageInput} · ${genderLabel(answers.gender!)}`,
    `Concerns: ${formatOnboardingConcernLabels(answers.concerns)}`,
    `Severity: ${
      answers.severity
        ? severityOptionsFor(answers.concerns)[answers.severity]
        : "—"
    }`,
    `Sleep: ${
      SLEEP_OPTIONS.find((o) => o.value === answers.sleep)?.label ?? "—"
    }`,
    `Diet: ${
      DIET_OPTIONS.find((o) => o.value === answers.diet)?.label ?? "—"
    }`,
    `Sensitivity: ${
      SENSITIVITY_OPTIONS.find((o) => o.value === answers.sensitivity)?.label ??
      "—"
    }`,
  ];
  return `Perfect, here's what I've got:\n\n${lines.join("\n")}`;
}

async function fetchKaiChatResponse(input: {
  questionId: ChatQuestionId;
  answer: unknown;
  previousAnswers: Record<string, unknown>;
  nextQuestionText: string;
}): Promise<string> {
  const cacheKey = kaiAckCacheKey(input.questionId, input.answer);
  const cached = readKaiAckCache(cacheKey);
  if (cached) return cached;

  const fallback = onboardingChatFallbackMessage(
    input.questionId,
    input.answer,
    input.previousAnswers,
    input.nextQuestionText
  );

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), KAI_ACK_MAX_WAIT_MS);

  try {
    const res = await fetch("/api/onboarding/chat-response", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      signal: controller.signal,
      body: JSON.stringify({
        questionId: input.questionId,
        answer: input.answer,
        previousAnswers: input.previousAnswers,
        nextQuestionText: input.nextQuestionText,
      }),
    });
    window.clearTimeout(timer);
    if (!res.ok) return fallback;
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    const message =
      typeof data.message === "string" && data.message.trim()
        ? data.message.trim()
        : fallback;
    writeKaiAckCache(cacheKey, message);
    return message;
  } catch {
    window.clearTimeout(timer);
    return fallback;
  }
}

function typingDelayMs(): number {
  return 800 + Math.floor(Math.random() * 700);
}

function welcomeDelayMs(): number {
  return 1100 + Math.floor(Math.random() * 400);
}

function msgId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function firstIncompleteChatIndex(answers: {
  ageInput: string;
  gender: string | null;
  concerns: OnboardingConcernId[];
  severity: ConcernSeverity | null;
  sleep: BaselineSleep | null;
  diet: BaselineDietType | null;
  sensitivity: SkinSensitivity | null;
}): number {
  if (parseOnboardingAge(answers.ageInput) == null || !answers.gender) return 0;
  if (answers.concerns.length === 0) return 1;
  if (!answers.severity) return 2;
  if (!answers.sleep) return 3;
  if (!answers.diet) return 4;
  if (!answers.sensitivity) return 5;
  return 6;
}

function buildHistoryMessages(answers: {
  ageInput: string;
  gender: string | null;
  concerns: OnboardingConcernId[];
  severity: ConcernSeverity | null;
  sleep: BaselineSleep | null;
  diet: BaselineDietType | null;
  sensitivity: SkinSensitivity | null;
}): ChatMessage[] {
  const out: ChatMessage[] = [];
  const push = (role: "kai" | "user", text: string) => {
    out.push({ id: msgId(), role, text });
  };

  const incomplete = firstIncompleteChatIndex(answers);
  if (incomplete === 0) return out;

  push(
    "kai",
    "Hey! Before we get started, tell me a bit about yourself — how old are you and how do you identify?"
  );
  if (answers.gender && parseOnboardingAge(answers.ageInput) != null) {
    push(
      "user",
      `${answers.ageInput} · ${genderLabel(answers.gender)}`
    );
  }
  if (incomplete <= 1) return out;

  push(
    "kai",
    `${genderLabel(answers.gender!)} · ${answers.ageInput} — thanks. So what's been bugging you about your skin lately? Pick everything that applies.`
  );
  if (answers.concerns.length > 0) {
    push("user", formatOnboardingConcernLabels(answers.concerns));
  }
  if (incomplete <= 2) return out;

  const sevCopy = severityOptionsFor(answers.concerns);
  push("kai", `${ackForConcerns(answers.concerns)} ${sevCopy.ask}`);
  if (answers.severity) {
    push("user", sevCopy[answers.severity]);
  }
  if (incomplete <= 3) return out;

  push(
    "kai",
    `${ackForSeverity(answers.severity!)} Quick lifestyle check — how many hours do you usually sleep?`
  );
  if (answers.sleep) {
    push(
      "user",
      SLEEP_OPTIONS.find((o) => o.value === answers.sleep)?.label ?? answers.sleep
    );
  }
  if (incomplete <= 4) return out;

  push(
    "kai",
    `${ackForSleep(answers.sleep!)} And what does your diet mostly look like?`
  );
  if (answers.diet) {
    push(
      "user",
      DIET_OPTIONS.find((o) => o.value === answers.diet)?.label ?? answers.diet
    );
  }
  if (incomplete <= 5) return out;

  push(
    "kai",
    `${ackForDiet(answers.diet!)} Last one — does your skin react easily to new products or weather changes?`
  );
  if (answers.sensitivity) {
    push(
      "user",
      SENSITIVITY_OPTIONS.find((o) => o.value === answers.sensitivity)?.label ??
        answers.sensitivity
    );
  }
  return out;
}

function matchCustomText(
  question: ChatQuestionId,
  text: string,
  concerns: OnboardingConcernId[]
):
  | { ok: true; label: string; apply: Partial<AnswerPatch> }
  | { ok: false } {
  const t = text.trim().toLowerCase();
  if (!t) return { ok: false };

  if (question === "PROFILE_01") {
    const ageMatch = t.match(/\b(\d{1,3})\b/);
    const age = ageMatch ? parseOnboardingAge(ageMatch[1]) : null;
    let gender: string | null = null;
    for (const g of GENDER_OPTIONS) {
      if (t.includes(g.label.toLowerCase()) || t.includes(g.value.replace(/_/g, " "))) {
        gender = g.value;
        break;
      }
    }
    if (t.includes("woman") || t.includes("girl")) gender = "female";
    if (t.includes("man") || t.includes("boy")) gender = "male";
    if (age != null && gender) {
      return {
        ok: true,
        label: `${age} · ${genderLabel(gender)}`,
        apply: { ageInput: String(age), gender },
      };
    }
    if (age != null) {
      return {
        ok: true,
        label: String(age),
        apply: { ageInput: String(age) },
      };
    }
    if (gender) {
      return {
        ok: true,
        label: genderLabel(gender),
        apply: { gender },
      };
    }
    return { ok: false };
  }

  if (question === "CONCERN_01") {
    const found: OnboardingConcernId[] = [];
    for (const id of ONBOARDING_CONCERN_IDS) {
      const label = ONBOARDING_CONCERN_LABELS[id].toLowerCase();
      if (t.includes(id) || t.includes(label.split(" ")[0]!)) found.push(id);
    }
    if (t.includes("acne") || t.includes("breakout")) found.push("acne");
    if (t.includes("pigment") || t.includes("dark spot") || t.includes("melasma"))
      found.push("pigmentation");
    if (t.includes("wrinkle") || t.includes("ageing") || t.includes("aging"))
      found.push("ageing");
    if (t.includes("hair") || t.includes("scalp")) found.push("hair");
    const unique = [...new Set(found)];
    if (unique.length === 0) return { ok: false };
    return {
      ok: true,
      label: formatOnboardingConcernLabels(unique),
      apply: { concerns: unique },
    };
  }

  if (question === "SEV_01") {
    const opts = severityOptionsFor(concerns);
    let sev: ConcernSeverity | null = null;
    if (t.includes("mild") || t.includes("occasionally") || t.includes("slight"))
      sev = "mild";
    else if (t.includes("severe") || t.includes("cystic") || t.includes("constant") || t.includes("worst"))
      sev = "severe";
    else if (t.includes("moderate") || t.includes("frequent") || t.includes("medium") || t.includes("bad"))
      sev = "moderate";
    if (!sev) return { ok: false };
    return { ok: true, label: opts[sev], apply: { severity: sev } };
  }

  if (question === "LIFE_01") {
    let sleep: BaselineSleep | null = null;
    if (t.includes("under 5") || t.includes("less than 5") || /\b[1-4]\b/.test(t))
      sleep = "under5";
    else if (t.includes("5") && t.includes("6")) sleep = "5to6";
    else if (t.includes("7") || t.includes("8 hour")) sleep = "7to8";
    else if (t.includes("8+") || t.includes("more than 8") || t.includes("9"))
      sleep = "8plus";
    else if (t.includes("5") || t.includes("6")) sleep = "5to6";
    if (!sleep) return { ok: false };
    return {
      ok: true,
      label: SLEEP_OPTIONS.find((o) => o.value === sleep)!.label,
      apply: { sleep },
    };
  }

  if (question === "LIFE_02b") {
    let diet: BaselineDietType | null = null;
    if (t.includes("vegan")) diet = "vegan";
    else if (t.includes("vegetarian") || t.includes("veg ")) diet = "vegetarian";
    else if (t.includes("non") || t.includes("meat") || t.includes("nonveg"))
      diet = "nonveg";
    else if (t.includes("mix") || t.includes("flex") || t.includes("everything"))
      diet = "mixed";
    if (!diet) return { ok: false };
    return {
      ok: true,
      label: DIET_OPTIONS.find((o) => o.value === diet)!.label,
      apply: { diet },
    };
  }

  if (question === "SENS_01") {
    let sensitivity: SkinSensitivity | null = null;
    if (
      t.includes("very") ||
      t.includes("easily") ||
      t.includes("high") ||
      t.includes("yes")
    )
      sensitivity = "high";
    else if (t.includes("sometimes") || t.includes("moderate") || t.includes("occasionally"))
      sensitivity = "moderate";
    else if (t.includes("not") || t.includes("no") || t.includes("low") || t.includes("rarely"))
      sensitivity = "low";
    if (!sensitivity) return { ok: false };
    return {
      ok: true,
      label: SENSITIVITY_OPTIONS.find((o) => o.value === sensitivity)!.label,
      apply: { sensitivity },
    };
  }

  return { ok: false };
}

type AnswerPatch = {
  ageInput?: string;
  gender?: string | null;
  concerns?: OnboardingConcernId[];
  severity?: ConcernSeverity | null;
  sleep?: BaselineSleep | null;
  diet?: BaselineDietType | null;
  sensitivity?: SkinSensitivity | null;
};

function KaiAvatar() {
  return (
    <div
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#2C3E6B] text-[10px] font-bold tracking-tight text-white"
      aria-hidden
    >
      kAI
    </div>
  );
}

function TypingDots() {
  return (
    <div
      className="flex items-center gap-1 px-1 py-0.5"
      aria-label="kAI is typing"
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400"
          style={{ animationDelay: `${i * 150}ms`, animationDuration: "1s" }}
        />
      ))}
    </div>
  );
}

function Pill({
  active,
  disabled,
  onClick,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-full border px-3.5 py-2 text-left text-sm font-medium transition disabled:opacity-50 ${
        active
          ? "border-[#2C3E6B] bg-[#2C3E6B] text-white"
          : "border-zinc-300 bg-white text-zinc-800 hover:border-[#2C3E6B]/40"
      }`}
    >
      {children}
    </button>
  );
}

export function OnboardingQuestionnaireForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const entryMode = parseQuestionnaireEntryMode(searchParams.get("entry"));

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [draftReady, setDraftReady] = useState(false);
  const draftReadyRef = useRef(false);
  const hydratingRef = useRef(true);
  const bootStartedRef = useRef(false);

  const [ageInput, setAgeInput] = useState("");
  const [gender, setGender] = useState<string | null>(null);
  const [concerns, setConcerns] = useState<OnboardingConcernId[]>([]);
  const [severity, setSeverity] = useState<ConcernSeverity | null>(null);
  const [sleep, setSleep] = useState<BaselineSleep | null>(null);
  const [diet, setDiet] = useState<BaselineDietType | null>(null);
  const [sensitivity, setSensitivity] = useState<SkinSensitivity | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [pendingInput, setPendingInput] = useState<PendingInput>(null);
  const [chatIndex, setChatIndex] = useState(0);
  const [pendingConcerns, setPendingConcerns] = useState<OnboardingConcernId[]>([]);
  const [draftAge, setDraftAge] = useState("");
  const [customText, setCustomText] = useState("");
  const [interactionLocked, setInteractionLocked] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const timersRef = useRef<number[]>([]);

  const fieldsRef = useRef({
    ageInput,
    gender,
    concerns,
    severity,
    sleep,
    diet,
    sensitivity,
    chatIndex,
  });
  fieldsRef.current = {
    ageInput,
    gender,
    concerns,
    severity,
    sleep,
    diet,
    sensitivity,
    chatIndex,
  };

  const clearTimers = useCallback(() => {
    for (const t of timersRef.current) window.clearTimeout(t);
    timersRef.current = [];
  }, []);

  const schedule = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timersRef.current.push(id);
    return id;
  }, []);

  function draftSetters() {
    return {
      setStep: (step: number) => {
        const ix = CHAT_TO_DRAFT_STEP.indexOf(
          step as (typeof CHAT_TO_DRAFT_STEP)[number]
        );
        if (ix >= 0) setChatIndex(ix);
        else if (step > 10) setChatIndex(6);
        else setChatIndex(0);
      },
      setAgeInput,
      setGender,
      setConcerns: (value: OnboardingConcernId[]) => setConcerns(value),
      setOverallSkinHealth: () => {},
      setSeverity: (value: string | null) =>
        setSeverity(
          value === "mild" || value === "moderate" || value === "severe"
            ? value
            : null
        ),
      setDuration: () => {},
      setTriggers: () => {},
      setPriorTx: () => {},
      setTxText: () => {},
      setTxDur: () => {},
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
      setWater: () => {},
      setDiet: (value: string | null) =>
        setDiet(
          value === "vegetarian" ||
            value === "vegan" ||
            value === "nonveg" ||
            value === "mixed"
            ? value
            : null
        ),
      setSun: () => {},
      setSkinType: () => {},
      setReferralSource: () => {},
      setReferralOther: () => {},
      setSkippedSteps: () => {},
    };
  }

  function persistDraft(patch: Partial<OnboardingQuestionnaireDraftV2> = {}) {
    const base = fieldsRef.current;
    const draftStep =
      patch.step ??
      (base.chatIndex >= CHAT_TO_DRAFT_STEP.length
        ? 12
        : CHAT_TO_DRAFT_STEP[base.chatIndex] ?? 0);
    const draft = buildOnboardingQuestionnaireDraft({
      step: draftStep,
      ageInput: patch.ageInput ?? base.ageInput,
      gender: patch.gender !== undefined ? patch.gender : base.gender,
      concerns: patch.concerns ?? base.concerns,
      overallSkinHealth: "need_improve",
      severity: patch.severity !== undefined ? patch.severity : base.severity,
      duration: "ongoing",
      triggers: ["unsure"],
      priorTx: "no",
      txText: "",
      txDur: "",
      sensitivity:
        patch.sensitivity !== undefined ? patch.sensitivity : base.sensitivity,
      sleep: patch.sleep !== undefined ? patch.sleep : base.sleep,
      water: "1to1_5l",
      diet: patch.diet !== undefined ? patch.diet : base.diet,
      sun: "moderate",
      skinType: "Normal",
      referralSource: "other",
      referralOther: "Prefer not to say",
      skippedSteps: [],
    });
    try {
      localStorage.setItem(
        ONBOARDING_QUESTIONNAIRE_DRAFT_KEY,
        JSON.stringify(draft)
      );
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
      if (merged && entryMode !== "start") {
        // Chat flow no longer uses skipped steps; keep saved answers intact.
        merged.skippedSteps = [];
        applyOnboardingQuestionnaireDraft(merged, draftSetters(), entryMode);
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
      clearTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount
  }, [entryMode]);

  useEffect(() => {
    if (!draftReady || hydratingRef.current) return;
    const t = window.setTimeout(() => persistDraft(), 400);
    return () => {
      clearTimeout(t);
      if (draftReadyRef.current) persistDraft();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    draftReady,
    ageInput,
    gender,
    concerns,
    severity,
    sleep,
    diet,
    sensitivity,
    chatIndex,
  ]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, isTyping, pendingInput]);

  const pushKaiThen = useCallback(
    (text: string, after: () => void, delay = typingDelayMs()) => {
      setInteractionLocked(true);
      setIsTyping(true);
      setPendingInput(null);
      schedule(() => {
        setIsTyping(false);
        setMessages((m) => [...m, { id: msgId(), role: "kai", text }]);
        setInteractionLocked(false);
        after();
      }, delay);
    },
    [schedule]
  );

  const revealKaiMessage = useCallback(
    async (getMessage: () => Promise<string>, after: () => void) => {
      setInteractionLocked(true);
      setIsTyping(true);
      setPendingInput(null);
      const minMs = typingMinMs();
      const started = Date.now();
      let message: string;
      try {
        message = await getMessage();
      } catch {
        message = "Got it — thanks for sharing.";
      }
      const elapsed = Date.now() - started;
      if (elapsed < minMs) {
        await delayMs(minMs - elapsed);
      }
      setIsTyping(false);
      setMessages((m) => [...m, { id: msgId(), role: "kai", text: message }]);
      setInteractionLocked(false);
      after();
    },
    []
  );

  const askQuestion = useCallback(
    (
      index: number,
      answers: {
        gender: string | null;
        ageInput: string;
        concerns: OnboardingConcernId[];
        severity: ConcernSeverity | null;
        sleep: BaselineSleep | null;
        diet: BaselineDietType | null;
        sensitivity?: SkinSensitivity | null;
      },
      /** Full kAI bubble text when already resolved (OpenAI or fallback). */
      kaiMessage?: string
    ) => {
      setChatIndex(index);

      if (index >= CHAT_QUESTIONS.length) {
        const body = buildSummaryText({
          ageInput: answers.ageInput,
          gender: answers.gender,
          concerns: answers.concerns,
          severity: answers.severity,
          sleep: answers.sleep,
          diet: answers.diet,
          sensitivity:
            answers.sensitivity ?? fieldsRef.current.sensitivity,
        });
        // Summary is always hardcoded (never OpenAI).
        const summary = kaiMessage ? `${kaiMessage}\n\n${body}` : body;
        pushKaiThen(summary, () => setPendingInput({ kind: "summary" }));
        return;
      }

      const q = CHAT_QUESTIONS[index]!;
      const text =
        kaiMessage?.trim() ||
        onboardingChatNextQuestionText(q, {
          concerns: answers.concerns,
          severity: answers.severity,
          sleep: answers.sleep,
          diet: answers.diet,
        });

      const inputKind = pendingKindForQuestion(q);

      pushKaiThen(text, () => {
        if (q === "CONCERN_01") setPendingConcerns([]);
        if (q === "PROFILE_01") setDraftAge(fieldsRef.current.ageInput);
        setPendingInput(inputKind);
      });
    },
    [pushKaiThen]
  );

  // Boot conversation once draft is ready
  useEffect(() => {
    if (!draftReady || bootStartedRef.current) return;
    bootStartedRef.current = true;

    const snapshot = {
      ageInput: fieldsRef.current.ageInput,
      gender: fieldsRef.current.gender,
      concerns: fieldsRef.current.concerns,
      severity: fieldsRef.current.severity,
      sleep: fieldsRef.current.sleep,
      diet: fieldsRef.current.diet,
      sensitivity: fieldsRef.current.sensitivity,
    };
    const incomplete = firstIncompleteChatIndex(snapshot);

    if (incomplete === 0) {
      setIsTyping(true);
      setInteractionLocked(true);
      schedule(() => {
        setIsTyping(false);
        setInteractionLocked(false);
        askQuestion(0, snapshot);
      }, welcomeDelayMs());
      return;
    }

    if (incomplete >= 6) {
      const history = buildHistoryMessages(snapshot);
      setMessages(history);
      setChatIndex(6);
      const summaryLines = [
        `Age & gender: ${snapshot.ageInput} · ${genderLabel(snapshot.gender!)}`,
        `Concerns: ${formatOnboardingConcernLabels(snapshot.concerns)}`,
        `Severity: ${severityOptionsFor(snapshot.concerns)[snapshot.severity!]}`,
        `Sleep: ${SLEEP_OPTIONS.find((o) => o.value === snapshot.sleep)?.label}`,
        `Diet: ${DIET_OPTIONS.find((o) => o.value === snapshot.diet)?.label}`,
        `Sensitivity: ${
          SENSITIVITY_OPTIONS.find((o) => o.value === snapshot.sensitivity)?.label
        }`,
      ];
      pushKaiThen(
        `Perfect, here's what I've got:\n\n${summaryLines.join("\n")}`,
        () => setPendingInput({ kind: "summary" })
      );
      return;
    }

    const history = buildHistoryMessages(snapshot);
    setMessages(history);
    setPendingConcerns(snapshot.concerns);
    setDraftAge(snapshot.ageInput);
    askQuestion(incomplete, snapshot);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftReady]);

  function formState(): OnboardingQuestionnaireFormState {
    return {
      ageInput,
      gender,
      concerns,
      overallSkinHealth: "need_improve",
      severity,
      duration: "ongoing",
      triggers: ["unsure"],
      priorTx: "no",
      txText: "",
      txDur: "",
      sensitivity,
      sleep,
      water: "1to1_5l",
      diet,
      sun: "moderate",
      skinType: "Normal",
      referralSource: "other",
      referralOther: "Prefer not to say",
    };
  }

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/onboarding/questionnaire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          buildOnboardingQuestionnairePayload(formState(), { skippedSteps: [] })
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

  function appendUser(text: string) {
    setMessages((m) => [...m, { id: msgId(), role: "user", text }]);
  }

  function applyAnswerPatch(patch: AnswerPatch) {
    if (patch.ageInput !== undefined) {
      setAgeInput(patch.ageInput);
      fieldsRef.current.ageInput = patch.ageInput;
    }
    if (patch.gender !== undefined) {
      setGender(patch.gender);
      fieldsRef.current.gender = patch.gender;
    }
    if (patch.concerns !== undefined) {
      setConcerns(patch.concerns);
      fieldsRef.current.concerns = patch.concerns;
    }
    if (patch.severity !== undefined) {
      setSeverity(patch.severity);
      fieldsRef.current.severity = patch.severity;
    }
    if (patch.sleep !== undefined) {
      setSleep(patch.sleep);
      fieldsRef.current.sleep = patch.sleep;
    }
    if (patch.diet !== undefined) {
      setDiet(patch.diet);
      fieldsRef.current.diet = patch.diet;
    }
    if (patch.sensitivity !== undefined) {
      setSensitivity(patch.sensitivity);
      fieldsRef.current.sensitivity = patch.sensitivity;
    }
  }

  function currentPreviousAnswers(): Record<string, unknown> {
    const f = fieldsRef.current;
    return {
      age: parseOnboardingAge(f.ageInput),
      gender: f.gender,
      concerns: f.concerns,
      severity: f.severity,
      sleep: f.sleep,
      diet: f.diet,
      sensitivity: f.sensitivity,
    };
  }

  function openOptionsForIndex(index: number) {
    setChatIndex(index);
    const q = CHAT_QUESTIONS[index];
    if (!q) {
      setPendingInput({ kind: "summary" });
      return;
    }
    if (q === "CONCERN_01") setPendingConcerns([]);
    if (q === "PROFILE_01") setDraftAge(fieldsRef.current.ageInput);
    setPendingInput(pendingKindForQuestion(q));
  }

  function advanceAfterAnswer(
    answeredQuestionId: ChatQuestionId,
    answerPayload: unknown,
    nextIndex: number,
    patch: AnswerPatch
  ) {
    const previousAnswers = currentPreviousAnswers();
    applyAnswerPatch(patch);

    persistDraft({
      ...patch,
      step:
        nextIndex >= CHAT_TO_DRAFT_STEP.length
          ? 12
          : CHAT_TO_DRAFT_STEP[nextIndex],
    });

    const nextAnswers = {
      gender: fieldsRef.current.gender,
      ageInput: fieldsRef.current.ageInput,
      concerns: fieldsRef.current.concerns,
      severity: fieldsRef.current.severity,
      sleep: fieldsRef.current.sleep,
      diet: fieldsRef.current.diet,
      sensitivity: fieldsRef.current.sensitivity,
    };

    const nextQuestionId = CHAT_QUESTIONS[nextIndex] ?? null;
    const nextQuestionText = nextQuestionId
      ? onboardingChatNextQuestionText(nextQuestionId, {
          concerns: nextAnswers.concerns,
          severity: nextAnswers.severity,
          sleep: nextAnswers.sleep,
          diet: nextAnswers.diet,
        })
      : "";

    // Final summary is hardcoded — still allow a short OpenAI ack for the last answer.
    if (nextIndex >= CHAT_QUESTIONS.length) {
      void revealKaiMessage(
        () =>
          fetchKaiChatResponse({
            questionId: answeredQuestionId,
            answer: answerPayload,
            previousAnswers,
            nextQuestionText: "",
          }),
        () => {
          pushKaiThen(buildSummaryText(nextAnswers), () =>
            setPendingInput({ kind: "summary" })
          );
        }
      );
      return;
    }

    void revealKaiMessage(
      () =>
        fetchKaiChatResponse({
          questionId: answeredQuestionId,
          answer: answerPayload,
          previousAnswers,
          nextQuestionText,
        }),
      () => openOptionsForIndex(nextIndex)
    );
  }

  function completeProfile(nextAge: string, nextGender: string) {
    if (interactionLocked) return;
    const age = parseOnboardingAge(nextAge);
    if (age == null || !nextGender) return;
    const label = `${age} · ${genderLabel(nextGender)}`;
    appendUser(label);
    setPendingInput(null);
    advanceAfterAnswer(
      "PROFILE_01",
      { age, gender: nextGender },
      1,
      { ageInput: String(age), gender: nextGender }
    );
  }

  function completeConcerns(next: OnboardingConcernId[]) {
    if (interactionLocked || next.length === 0) return;
    appendUser(formatOnboardingConcernLabels(next));
    setPendingInput(null);
    advanceAfterAnswer("CONCERN_01", next, 2, { concerns: next });
  }

  function completeSeverity(sev: ConcernSeverity) {
    if (interactionLocked) return;
    const opts = severityOptionsFor(fieldsRef.current.concerns);
    appendUser(opts[sev]);
    setPendingInput(null);
    advanceAfterAnswer("SEV_01", sev, 3, { severity: sev });
  }

  function completeSleep(value: BaselineSleep) {
    if (interactionLocked) return;
    appendUser(SLEEP_OPTIONS.find((o) => o.value === value)!.label);
    setPendingInput(null);
    advanceAfterAnswer("LIFE_01", value, 4, { sleep: value });
  }

  function completeDiet(value: BaselineDietType) {
    if (interactionLocked) return;
    appendUser(DIET_OPTIONS.find((o) => o.value === value)!.label);
    setPendingInput(null);
    advanceAfterAnswer("LIFE_02b", value, 5, { diet: value });
  }

  function completeSensitivity(value: SkinSensitivity) {
    if (interactionLocked) return;
    appendUser(SENSITIVITY_OPTIONS.find((o) => o.value === value)!.label);
    setPendingInput(null);
    advanceAfterAnswer("SENS_01", value, 6, { sensitivity: value });
  }

  function handleCustomSend() {
    if (interactionLocked || !pendingInput || pendingInput.kind === "summary")
      return;
    const text = customText.trim();
    if (!text) return;

    const q = CHAT_QUESTIONS[chatIndex];
    if (!q) return;

    const matched = matchCustomText(q, text, fieldsRef.current.concerns);
    setCustomText("");

    if (!matched.ok) {
      appendUser(text);
      pushKaiThen(
        "Got it — could you tap one of the options below so I can log it correctly?",
        () => setPendingInput(pendingInput)
      );
      return;
    }

    appendUser(matched.label);
    setPendingInput(null);

    const apply = matched.apply;
    if (q === "PROFILE_01") {
      const nextAge = apply.ageInput ?? fieldsRef.current.ageInput;
      const nextGender = apply.gender ?? fieldsRef.current.gender;
      setAgeInput(nextAge);
      if (apply.gender) setGender(apply.gender);
      setDraftAge(nextAge);
      if (parseOnboardingAge(nextAge) != null && nextGender) {
        const age = parseOnboardingAge(nextAge)!;
        advanceAfterAnswer(
          "PROFILE_01",
          { age, gender: nextGender },
          1,
          { ageInput: nextAge, gender: nextGender }
        );
      } else {
        persistDraft(apply);
        pushKaiThen(
          nextGender
            ? "And how old are you?"
            : "And how do you identify? Pick a gender below.",
          () => setPendingInput({ kind: "profile" })
        );
      }
      return;
    }

    if (q === "CONCERN_01" && apply.concerns) {
      advanceAfterAnswer("CONCERN_01", apply.concerns, 2, apply);
      return;
    }
    if (q === "SEV_01" && apply.severity) {
      advanceAfterAnswer("SEV_01", apply.severity, 3, apply);
      return;
    }
    if (q === "LIFE_01" && apply.sleep) {
      advanceAfterAnswer("LIFE_01", apply.sleep, 4, apply);
      return;
    }
    if (q === "LIFE_02b" && apply.diet) {
      advanceAfterAnswer("LIFE_02b", apply.diet, 5, apply);
      return;
    }
    if (q === "SENS_01" && apply.sensitivity) {
      advanceAfterAnswer("SENS_01", apply.sensitivity, 6, apply);
    }
  }

  const sevOpts = useMemo(
    () => severityOptionsFor(concerns),
    [concerns]
  );

  const optionsDisabled = interactionLocked || isTyping;

  return (
    <div className="flex h-full max-h-full w-full flex-col bg-[#F0F0F0]">
      <header className="flex shrink-0 items-center gap-3 border-b border-zinc-200/80 bg-[#2C3E6B] px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-white shadow-sm">
        <KaiAvatar />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight">kAI</p>
          <p className="text-[11px] text-white/70">Your skin advisor</p>
        </div>
        <button
          type="button"
          aria-label="Sign out"
          title="Sign out"
          onClick={() => {
            void (async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              router.push("/login");
              router.refresh();
            })();
          }}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-white/80 transition hover:bg-white/10 hover:text-white"
        >
          <LogOut className="h-4 w-4" strokeWidth={2.25} aria-hidden />
        </button>
      </header>

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-4"
      >
        <div className="mx-auto flex w-full max-w-lg flex-col gap-3">
          {messages.map((m) =>
            m.role === "kai" ? (
              <div key={m.id} className="flex max-w-[85%] items-end gap-2">
                <KaiAvatar />
                <div className="rounded-2xl rounded-bl-md bg-white px-3.5 py-2.5 text-[15px] leading-relaxed text-zinc-800 shadow-sm whitespace-pre-wrap">
                  {m.text}
                </div>
              </div>
            ) : (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[75%] rounded-2xl rounded-br-md bg-[#E0F5F0] px-3.5 py-2.5 text-[15px] leading-relaxed text-zinc-800 shadow-sm whitespace-pre-wrap">
                  {m.text}
                </div>
              </div>
            )
          )}

          {isTyping ? (
            <div className="flex max-w-[85%] items-end gap-2">
              <KaiAvatar />
              <div className="rounded-2xl rounded-bl-md bg-white px-3.5 py-3 shadow-sm">
                <TypingDots />
              </div>
            </div>
          ) : null}

          {pendingInput && !isTyping ? (
            <div className="mt-1 flex flex-col gap-2 pl-10">
              {pendingInput.kind === "profile" ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="sr-only" htmlFor="chat-age">
                      Age
                    </label>
                    <input
                      id="chat-age"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={120}
                      placeholder="Age"
                      value={draftAge}
                      disabled={optionsDisabled}
                      onChange={(e) => setDraftAge(e.target.value)}
                      className="w-20 rounded-full border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-[#2C3E6B]"
                    />
                    {GENDER_OPTIONS.map((opt) => (
                      <Pill
                        key={opt.value}
                        active={gender === opt.value}
                        disabled={optionsDisabled}
                        onClick={() => setGender(opt.value)}
                      >
                        {opt.label}
                      </Pill>
                    ))}
                  </div>
                  <button
                    type="button"
                    disabled={
                      optionsDisabled ||
                      parseOnboardingAge(draftAge) == null ||
                      !gender
                    }
                    onClick={() => completeProfile(draftAge, gender!)}
                    className="self-start rounded-full bg-[#2C3E6B] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                  >
                    Continue
                  </button>
                </>
              ) : null}

              {pendingInput.kind === "concerns" ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    {ONBOARDING_CONCERN_IDS.map((id) => (
                      <Pill
                        key={id}
                        active={pendingConcerns.includes(id)}
                        disabled={optionsDisabled}
                        onClick={() =>
                          setPendingConcerns((cur) =>
                            cur.includes(id)
                              ? cur.filter((x) => x !== id)
                              : [...cur, id]
                          )
                        }
                      >
                        {ONBOARDING_CONCERN_LABELS[id]}
                      </Pill>
                    ))}
                  </div>
                  <button
                    type="button"
                    disabled={optionsDisabled || pendingConcerns.length === 0}
                    onClick={() => completeConcerns(pendingConcerns)}
                    className="self-start rounded-full bg-[#2C3E6B] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                  >
                    Done
                  </button>
                </>
              ) : null}

              {pendingInput.kind === "severity" ? (
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ["mild", sevOpts.mild],
                      ["moderate", sevOpts.moderate],
                      ["severe", sevOpts.severe],
                    ] as const
                  ).map(([id, label]) => (
                    <Pill
                      key={id}
                      disabled={optionsDisabled}
                      onClick={() => completeSeverity(id)}
                    >
                      {label}
                    </Pill>
                  ))}
                </div>
              ) : null}

              {pendingInput.kind === "sleep" ? (
                <div className="flex flex-wrap gap-2">
                  {SLEEP_OPTIONS.map((opt) => (
                    <Pill
                      key={opt.value}
                      disabled={optionsDisabled}
                      onClick={() => completeSleep(opt.value)}
                    >
                      {opt.label}
                    </Pill>
                  ))}
                </div>
              ) : null}

              {pendingInput.kind === "diet" ? (
                <div className="flex flex-wrap gap-2">
                  {DIET_OPTIONS.map((opt) => (
                    <Pill
                      key={opt.value}
                      disabled={optionsDisabled}
                      onClick={() => completeDiet(opt.value)}
                    >
                      {opt.label}
                    </Pill>
                  ))}
                </div>
              ) : null}

              {pendingInput.kind === "sensitivity" ? (
                <div className="flex flex-wrap gap-2">
                  {SENSITIVITY_OPTIONS.map((opt) => (
                    <Pill
                      key={opt.value}
                      disabled={optionsDisabled}
                      onClick={() => completeSensitivity(opt.value)}
                    >
                      {opt.label}
                    </Pill>
                  ))}
                </div>
              ) : null}

              {pendingInput.kind === "summary" ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void submit()}
                  className="self-start rounded-full bg-[#2C3E6B] px-5 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
                >
                  {busy ? "Saving…" : "Let's get started"}
                </button>
              ) : null}
            </div>
          ) : null}

          {err ? (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
            >
              {err}
            </div>
          ) : null}
        </div>
      </div>

      <div className="shrink-0 border-t border-zinc-200 bg-[#F7F7F7] px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-4">
        <form
          className="mx-auto flex w-full max-w-lg items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            handleCustomSend();
          }}
        >
          <input
            type="text"
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            placeholder="Type your answer..."
            disabled={
              optionsDisabled ||
              !pendingInput ||
              pendingInput.kind === "summary"
            }
            className="min-w-0 flex-1 rounded-full border border-zinc-200 bg-white px-4 py-2.5 text-[15px] text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-[#2C3E6B]/40 disabled:opacity-50"
          />
          <button
            type="submit"
            aria-label="Send"
            disabled={
              optionsDisabled ||
              !customText.trim() ||
              !pendingInput ||
              pendingInput.kind === "summary"
            }
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#2C3E6B] text-white disabled:opacity-40"
          >
            <Send className="h-4 w-4" aria-hidden />
          </button>
        </form>
      </div>
    </div>
  );
}
