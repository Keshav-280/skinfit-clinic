/**
 * Three-layer pipeline for every patient-facing sentence the AI writes.
 *
 *   Layer 1  an AI writes the text from the patient's data.
 *   Layer 2  a second AI, acting as a strict checker, reads it against the same data and the rules.
 *   Layer 3  code checks what code can check exactly: numbers, forbidden words, finished sentences.
 *
 * If ANY layer finds a problem, the whole thing is written again from the start, and the writer is
 * told exactly what was wrong. After MAX_ATTEMPTS failed rounds nothing is shown: we never fall back
 * to canned text. Accuracy matters more than cost or speed here, so the checker fails closed: if it
 * cannot run, the text is not published.
 */
import OpenAI from "openai";

export type Review = { pass: boolean; issues: string[] };

export const MAX_ATTEMPTS = 4;

let cachedClient: OpenAI | null = null;

export function verifiedClient(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;
  if (!cachedClient) cachedClient = new OpenAI({ apiKey: key });
  return cachedClient;
}

/** Model that writes the text. Accuracy first: a full-size model by default. */
export function writerModel(): string {
  return (
    process.env.OPENAI_REPORT_MODEL?.trim() ||
    process.env.OPENAI_CHAT_MODEL?.trim() ||
    "gpt-4o"
  );
}

/** Model that checks the text. Independent setting so it can be stronger than the writer. */
export function reviewerModel(): string {
  return process.env.OPENAI_REVIEW_MODEL?.trim() || "gpt-4o";
}

/** The rulebook the checker enforces on every kind of text. */
export const REVIEW_RULES = `You are the safety and quality checker for patient-facing text from kAI, the skin companion of SkinFit Wellness, a dermatology clinic in India. Another AI wrote the CANDIDATE. You decide whether it may be shown to a patient. Be strict: when in doubt, fail it.

Fail the candidate if ANY of these is true:
1. It names, suggests, hints at or compares to any illness, disease, syndrome, skin condition or diagnosis (for example rosacea, eczema, melasma, psoriasis, cancer, infection, "a rare disorder"). Describing what is visible in plain words is fine; naming a condition is not.
2. It tells the patient to start, stop, switch, buy or use a medicine, prescription product, strong active ingredient or dose, or gives medical treatment advice. Everyday habits (sleep, water, sunscreen, gentle routine, consistent scanning) are fine.
3. A number, score, date or change in the text is not in the DATA, or is wrong. Every score is "out of 100", never above 90.
4. The direction is wrong. For every score, HIGHER IS BETTER skin. A lower score means worse skin in that area (for Active acne, MORE breakouts); a higher score means clearer skin. It must not call a drop an improvement or a rise a decline, and must not use "declined", "decline", "decreased" or "trending down" for a score.
5. It claims movement the DATA does not support: any change smaller than 3 points is "steady", never improved or dipped; a first scan has no trend; nothing may be claimed as caused by one thing.
6. It copies or quotes reference or textbook text, or mentions a library, textbook, study, article or source.
7. A sentence is cut off, unfinished, repeated, or the text contradicts itself or another part of the candidate.
8. It is cold, mechanical, templated, shaming, alarming, or uses jargon, or it reads as if it were not written about THIS patient. It should sound like a warm, caring clinic coordinator speaking plainly to one person.
9. It gives advice that is unsafe or off-limits for a non-doctor: it must send the patient to the clinic for anything medical or worrying.
10. It contains emojis, exclamation marks, or says anything about internal SkinFit business.

Reply with ONLY JSON: {"pass": true|false, "issues": ["each specific problem, quoting the words"]}. If it passes, issues must be [].`;

/** Layer 2: a strict AI checker. Fails closed: if it cannot run, the text is rejected. */
export async function aiReview(input: {
  kind: string;
  data: unknown;
  candidate: unknown;
  extraRules?: string;
}): Promise<Review> {
  const client = verifiedClient();
  if (!client) return { pass: false, issues: ["checker unavailable"] };
  try {
    const completion = await client.chat.completions.create({
      model: reviewerModel(),
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `${REVIEW_RULES}${input.extraRules ? `\n\nExtra rules for this text:\n${input.extraRules}` : ""}`,
        },
        {
          role: "user",
          content: `KIND OF TEXT: ${input.kind}\n\nDATA THE WRITER WAS GIVEN:\n${JSON.stringify(input.data)}\n\nCANDIDATE:\n${JSON.stringify(input.candidate)}`,
        },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? "";
    const parsed = JSON.parse(raw) as { pass?: unknown; issues?: unknown };
    const issues = Array.isArray(parsed.issues)
      ? parsed.issues.filter((x): x is string => typeof x === "string")
      : [];
    const pass = parsed.pass === true && issues.length === 0;
    return { pass, issues };
  } catch {
    return { pass: false, issues: ["checker failed to run"] };
  }
}

/** Plain-words brief appended to the writer's prompt when a draft was rejected. */
export function feedbackBrief(issues: string[]): string {
  return `YOUR PREVIOUS DRAFT WAS REJECTED. Write the whole thing again from scratch and fix every one of these problems:\n${issues
    .slice(0, 12)
    .map((i) => `- ${i}`)
    .join("\n")}`;
}

/**
 * Runs write -> AI check -> code check until a draft passes everything, up to MAX_ATTEMPTS.
 * Returns null if no draft passed; the caller then shows nothing.
 */
export async function runVerified<T>(opts: {
  name: string;
  maxAttempts?: number;
  generate: (feedback: string[] | null) => Promise<T | null>;
  review: (candidate: T) => Promise<Review>;
  codeCheck: (candidate: T) => string[];
}): Promise<T | null> {
  const max = opts.maxAttempts ?? MAX_ATTEMPTS;
  let feedback: string[] | null = null;
  for (let attempt = 1; attempt <= max; attempt++) {
    const candidate = await opts.generate(feedback);
    if (candidate == null) {
      feedback = ["The previous attempt returned nothing usable. Return the complete JSON."];
      console.warn(`[verified:${opts.name}] attempt ${attempt}: no output`);
      continue;
    }
    const [review, codeIssues] = await Promise.all([
      opts.review(candidate),
      Promise.resolve(opts.codeCheck(candidate)),
    ]);
    if (review.pass && codeIssues.length === 0) {
      if (attempt > 1) console.info(`[verified:${opts.name}] passed on attempt ${attempt}`);
      return candidate;
    }
    feedback = [...review.issues, ...codeIssues];
    console.warn(`[verified:${opts.name}] attempt ${attempt} rejected`, {
      aiChecker: review.issues.slice(0, 4),
      code: codeIssues.slice(0, 4),
    });
  }
  console.error(`[verified:${opts.name}] no draft passed after ${max} attempts; showing nothing`);
  return null;
}
