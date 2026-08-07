import OpenAI from "openai";
import {
  ONBOARDING_CONCERN_LABELS,
  formatOnboardingConcernLabels,
  primaryOnboardingConcern,
  type OnboardingConcernId,
} from "@/src/lib/onboardingConcerns";
import type {
  ConcernDuration,
  SkinSensitivity,
} from "@/src/lib/onboardingQuestionnaireDefaults";
import {
  formatReferralSourceAnswer,
  referralSourceLabel,
  type ReferralSourceId,
} from "@/src/lib/onboardingReferralSource";

export const ONBOARDING_CHAT_SYSTEM_PROMPT = `You are kAI, an AI skin advisor at SkinFit Wellness chatting with a new patient during onboarding.

Rules:
- Write 1-2 SHORT sentences max. Be concise like a text message, not an essay.
- Sound like a real person texting — casual, direct, no filler. Use contractions.
- NEVER start with "That's great", "That's good", "I appreciate", "Thank you for sharing", "Thanks for letting me know", or any generic praise. Jump straight into a specific observation or reaction.
- NEVER use emojis.
- Reference something specific about their answer — don't give a response that could apply to any answer.
- Then transition into the next question naturally (provided in the prompt). Paraphrase it slightly so it doesn't sound scripted.
- Don't repeat their answer back to them.

Bad examples (DO NOT write like this):
- "That's great! I appreciate you sharing that."
- "Thank you for letting me know. It's good that you're aware of this."

Good examples:
- "Acne since your teens — pretty common, and honestly one of the easier things to get under control."
- "Hormonal flares track with a lot of patients — we'll keep that on the radar."
- "Combination skin is common — means we balance oil and dryness instead of treating one extreme."`;

export type OnboardingChatQuestionId =
  | "PROFILE_01"
  | "CONCERN_01"
  | "DUR_TRIG"
  | "SKIN_TYPE"
  | "SENS_01"
  | "REF_01";

export const ONBOARDING_CHAT_QUESTION_ORDER: OnboardingChatQuestionId[] = [
  "PROFILE_01",
  "CONCERN_01",
  "DUR_TRIG",
  "SKIN_TYPE",
  "SENS_01",
  "REF_01",
];

export const ONBOARDING_CHAT_TRIGGER_OPTIONS: ReadonlyArray<{
  id: string;
  label: string;
}> = [
  { id: "hormonal", label: "Hormonal (cycle, PCOS, pregnancy)" },
  { id: "diet", label: "Diet" },
  { id: "stress", label: "Stress & poor sleep" },
  { id: "environmental", label: "Environment (sun, pollution, humidity)" },
  { id: "products", label: "Products or ingredients" },
  { id: "unsure", label: "Not sure" },
];

export const ONBOARDING_CHAT_DURATION_OPTIONS: ReadonlyArray<{
  id: ConcernDuration;
  label: string;
}> = [
  { id: "recent", label: "Under 3 months" },
  { id: "ongoing", label: "3 months to 1 year" },
  { id: "chronic", label: "Over 1 year" },
];

export const ONBOARDING_CHAT_SKIN_TYPES = [
  "Dry",
  "Oily",
  "Combination",
  "Normal",
  "Sensitive",
] as const;

export type OnboardingChatSkinType =
  (typeof ONBOARDING_CHAT_SKIN_TYPES)[number];

let cachedClient: OpenAI | null = null;

function getClient(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;
  if (cachedClient) return cachedClient;
  cachedClient = new OpenAI({ apiKey: key });
  return cachedClient;
}

function chatModel() {
  return process.env.OPENAI_CHAT_MODEL?.trim() || "gpt-4o-mini";
}

function asConcerns(value: unknown): OnboardingConcernId[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (x): x is OnboardingConcernId =>
      typeof x === "string" && x in ONBOARDING_CONCERN_LABELS
  );
}

/** Concern-adapted duration question (copyForConcern-style). */
export function onboardingChatDurationAsk(
  concerns: readonly OnboardingConcernId[] = []
): string {
  const c = primaryOnboardingConcern(concerns);
  const map: Record<OnboardingConcernId, string> = {
    acne: "How long have you been dealing with breakouts?",
    pigmentation: "How long have you had pigmentation?",
    ageing: "When did you first notice these signs of ageing?",
    hair: "When did you notice hair loss starting?",
    general: "How long have you been dealing with this?",
  };
  return map[c];
}

export function onboardingChatTriggersAsk(): string {
  return "And do you notice anything that makes it worse?";
}

function durationLabel(id: string): string {
  return (
    ONBOARDING_CHAT_DURATION_OPTIONS.find((o) => o.id === id)?.label ?? id
  );
}

function triggerLabels(ids: unknown): string {
  if (!Array.isArray(ids)) return "";
  return ids
    .filter((x): x is string => typeof x === "string")
    .map(
      (id) =>
        ONBOARDING_CHAT_TRIGGER_OPTIONS.find((o) => o.id === id)?.label ?? id
    )
    .join(", ");
}

