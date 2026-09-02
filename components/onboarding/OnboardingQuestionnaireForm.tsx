"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
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
  type ConcernDuration,
  type OnboardingQuestionnaireFormState,
  type QuestionnaireEntryMode,
  type SkinSensitivity,
} from "@/src/lib/onboardingQuestionnaireDefaults";
import {
  ONBOARDING_CONCERN_IDS,
  ONBOARDING_CONCERN_LABELS,
  formatOnboardingConcernLabels,
  type OnboardingConcernId,
} from "@/src/lib/onboardingConcerns";
import {
  ONBOARDING_CHAT_DURATION_OPTIONS,
  ONBOARDING_CHAT_SKIN_TYPES,
  ONBOARDING_CHAT_TRIGGER_OPTIONS,
  onboardingChatDurationAsk,
  onboardingChatFallbackAck,
  onboardingChatFallbackMessage,
  onboardingChatNextQuestionText,
  onboardingChatTriggersAsk,
  type OnboardingChatQuestionId,
  type OnboardingChatSkinType,
} from "@/src/lib/onboardingChatKai";
import {
  REFERRAL_SOURCE_OPTIONS,
  formatReferralSourceAnswer,
  isReferralSourceId,
  type ReferralSourceId,
} from "@/src/lib/onboardingReferralSource";

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

const SENSITIVITY_OPTIONS: { value: SkinSensitivity; label: string }[] = [
  { value: "low", label: "Not really" },
  { value: "moderate", label: "Sometimes" },
  { value: "high", label: "Yes, very easily" },
];

/** Chat question order → legacy draft step index for persistence. */
const CHAT_TO_DRAFT_STEP = [0, 1, 4, 11, 8, 12] as const;
type ChatQuestionId = OnboardingChatQuestionId;

const CHAT_QUESTIONS: ChatQuestionId[] = [
  "PROFILE_01",
  "CONCERN_01",
  "DUR_TRIG",
  "SKIN_TYPE",
  "SENS_01",
  "REF_01",
];

type ChatMessage = {
  id: string;
  role: "kai" | "user";
  text: string;
};

type PendingInput =
  | { kind: "profile" }
  | { kind: "concerns" }
  | { kind: "duration" }
  | { kind: "triggers" }
  | { kind: "skinType" }
  | { kind: "sensitivity" }
  | { kind: "referral" }
  | { kind: "summary" }
  | null;

type AnswerSnapshot = {
  ageInput: string;
  gender: string | null;
  concerns: OnboardingConcernId[];
  duration: ConcernDuration | null;
  triggers: string[];
  skinType: OnboardingChatSkinType | null;
  sensitivity: SkinSensitivity | null;
  referralSource: ReferralSourceId | null;
  referralOther: string;
};

type AnswerPatch = {
  ageInput?: string;
  gender?: string | null;
  concerns?: OnboardingConcernId[];
  duration?: ConcernDuration | null;
  triggers?: string[];
  skinType?: OnboardingChatSkinType | null;
  sensitivity?: SkinSensitivity | null;
  referralSource?: ReferralSourceId | null;
  referralOther?: string;
};

function parseQuestionnaireEntryMode(value: string | null): QuestionnaireEntryMode {
  return value === "start" ? "start" : "resume";
}

