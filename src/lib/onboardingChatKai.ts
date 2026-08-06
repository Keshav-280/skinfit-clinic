import OpenAI from "openai";
import {
  ONBOARDING_CONCERN_LABELS,
  formatOnboardingConcernLabels,
  primaryOnboardingConcern,
  type OnboardingConcernId,
} from "@/src/lib/onboardingConcerns";
import type {
  BaselineDietType,
  BaselineSleep,
  SkinSensitivity,
} from "@/src/lib/onboardingQuestionnaireDefaults";

export const ONBOARDING_CHAT_SYSTEM_PROMPT =
  "You are kAI, a friendly and knowledgeable AI skin advisor at SkinFit Wellness. You're chatting with a new patient during onboarding. Respond in 1-2 short sentences acknowledging their answer naturally, like a caring friend who happens to be a skin expert. Be warm but professional. Never use emojis. Then transition naturally to introduce the next question (provided in the prompt). Don't repeat what they said back verbatim.";

export type OnboardingChatQuestionId =
  | "PROFILE_01"
  | "CONCERN_01"
  | "SEV_01"
  | "LIFE_01"
  | "LIFE_02b"
  | "SENS_01";

export const ONBOARDING_CHAT_QUESTION_ORDER: OnboardingChatQuestionId[] = [
  "PROFILE_01",
  "CONCERN_01",
  "SEV_01",
  "LIFE_01",
  "LIFE_02b",
  "SENS_01",
];

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

function severityAsk(concerns: OnboardingConcernId[]): string {
  const c = primaryOnboardingConcern(concerns);
  const map: Record<OnboardingConcernId, string> = {
    acne: "Got it. On a scale, how bad would you say the breakouts have been?",
    pigmentation: "Got it. On a scale, how noticeable is the uneven tone?",
    ageing: "Got it. On a scale, how visible are the signs of ageing?",
    hair: "Got it. On a scale, how significant is the hair loss?",
    general: "Got it. On a scale, how bad would you say it's been?",
  };
  return map[c];
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
  if (nextQuestionId === "SEV_01") {
    return severityAsk(asConcerns(previousAnswers.concerns));
  }
  if (nextQuestionId === "LIFE_01") {
    return "Quick lifestyle check — how many hours do you usually sleep?";
  }
  if (nextQuestionId === "LIFE_02b") {
    return "And what does your diet mostly look like?";
  }
  return "Last one — does your skin react easily to new products or weather changes?";
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
  if (questionId === "SEV_01" && typeof answer === "string") {
    return answer;
  }
  if (questionId === "LIFE_01") {
    const map: Record<string, string> = {
      under5: "Under 5 hours",
      "5to6": "5–6 hours",
      "7to8": "7–8 hours",
      "8plus": "8+ hours",
    };
    return typeof answer === "string" ? map[answer] ?? answer : String(answer);
  }
  if (questionId === "LIFE_02b") {
    const map: Record<string, string> = {
      vegetarian: "Vegetarian",
      vegan: "Vegan",
      nonveg: "Non-vegetarian",
      mixed: "Mixed / flexible",
    };
    return typeof answer === "string" ? map[answer] ?? answer : String(answer);
  }
  if (questionId === "SENS_01") {
    const map: Record<string, string> = {
      low: "Not really",
      moderate: "Sometimes",
      high: "Yes, very easily",
    };
    return typeof answer === "string" ? map[answer] ?? answer : String(answer);
  }
  if (typeof answer === "string") return answer;
  try {
    return JSON.stringify(answer);
  } catch {
    return String(answer);
  }
}

/** Hardcoded Pass-1 acknowledgments only (no next-question text). */
export function onboardingChatFallbackAck(
  questionId: string,
  answer: unknown,
  previousAnswers: Record<string, unknown> = {}
): string {
  if (questionId === "PROFILE_01" && answer && typeof answer === "object") {
    const a = answer as { age?: unknown; gender?: unknown };
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

  if (questionId === "SEV_01") {
    const sev = typeof answer === "string" ? answer : "";
    if (sev === "mild") return "Okay, mild for now — good to catch it early.";
    if (sev === "moderate")
      return "Moderate range — that's useful context for your plan.";
    if (sev === "severe")
      return "Sounds like it's been pretty tough. We'll keep the approach careful and targeted.";
    return "Thanks — that severity context helps.";
  }

  if (questionId === "LIFE_01") {
    const sleep = typeof answer === "string" ? (answer as BaselineSleep) : null;
    if (sleep === "under5")
      return "Under 5 hours is rough on skin repair — we'll keep that in mind.";
    if (sleep === "5to6")
      return "5–6 hours — okay, room to improve for recovery.";
    if (sleep === "7to8") return "Nice, 7–8 hours is solid for skin recovery.";
    if (sleep === "8plus") return "8+ hours — excellent for overnight repair.";
    return "Thanks — sleep is a big piece of skin recovery.";
  }

  if (questionId === "LIFE_02b") {
    const diet = typeof answer === "string" ? (answer as BaselineDietType) : null;
    const labels: Record<BaselineDietType, string> = {
      vegetarian: "Vegetarian — noted.",
      vegan: "Vegan — noted.",
      nonveg: "Non-veg — noted.",
      mixed: "Mixed diet — noted.",
    };
    if (diet && labels[diet]) {
      return `${labels[diet]} Nutrition quietly shapes how skin behaves.`;
    }
    return "Thanks — diet context noted.";
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
      ...(input.questionId === "SEV_01"
        ? { severity: input.answer }
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