/** Plain next-question copy (no acknowledgment). */
export function onboardingChatNextQuestionText(
  nextQuestionId: OnboardingChatQuestionId | null,
  previousAnswers: Record<string, unknown> = {}
): string {
  if (!nextQuestionId) return "";
  if (nextQuestionId === "PROFILE_01") {
    return "Hey! Before we get started, tell me a bit about yourself — how old are you and how do you identify?";
  }
  if (nextQuestionId === "CONCERN_01") {
    return "So what's been bugging you about your skin lately? Pick everything that applies.";
  }
  if (nextQuestionId === "DUR_TRIG") {
    return onboardingChatDurationAsk(asConcerns(previousAnswers.concerns));
  }
  if (nextQuestionId === "SKIN_TYPE") {
    return "What would you say your skin type is?";
  }
  if (nextQuestionId === "SENS_01") {
    return "Does your skin react easily to new products or weather changes?";
  }
  return "One last thing — how did you hear about SkinFit?";
}

export function onboardingChatQuestionAfter(
  questionId: string
): OnboardingChatQuestionId | null {
  const ix = ONBOARDING_CHAT_QUESTION_ORDER.indexOf(
    questionId as OnboardingChatQuestionId
  );
  if (ix < 0) return null;
  return ONBOARDING_CHAT_QUESTION_ORDER[ix + 1] ?? null;
}

function genderLabel(value: string): string {
  const map: Record<string, string> = {
    female: "Female",
    male: "Male",
    other: "Other",
    prefer_not_say: "Prefer not to say",
  };
  return map[value] ?? value;
}

function formatAnswerLabel(questionId: string, answer: unknown): string {
  if (questionId === "PROFILE_01" && answer && typeof answer === "object") {
    const a = answer as { age?: unknown; gender?: unknown };
    const age = a.age != null ? String(a.age) : "";
    const gender =
      typeof a.gender === "string" ? genderLabel(a.gender) : "";
    return [age, gender].filter(Boolean).join(" · ");
  }
  if (questionId === "CONCERN_01") {
    return formatOnboardingConcernLabels(asConcerns(answer));
  }
  if (questionId === "DUR_TRIG" && answer && typeof answer === "object") {
    const a = answer as { duration?: unknown; triggers?: unknown; phase?: string };
    if (a.phase === "duration" || (a.duration && !a.triggers)) {
      return typeof a.duration === "string" ? durationLabel(a.duration) : "";
    }
    const dur =
      typeof a.duration === "string" ? durationLabel(a.duration) : "";
    const trig = triggerLabels(a.triggers);
    return [dur, trig].filter(Boolean).join(" · ");
  }
  if (questionId === "SKIN_TYPE" && typeof answer === "string") {
    return answer;
  }
  if (questionId === "SENS_01") {
    const map: Record<string, string> = {
      low: "Not really",
      moderate: "Sometimes",
      high: "Yes, very easily",
    };
    return typeof answer === "string" ? map[answer] ?? answer : String(answer);
  }
  if (questionId === "REF_01" && answer && typeof answer === "object") {
    const a = answer as { source?: string; other?: string };
    if (typeof a.source === "string") {
      return formatReferralSourceAnswer({
        source: a.source as ReferralSourceId,
        other: a.other,
      });
    }
  }
  if (typeof answer === "string") return answer;
  try {
    return JSON.stringify(answer);
  } catch {
    return String(answer);
  }
}