function genderLabel(value: string): string {
  return GENDER_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

function durationLabel(id: ConcernDuration): string {
  return (
    ONBOARDING_CHAT_DURATION_OPTIONS.find((o) => o.id === id)?.label ?? id
  );
}

function triggerLabelList(ids: string[]): string {
  return ids
    .map(
      (id) =>
        ONBOARDING_CHAT_TRIGGER_OPTIONS.find((o) => o.id === id)?.label ?? id
    )
    .join(", ");
}

function referralComplete(
  source: ReferralSourceId | null,
  other: string
): boolean {
  if (!source) return false;
  if (source === "other") return other.trim().length >= 3;
  return true;
}

function pendingKindForQuestion(q: ChatQuestionId): PendingInput {
  if (q === "PROFILE_01") return { kind: "profile" };
  if (q === "CONCERN_01") return { kind: "concerns" };
  if (q === "DUR_TRIG") return { kind: "duration" };
  if (q === "SKIN_TYPE") return { kind: "skinType" };
  if (q === "SENS_01") return { kind: "sensitivity" };
  return { kind: "referral" };
}

function buildSummaryText(answers: AnswerSnapshot): string {
  const lines = [
    `Age & gender: ${answers.ageInput} · ${genderLabel(answers.gender!)}`,
    `Concerns: ${formatOnboardingConcernLabels(answers.concerns)}`,
    `Duration: ${
      answers.duration ? durationLabel(answers.duration) : "-"
    }`,
    `Triggers: ${
      answers.triggers.length > 0 ? triggerLabelList(answers.triggers) : "-"
    }`,
    `Skin type: ${answers.skinType ?? "-"}`,
    `Sensitivity: ${
      SENSITIVITY_OPTIONS.find((o) => o.value === answers.sensitivity)?.label ??
      "-"
    }`,
    `Heard about us: ${
      answers.referralSource
        ? formatReferralSourceAnswer({
            source: answers.referralSource,
            other: answers.referralOther,
          })
        : "-"
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

function firstIncompleteChatIndex(answers: AnswerSnapshot): number {
  if (parseOnboardingAge(answers.ageInput) == null || !answers.gender) return 0;
  if (answers.concerns.length === 0) return 1;
  if (!answers.duration || answers.triggers.length === 0) return 2;
  if (!answers.skinType) return 3;
  if (!answers.sensitivity) return 4;
  if (!referralComplete(answers.referralSource, answers.referralOther)) return 5;
  return 6;
}

function buildHistoryMessages(answers: AnswerSnapshot): ChatMessage[] {
  const out: ChatMessage[] = [];
  const push = (role: "kai" | "user", text: string) => {
    out.push({ id: msgId(), role, text });
  };

  const incomplete = firstIncompleteChatIndex(answers);
  if (incomplete === 0) return out;

  push(
    "kai",
    "Hey! Before we get started, tell me a bit about yourself - how old are you and how do you identify?"
  );
  if (answers.gender && parseOnboardingAge(answers.ageInput) != null) {
    push("user", `${answers.ageInput} · ${genderLabel(answers.gender)}`);
  }
  if (incomplete <= 1) return out;

  push(
    "kai",
    `${onboardingChatFallbackAck("PROFILE_01", {
      age: answers.ageInput,
      gender: answers.gender,
    })} So what's been bugging you about your skin lately? Pick everything that applies.`
  );
  if (answers.concerns.length > 0) {
    push("user", formatOnboardingConcernLabels(answers.concerns));
  }
  if (incomplete <= 2) return out;

  push(
    "kai",
    `${onboardingChatFallbackAck("CONCERN_01", answers.concerns)} ${onboardingChatDurationAsk(answers.concerns)}`
  );
  if (answers.duration) {
    push("user", durationLabel(answers.duration));
  }
  if (answers.duration && answers.triggers.length === 0) {
    push(
      "kai",
      `${onboardingChatFallbackAck("DUR_TRIG", {
        phase: "duration",
        duration: answers.duration,
      })} ${onboardingChatTriggersAsk()}`
    );
    return out;
  }
  if (answers.triggers.length > 0) {
    push(
      "kai",
      `${onboardingChatFallbackAck("DUR_TRIG", {
        phase: "duration",
        duration: answers.duration,
      })} ${onboardingChatTriggersAsk()}`
    );
    push("user", triggerLabelList(answers.triggers));
  }
  if (incomplete <= 3) return out;

  push(
    "kai",
    `${onboardingChatFallbackAck("DUR_TRIG", {
      duration: answers.duration,
      triggers: answers.triggers,
    })} What would you say your skin type is?`
  );
  if (answers.skinType) push("user", answers.skinType);
  if (incomplete <= 4) return out;

  push(
    "kai",
    `${onboardingChatFallbackAck("SKIN_TYPE", answers.skinType)} Does your skin react easily to new products or weather changes?`
  );
  if (answers.sensitivity) {
    push(
      "user",
      SENSITIVITY_OPTIONS.find((o) => o.value === answers.sensitivity)?.label ??
        answers.sensitivity
    );
  }
  if (incomplete <= 5) return out;

  push(
    "kai",
    `${onboardingChatFallbackAck("SENS_01", answers.sensitivity)} One last thing - how did you hear about SkinFit?`
  );
  if (answers.referralSource) {
    push(
      "user",
      formatReferralSourceAnswer({
        source: answers.referralSource,
        other: answers.referralOther,
      })
    );
  }
  return out;
}

function matchCustomText(
  question: ChatQuestionId,
  text: string,
  pendingKind: PendingInput
):
  | { ok: true; label: string; apply: Partial<AnswerPatch>; phase?: "duration" | "triggers" | "full" }
  | { ok: false } {
  const t = text.trim().toLowerCase();
  if (!t) return { ok: false };

  if (question === "PROFILE_01") {
    const ageMatch = t.match(/\b(\d{1,3})\b/);
    const age = ageMatch ? parseOnboardingAge(ageMatch[1]) : null;
    let gender: string | null = null;
    for (const g of GENDER_OPTIONS) {
      if (
        t.includes(g.label.toLowerCase()) ||
        t.includes(g.value.replace(/_/g, " "))
      ) {
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
      return { ok: true, label: String(age), apply: { ageInput: String(age) } };
    }
    if (gender) {
      return { ok: true, label: genderLabel(gender), apply: { gender } };
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

  if (question === "DUR_TRIG" && pendingKind?.kind === "duration") {
    let duration: ConcernDuration | null = null;
    if (t.includes("under") || t.includes("recent") || t.includes("3 month"))
      duration = "recent";
    else if (t.includes("over") || t.includes("year") || t.includes("chronic"))
      duration = "chronic";
    else if (t.includes("month") || t.includes("ongoing")) duration = "ongoing";
    if (!duration) return { ok: false };
    return {
      ok: true,
      label: durationLabel(duration),
      apply: { duration },
      phase: "duration",
    };
  }

  if (question === "DUR_TRIG" && pendingKind?.kind === "triggers") {
    const found: string[] = [];
    for (const opt of ONBOARDING_CHAT_TRIGGER_OPTIONS) {
      if (t.includes(opt.label.toLowerCase().split(" ")[0]!) || t.includes(opt.id)) {
        found.push(opt.id);
      }
    }
    if (t.includes("hormone") || t.includes("pcos")) found.push("hormonal");
    if (t.includes("diet") || t.includes("food")) found.push("diet");
    if (t.includes("stress") || t.includes("sleep")) found.push("stress");
    if (t.includes("sun") || t.includes("pollution") || t.includes("environment"))
      found.push("environmental");
    if (t.includes("product") || t.includes("ingredient")) found.push("products");
    if (t.includes("not sure") || t.includes("unsure") || t.includes("don't know"))
      found.push("unsure");
    const unique = [...new Set(found)];
    if (unique.length === 0) return { ok: false };
    return {
      ok: true,
      label: triggerLabelList(unique),
      apply: { triggers: unique },
      phase: "triggers",
    };
  }

  if (question === "SKIN_TYPE") {
    const hit = ONBOARDING_CHAT_SKIN_TYPES.find((s) =>
      t.includes(s.toLowerCase())
    );
    if (!hit) return { ok: false };
    return { ok: true, label: hit, apply: { skinType: hit } };
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
    else if (
      t.includes("sometimes") ||
      t.includes("moderate") ||
      t.includes("occasionally")
    )
      sensitivity = "moderate";
    else if (
      t.includes("not") ||
      t.includes("no") ||
      t.includes("low") ||
      t.includes("rarely")
    )
      sensitivity = "low";
    if (!sensitivity) return { ok: false };
    return {
      ok: true,
      label: SENSITIVITY_OPTIONS.find((o) => o.value === sensitivity)!.label,
      apply: { sensitivity },
    };
  }

  if (question === "REF_01") {
    for (const opt of REFERRAL_SOURCE_OPTIONS) {
      if (t.includes(opt.label.toLowerCase()) || t.includes(opt.id.replace(/_/g, " "))) {
        if (opt.id === "other") {
          const other = text.trim();
          if (other.length < 3) return { ok: false };
          return {
            ok: true,
            label: formatReferralSourceAnswer({ source: "other", other }),
            apply: { referralSource: "other", referralOther: other },
          };
        }
        return {
          ok: true,
          label: opt.label,
          apply: { referralSource: opt.id, referralOther: "" },
        };
      }
    }
    if (t.length >= 3) {
      return {
        ok: true,
        label: formatReferralSourceAnswer({ source: "other", other: text.trim() }),
        apply: { referralSource: "other", referralOther: text.trim() },
      };
    }
  }

  return { ok: false };
}

function KaiAvatar() {
  return (
    <div
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1E1B31] text-[10px] font-bold tracking-tight text-white"
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
          ? "border-[#1E1B31] bg-[#1E1B31] text-white"
          : "border-zinc-300 bg-white text-zinc-800 hover:border-[#1E1B31]/40"
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
  const [duration, setDuration] = useState<ConcernDuration | null>(null);
  const [triggers, setTriggers] = useState<string[]>([]);
  const [skinType, setSkinType] = useState<OnboardingChatSkinType | null>(null);
  const [sensitivity, setSensitivity] = useState<SkinSensitivity | null>(null);
  const [referralSource, setReferralSource] = useState<ReferralSourceId | null>(
    null
  );
  const [referralOther, setReferralOther] = useState("");

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [pendingInput, setPendingInput] = useState<PendingInput>(null);
  const [chatIndex, setChatIndex] = useState(0);
  const [pendingConcerns, setPendingConcerns] = useState<OnboardingConcernId[]>(
    []
  );
  const [pendingTriggers, setPendingTriggers] = useState<string[]>([]);
  const [draftAge, setDraftAge] = useState("");
  const [draftReferralOther, setDraftReferralOther] = useState("");
  const [customText, setCustomText] = useState("");
  const [interactionLocked, setInteractionLocked] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const timersRef = useRef<number[]>([]);

  const fieldsRef = useRef({
    ageInput,
    gender,
    concerns,
    duration,
    triggers,
    skinType,
    sensitivity,
    referralSource,
    referralOther,
    chatIndex,
  });
  fieldsRef.current = {
    ageInput,
    gender,
    concerns,
    duration,
    triggers,
    skinType,
    sensitivity,
    referralSource,
    referralOther,
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
        else if (step >= 12) setChatIndex(6);
        else setChatIndex(0);
      },
      setAgeInput,
      setGender,
      setConcerns: (value: OnboardingConcernId[]) => setConcerns(value),
      setOverallSkinHealth: () => {},
      setSeverity: () => {},
      setDuration: (value: string | null) =>
        setDuration(
          value === "recent" || value === "ongoing" || value === "chronic"
            ? value
            : null
        ),
      setTriggers,
      setPriorTx: () => {},
      setTxText: () => {},
      setTxDur: () => {},
      setSensitivity: (value: string | null) =>
        setSensitivity(
          value === "low" || value === "moderate" || value === "high"
            ? value
            : null
        ),
      setSleep: () => {},
      setWater: () => {},
      setDiet: () => {},
      setSun: () => {},
      setSkinType: (value: string | null) =>
        setSkinType(
          value &&
            (ONBOARDING_CHAT_SKIN_TYPES as readonly string[]).includes(value)
            ? (value as OnboardingChatSkinType)
            : null
        ),
      setReferralSource: (value: string | null) =>
        setReferralSource(
          value && isReferralSourceId(value) ? value : null
        ),
      setReferralOther,
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
      severity: "moderate",
      duration:
        patch.duration !== undefined ? patch.duration : base.duration,
      triggers: patch.triggers ?? base.triggers,
      priorTx: "no",
      txText: "",
      txDur: "",
      sensitivity:
        patch.sensitivity !== undefined ? patch.sensitivity : base.sensitivity,
      sleep: "7to8",
      water: "1to1_5l",
      diet: "mixed",
      sun: "moderate",
      skinType:
        patch.skinType !== undefined ? patch.skinType : base.skinType,
      referralSource:
        patch.referralSource !== undefined
          ? patch.referralSource
          : base.referralSource,
      referralOther:
        patch.referralOther !== undefined
          ? patch.referralOther
          : base.referralOther,
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
    duration,
    triggers,
    skinType,
    sensitivity,
    referralSource,
    referralOther,
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
        message = "Got it - thanks for sharing.";
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

  const snapshotFromFields = useCallback((): AnswerSnapshot => {
    const f = fieldsRef.current;
    return {
      ageInput: f.ageInput,
      gender: f.gender,
      concerns: f.concerns,
      duration: f.duration,
      triggers: f.triggers,
      skinType: f.skinType,
      sensitivity: f.sensitivity,
      referralSource: f.referralSource,
      referralOther: f.referralOther,
    };
  }, []);

  const askQuestion = useCallback(
    (index: number, answers: AnswerSnapshot, kaiMessage?: string) => {
      setChatIndex(index);

      if (index >= CHAT_QUESTIONS.length) {
        const body = buildSummaryText(answers);
        const summary = kaiMessage ? `${kaiMessage}\n\n${body}` : body;
        pushKaiThen(summary, () => setPendingInput({ kind: "summary" }));
        return;
      }

      const q = CHAT_QUESTIONS[index]!;
      const text =
        kaiMessage?.trim() ||
        onboardingChatNextQuestionText(q, {
          concerns: answers.concerns,
          duration: answers.duration,
          triggers: answers.triggers,
          skinType: answers.skinType,
        });

      pushKaiThen(text, () => {
        if (q === "CONCERN_01") setPendingConcerns([]);
        if (q === "PROFILE_01") setDraftAge(fieldsRef.current.ageInput);
        if (q === "DUR_TRIG") {
          if (answers.duration && answers.triggers.length === 0) {
            setPendingTriggers([]);
            setPendingInput({ kind: "triggers" });
            return;
          }
          setPendingTriggers([]);
        }
        if (q === "REF_01") setDraftReferralOther(fieldsRef.current.referralOther);
        setPendingInput(pendingKindForQuestion(q));
      });
    },
    [pushKaiThen]
  );

  useEffect(() => {
    if (!draftReady || bootStartedRef.current) return;
    bootStartedRef.current = true;

    const snapshot = snapshotFromFields();
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
      pushKaiThen(buildSummaryText(snapshot), () =>
        setPendingInput({ kind: "summary" })
      );
      return;
    }

    const history = buildHistoryMessages(snapshot);
    setMessages(history);
    setPendingConcerns(snapshot.concerns);
    setPendingTriggers(snapshot.triggers);
    setDraftAge(snapshot.ageInput);
    setDraftReferralOther(snapshot.referralOther);
    askQuestion(incomplete, snapshot);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftReady]);

  function formState(): OnboardingQuestionnaireFormState {
    return {
      ageInput,
      gender,
      concerns,
      overallSkinHealth: "need_improve",
      severity: "moderate",
      duration,
      triggers,
      priorTx: "no",
      txText: "",
      txDur: "",
      sensitivity,
      sleep: "7to8",
      water: "1to1_5l",
      diet: "mixed",
      sun: "moderate",
      skinType,
      referralSource,
      referralOther,
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
      try {
        sessionStorage.removeItem(KAI_ACK_CACHE_KEY);
      } catch {
        /* */
      }
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
    if (patch.duration !== undefined) {
      setDuration(patch.duration);
      fieldsRef.current.duration = patch.duration;
    }
    if (patch.triggers !== undefined) {
      setTriggers(patch.triggers);
      fieldsRef.current.triggers = patch.triggers;
    }
    if (patch.skinType !== undefined) {
      setSkinType(patch.skinType);
      fieldsRef.current.skinType = patch.skinType;
    }
    if (patch.sensitivity !== undefined) {
      setSensitivity(patch.sensitivity);
      fieldsRef.current.sensitivity = patch.sensitivity;
    }
    if (patch.referralSource !== undefined) {
      setReferralSource(patch.referralSource);
      fieldsRef.current.referralSource = patch.referralSource;
    }
    if (patch.referralOther !== undefined) {
      setReferralOther(patch.referralOther);
      fieldsRef.current.referralOther = patch.referralOther;
    }
  }

  function currentPreviousAnswers(): Record<string, unknown> {
    const f = fieldsRef.current;
    return {
      age: parseOnboardingAge(f.ageInput),
      gender: f.gender,
      concerns: f.concerns,
      duration: f.duration,
      triggers: f.triggers,
      skinType: f.skinType,
      sensitivity: f.sensitivity,
      referralSource: f.referralSource,
      referralOther: f.referralOther,
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
    if (q === "DUR_TRIG") setPendingTriggers([]);
    if (q === "REF_01") setDraftReferralOther(fieldsRef.current.referralOther);
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

    const nextAnswers = snapshotFromFields();
    const nextQuestionId = CHAT_QUESTIONS[nextIndex] ?? null;
    const nextQuestionText = nextQuestionId
      ? onboardingChatNextQuestionText(nextQuestionId, {
          concerns: nextAnswers.concerns,
          duration: nextAnswers.duration,
          triggers: nextAnswers.triggers,
          skinType: nextAnswers.skinType,
        })
      : "";

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
    appendUser(`${age} · ${genderLabel(nextGender)}`);
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

  function completeDuration(value: ConcernDuration) {
    if (interactionLocked) return;
    const previousAnswers = currentPreviousAnswers();
    appendUser(durationLabel(value));
    setPendingInput(null);
    applyAnswerPatch({ duration: value });
    persistDraft({ duration: value, step: 4 });

    void revealKaiMessage(
      () =>
        fetchKaiChatResponse({
          questionId: "DUR_TRIG",
          answer: { phase: "duration", duration: value },
          previousAnswers,
          nextQuestionText: onboardingChatTriggersAsk(),
        }),
      () => {
        setPendingTriggers([]);
        setPendingInput({ kind: "triggers" });
      }
    );
  }

  function completeTriggers(next: string[]) {
    if (interactionLocked || next.length === 0) return;
    const dur = fieldsRef.current.duration;
    appendUser(triggerLabelList(next));
    setPendingInput(null);
    advanceAfterAnswer(
      "DUR_TRIG",
      { duration: dur, triggers: next },
      3,
      { triggers: next }
    );
  }

  function completeSkinType(value: OnboardingChatSkinType) {
    if (interactionLocked) return;
    appendUser(value);
    setPendingInput(null);
    advanceAfterAnswer("SKIN_TYPE", value, 4, { skinType: value });
  }

  function completeSensitivity(value: SkinSensitivity) {
    if (interactionLocked) return;
    appendUser(SENSITIVITY_OPTIONS.find((o) => o.value === value)!.label);
    setPendingInput(null);
    advanceAfterAnswer("SENS_01", value, 5, { sensitivity: value });
  }

  function completeReferral(source: ReferralSourceId, other = "") {
    if (interactionLocked) return;
    if (source === "other" && other.trim().length < 3) return;
    appendUser(formatReferralSourceAnswer({ source, other }));
    setPendingInput(null);
    advanceAfterAnswer(
      "REF_01",
      { source, other: other.trim() },
      6,
      {
        referralSource: source,
        referralOther: source === "other" ? other.trim() : "",
      }
    );
  }

  function handleCustomSend() {
    if (interactionLocked || !pendingInput || pendingInput.kind === "summary")
      return;
    const text = customText.trim();
    if (!text) return;

    const q = CHAT_QUESTIONS[chatIndex];
    if (!q) return;

    // Referral "Other" details can be typed in the bottom field when Other is selected
    if (pendingInput.kind === "referral" && referralSource === "other") {
      setCustomText("");
      completeReferral("other", text);
      return;
    }

    const matched = matchCustomText(q, text, pendingInput);
    setCustomText("");

    if (!matched.ok) {
      appendUser(text);
      pushKaiThen(
        "Got it - could you tap one of the options below so I can log it correctly?",
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
    if (q === "DUR_TRIG" && matched.phase === "duration" && apply.duration) {
      // undo appendUser above path - completeDuration also appends; we already appended
      // so call the mid-turn flow without double-appending
      const previousAnswers = currentPreviousAnswers();
      applyAnswerPatch({ duration: apply.duration });
      persistDraft({ duration: apply.duration, step: 4 });
      void revealKaiMessage(
        () =>
          fetchKaiChatResponse({
            questionId: "DUR_TRIG",
            answer: { phase: "duration", duration: apply.duration },
            previousAnswers,
            nextQuestionText: onboardingChatTriggersAsk(),
          }),
        () => {
          setPendingTriggers([]);
          setPendingInput({ kind: "triggers" });
        }
      );
      return;
    }
    if (q === "DUR_TRIG" && apply.triggers) {
      advanceAfterAnswer(
        "DUR_TRIG",
        { duration: fieldsRef.current.duration, triggers: apply.triggers },
        3,
        apply
      );
      return;
    }
    if (q === "SKIN_TYPE" && apply.skinType) {
      advanceAfterAnswer("SKIN_TYPE", apply.skinType, 4, apply);
      return;
    }
    if (q === "SENS_01" && apply.sensitivity) {
      advanceAfterAnswer("SENS_01", apply.sensitivity, 5, apply);
      return;
    }
    if (q === "REF_01" && apply.referralSource) {
      advanceAfterAnswer(
        "REF_01",
        {
          source: apply.referralSource,
          other: apply.referralOther ?? "",
        },
        6,
        apply
      );
    }
  }

  const optionsDisabled = interactionLocked || isTyping;

  return (
    <div className="flex h-full max-h-full w-full flex-col bg-[#F0F0F0]">
      <header className="flex shrink-0 items-center gap-3 border-b border-zinc-200/80 bg-[#1E1B31] px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-white shadow-sm">
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
                      className="w-20 rounded-full border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-[#1E1B31]"
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
                    className="self-start rounded-full bg-[#1E1B31] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
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
                    className="self-start rounded-full bg-[#1E1B31] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                  >
                    Done
                  </button>
                </>
              ) : null}

              {pendingInput.kind === "duration" ? (
                <div className="flex flex-wrap gap-2">
                  {ONBOARDING_CHAT_DURATION_OPTIONS.map((opt) => (
                    <Pill
                      key={opt.id}
                      disabled={optionsDisabled}
                      onClick={() => completeDuration(opt.id)}
                    >
                      {opt.label}
                    </Pill>
                  ))}
                </div>
              ) : null}

              {pendingInput.kind === "triggers" ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    {ONBOARDING_CHAT_TRIGGER_OPTIONS.map((opt) => (
                      <Pill
                        key={opt.id}
                        active={pendingTriggers.includes(opt.id)}
                        disabled={optionsDisabled}
                        onClick={() =>
                          setPendingTriggers((cur) =>
                            cur.includes(opt.id)
                              ? cur.filter((x) => x !== opt.id)
                              : [...cur, opt.id]
                          )
                        }
                      >
                        {opt.label}
                      </Pill>
                    ))}
                  </div>
                  <button
                    type="button"
                    disabled={optionsDisabled || pendingTriggers.length === 0}
                    onClick={() => completeTriggers(pendingTriggers)}
                    className="self-start rounded-full bg-[#1E1B31] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                  >
                    Done
                  </button>
                </>
              ) : null}

              {pendingInput.kind === "skinType" ? (
                <div className="flex flex-wrap gap-2">
                  {ONBOARDING_CHAT_SKIN_TYPES.map((type) => (
                    <Pill
                      key={type}
                      disabled={optionsDisabled}
                      onClick={() => completeSkinType(type)}
                    >
                      {type}
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

              {pendingInput.kind === "referral" ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    {REFERRAL_SOURCE_OPTIONS.map((opt) => (
                      <Pill
                        key={opt.id}
                        active={referralSource === opt.id}
                        disabled={optionsDisabled}
                        onClick={() => {
                          setReferralSource(opt.id);
                          if (opt.id !== "other") {
                            completeReferral(opt.id);
                          } else {
                            setDraftReferralOther(referralOther);
                          }
                        }}
                      >
                        {opt.label}
                      </Pill>
                    ))}
                  </div>
                  {referralSource === "other" ? (
                    <div className="flex flex-col gap-2">
                      <input
                        type="text"
                        value={draftReferralOther}
                        disabled={optionsDisabled}
                        placeholder="Tell us how you heard about us"
                        onChange={(e) => setDraftReferralOther(e.target.value)}
                        className="w-full max-w-sm rounded-full border border-zinc-300 bg-white px-3.5 py-2 text-sm text-zinc-900 outline-none focus:border-[#1E1B31]"
                      />
                      <button
                        type="button"
                        disabled={
                          optionsDisabled || draftReferralOther.trim().length < 3
                        }
                        onClick={() =>
                          completeReferral("other", draftReferralOther)
                        }
                        className="self-start rounded-full bg-[#1E1B31] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                      >
                        Continue
                      </button>
                    </div>
                  ) : null}
                </>
              ) : null}

              {pendingInput.kind === "summary" ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void submit()}
                  className="self-start rounded-full bg-[#1E1B31] px-5 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
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
            className="min-w-0 flex-1 rounded-full border border-zinc-200 bg-white px-4 py-2.5 text-[15px] text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-[#1E1B31]/40 disabled:opacity-50"
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
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1E1B31] text-white disabled:opacity-40"
          >
            <Send className="h-4 w-4" aria-hidden />
          </button>
        </form>
      </div>
    </div>
  );
}