/** Hardcoded acknowledgments only (no next-question text). */
export function onboardingChatFallbackAck(
  questionId: string,
  answer: unknown,
  previousAnswers: Record<string, unknown> = {}
): string {
  if (questionId === "PROFILE_01" && answer && typeof answer === "object") {
    const label = formatAnswerLabel(questionId, answer);
    if (label) return `Thanks — ${label}.`;
    return "Thanks for sharing that.";
  }

  if (questionId === "CONCERN_01") {
    const concerns = asConcerns(answer);
    const primary = primaryOnboardingConcern(concerns);
    const tips: Record<OnboardingConcernId, string> = {
      acne: "Acne, got it — that's actually really common and super treatable.",
      pigmentation:
        "Pigmentation noted — with consistency, tone can even out nicely.",
      ageing:
        "Ageing concerns noted — we can focus on prevention and repair together.",
      hair: "Hair and scalp — got it. We'll factor that into your plan.",
      general: "General skin health — perfect place to start.",
    };
    if (concerns.length === 1) return tips[primary];
    if (concerns.length > 1) {
      return `${formatOnboardingConcernLabels(concerns)} — got it. We'll keep all of that in mind.`;
    }
    return "Got it — thanks for sharing what you're dealing with.";
  }

  if (questionId === "DUR_TRIG" && answer && typeof answer === "object") {
    const a = answer as {
      duration?: unknown;
      triggers?: unknown;
      phase?: string;
    };
    if (a.phase === "duration" || (a.duration && a.triggers == null)) {
      const dur = typeof a.duration === "string" ? a.duration : "";
      if (dur === "recent") return "Under 3 months — still early, good timing.";
      if (dur === "ongoing") return "A few months in — enough history to spot patterns.";
      if (dur === "chronic")
        return "Over a year — we'll treat this as something that needs a steady plan.";
      return "Got the timeline.";
    }
    const triggers = Array.isArray(a.triggers) ? a.triggers : [];
    if (triggers.includes("unsure") && triggers.length === 1) {
      return "Not sure is fine — we'll learn more from your routine and scans.";
    }
    if (triggers.includes("hormonal")) {
      return "Hormonal triggers noted — that changes how we pace treatment.";
    }
    if (triggers.includes("stress")) {
      return "Stress and sleep often show up on skin — useful to know.";
    }
    return "Triggers noted — that helps narrow what to watch.";
  }

  if (questionId === "SKIN_TYPE" && typeof answer === "string") {
    if (answer === "Dry") return "Dry skin — we'll prioritize barrier support.";
    if (answer === "Oily") return "Oily skin — we'll keep oil control in the mix.";
    if (answer === "Combination")
      return "Combination skin is common — balance over extremes.";
    if (answer === "Sensitive")
      return "Sensitive type — we'll keep the routine gentle.";
    return "Normal skin — solid baseline to work from.";
  }

  if (questionId === "SENS_01") {
    const s = typeof answer === "string" ? (answer as SkinSensitivity) : null;
    if (s === "low")
      return "Okay, not very reactive — that gives us more product flexibility.";
    if (s === "moderate")
      return "Sometimes reactive — we'll introduce actives carefully.";
    if (s === "high")
      return "Okay, sensitive skin — we'll keep that in mind when building your routine.";
    return "Thanks — we'll keep sensitivity in mind.";
  }

  if (questionId === "REF_01" && answer && typeof answer === "object") {
    const a = answer as { source?: string; other?: string };
    if (typeof a.source === "string") {
      if (a.source === "other" && a.other?.trim()) {
        return "Got it — thanks for telling us how you found SkinFit.";
      }
      return `Nice — ${referralSourceLabel(a.source)} is how a lot of people find us.`;
    }
  }

  void previousAnswers;
  return "Got it — thanks for sharing.";
}

export function onboardingChatFallbackMessage(
  questionId: string,
  answer: unknown,
  previousAnswers: Record<string, unknown>,
  nextQuestionText: string
): string {
  const ack = onboardingChatFallbackAck(questionId, answer, previousAnswers);
  const next = nextQuestionText.trim();
  if (!next) return ack;
  return `${ack} ${next}`;
}

function sanitizeKaiMessage(raw: string, fallback: string): string {
  const cleaned = raw
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, "")
    .replace(/\s+\n/g, "\n")
    .trim();
  if (cleaned.length < 8 || cleaned.length > 600) return fallback;
  return cleaned;
}

export async function generateOnboardingChatResponse(input: {
  questionId: string;
  answer: unknown;
  previousAnswers?: Record<string, unknown>;
  nextQuestionText?: string;
}): Promise<{ message: string; source: "openai" | "fallback" }> {
  const previousAnswers = input.previousAnswers ?? {};
  const nextId = onboardingChatQuestionAfter(input.questionId);
  const nextQuestionText =
    input.nextQuestionText?.trim() ||
    onboardingChatNextQuestionText(nextId, {
      ...previousAnswers,
      ...(input.questionId === "CONCERN_01"
        ? { concerns: input.answer }
        : {}),
      ...(input.questionId === "DUR_TRIG" &&
      input.answer &&
      typeof input.answer === "object"
        ? {
            duration: (input.answer as { duration?: unknown }).duration,
            triggers: (input.answer as { triggers?: unknown }).triggers,
          }
        : {}),
    });

  const fallback = onboardingChatFallbackMessage(
    input.questionId,
    input.answer,
    previousAnswers,
    nextQuestionText
  );

  const client = getClient();
  if (!client) {
    return { message: fallback, source: "fallback" };
  }

  const answerLabel = formatAnswerLabel(input.questionId, input.answer);
  const userPrompt = [
    `The patient just answered question "${input.questionId}".`,
    `Their answer (for context, do not repeat verbatim): ${answerLabel}`,
    `Structured answer JSON: ${JSON.stringify(input.answer)}`,
    `Previous answers so far: ${JSON.stringify(previousAnswers)}`,
    nextQuestionText
      ? `Next question to introduce naturally (paraphrase lightly if needed, but keep the meaning): ${nextQuestionText}`
      : "There is no next question. Only acknowledge briefly in 1 short sentence. Do not summarize their answers and do not ask another question.",
    "Write only the chat message kAI should send next. No quotes, no labels, no markdown.",
  ].join("\n");

  try {
    const completion = await client.chat.completions.create({
      model: chatModel(),
      temperature: 0.7,
      max_tokens: 160,
      messages: [
        { role: "system", content: ONBOARDING_CHAT_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    });
    const content = completion.choices[0]?.message?.content?.trim() ?? "";
    return {
      message: sanitizeKaiMessage(content, fallback),
      source: content ? "openai" : "fallback",
    };
  } catch {
    return { message: fallback, source: "fallback" };
  }
}
