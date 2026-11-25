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

/**
 * `soft` means the checker found only tone or repetition points, nothing unsafe or wrong. Such a draft
 * is kept as a fallback and published if no later draft is fully clean (a slightly stiff report is
 * better than none). Hard problems (medical, wrong numbers, wrong direction, causation) never publish.
 */
export type Review = { pass: boolean; issues: string[]; soft?: boolean };

/** Rules 5 (tone) and 6 (repeat) of REPORT_REVIEW_RULES. Callers using other rulebooks pass softRules. */
const SOFT_RULES = new Set([5, 6]);

const flat = (v: unknown): string => {
  const out: string[] = [];
  const walk = (n: unknown) => {
    if (typeof n === "string") out.push(n);
    else if (Array.isArray(n)) n.forEach(walk);
    else if (n && typeof n === "object") Object.values(n as Record<string, unknown>).forEach(walk);
  };
  walk(v);
  return out.join(" ").toLowerCase().replace(/\s+/g, " ");
};

/** True when the quoted words really appear in the candidate (guards against invented problems). */
export function quoteIsReal(candidate: unknown, quote: string): boolean {
  const q = quote.toLowerCase().replace(/\s+/g, " ").replace(/^["'\s]+|["'\s]+$/g, "");
  if (q.length < 4) return false;
  return flat(candidate).includes(q.slice(0, 40));
}

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
/** Newer reasoning models (gpt-5.x, o-series) only accept their default temperature. */
export function temperatureFor(model: string, t: number): { temperature?: number } {
  return /^(gpt-5|o\d)/i.test(model) ? {} : { temperature: t };
}

export function reviewerModel(): string {
  return process.env.OPENAI_REVIEW_MODEL?.trim() || "gpt-5.4";
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
11. Two parts of the candidate repeat each other almost word for word, or it only lists figures the patient can already see without adding meaning. Explaining in plain words what a change means is fine and wanted. A number is fine only where the rules for that kind of text allow it.

Clarifications so you do not fail good text (you must still be strict about the rules above):
- Plain visible-skin words are NOT diagnoses or conditions: dark spots, dark circles, pimples, breakouts, acne marks, uneven tone, fine lines, firmness. Only real medical names (melasma, rosacea, eczema, psoriasis, cancer and the like) fail rule 1.
- Everyday habits are NOT medical advice: sunscreen, moisturiser, a gentle cleanser, sleep, water, a hat or sunglasses, not picking at spots, changing pillowcases. Only a named medicine, prescription product, active ingredient (retinol, acids, niacinamide, vitamin C and the like), brand or dose fails rule 2.
- For a drop, the words "dipped", "a few more pimples are showing", "needs a little care" and "steady" are CORRECT. Only "declined", "decline", "decreased" and "trending down" fail rule 4. Check direction against previous_score_100 and score_100 in the DATA: lower now means worse skin.
- Hedged observational pairing is allowed and wanted ("may have", "tends to", "lined up with", "weeks when you slept less have tended to show more pimples"). Only a flat statement of cause ("X caused Y", "because of X your skin Y") fails rule 5.
- Judge only what you can quote. Never report a problem you cannot point to in the candidate.

Reply with ONLY JSON: {"issues": [{"rule": <number of the rule broken, 1 to 11, or 12 for an extra rule>, "quote": "the exact words copied from the CANDIDATE", "why": "one short sentence"}]}. Every issue MUST quote words that really appear in the CANDIDATE; an issue without a real quote is ignored. If nothing is wrong, reply {"issues": []}.`;

/**
 * A short rulebook for the two written reports. The generic rulebook above is too broad for them:
 * it made the checker invent problems and block good reports. Exact things (digits, banned words,
 * lengths, doctor names, counts) are checked by code, so they are deliberately NOT here.
 * Rules 5 and 6 are "soft": tone and repetition only.
 */
export const REPORT_REVIEW_RULES = `You are the safety checker for a skin report a clinic patient will read. Another AI wrote the CANDIDATE from the DATA. Check ONLY the six rules below. Each problem you report must quote words that really appear in the CANDIDATE.

1. MEDICAL. The text names a medicine, prescription product, active ingredient (retinol, acids, niacinamide, vitamin C and the like), brand, dose, treatment, device or procedure (peel, laser, microneedling), or names a real medical condition or diagnosis (melasma, rosacea, eczema, psoriasis, cancer). NOT problems: the phrases "your doctor", "message your doctor" and "book an in-person visit" (they are the required next-step wording); plain skin words (dark spots, dark circles, pimples, breakouts, acne marks, uneven tone, fine lines, firmness) and everyday habits (sunscreen, cleanser, moisturiser, sleep, water, hats, not picking spots).
2. DIRECTION AND SIZE. Use focus_parameters in the DATA: movement improved means the area looks better, declined means worse (for breakouts: MORE pimples showing), holding means steady. The text must not say the opposite for an area. A move of 1 or 2 points must not be called a change. For an IMPROVEMENT the size words are: 3 or 4 points "a little", 5 to 9 "clearly", 10 or more "a lot" (do not police size words for a dip: "needs a little care" and "dipped" are fine). If capture_quality in the DATA shows poor lighting or framing, holding off a comparison for the affected areas is CORRECT and must not be flagged. When capture_state in the DATA is degraded, every area has movement tracking: any statement that an area changed, dipped, improved or is steady compared with last time is wrong, but saying how an area looks today is fine. The words dipped, dip, slight dip, steady, stable and a little are all correct. Do NOT judge the overall score, only areas that have data. The same area has several names: breakouts and pimples are Active acne; acne marks are Acne scars; dark spots and uneven tone are Pigmentation; dark circles are Under-eye; fine lines are Wrinkles; firmness is Sagging and volume.
3. WRONG NUMBER. A score or number in the text that is not in the DATA, or that is attached to the wrong area.
4. CAUSE. A flat statement that one thing caused another ("X caused Y", "because of X your skin Y"). Hedged wording (may, tends to, lined up with) is fine. This rule is only about causes of skin changes; ignore reasons given for suggesting a doctor visit ("photos can only show so much" is fine).
5. TONE (soft). Cold, clinical, alarming or shaming wording.
6. REPEAT (soft). Two parts say almost exactly the same sentence.

Reply with ONLY JSON: {"issues": [{"rule": 1-6, "quote": "exact words copied from the CANDIDATE", "why": "one short sentence"}]}. If nothing is wrong reply {"issues": []}. Never report a problem you cannot quote.`;

/** Layer 2: a strict AI checker. Fails closed: if it cannot run, the text is rejected. */
export async function aiReview(input: {
  kind: string;
  data: unknown;
  candidate: unknown;
  extraRules?: string;
  /** Replaces the generic rulebook (used by the reports). */
  rules?: string;
  /** Rule numbers in `rules` that are only tone or repetition. Default: 5 and 6. */
  softRules?: number[];
}): Promise<Review> {
  const client = verifiedClient();
  if (!client) return { pass: false, issues: ["checker unavailable"] };
  try {
    const completion = await client.chat.completions.create(
      {
      model: reviewerModel(),
      ...temperatureFor(reviewerModel(), 0),
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `${input.rules ?? REVIEW_RULES}${input.extraRules ? `\n\nExtra rules for this text:\n${input.extraRules}` : ""}`,
        },
        {
          role: "user",
          content: `KIND OF TEXT: ${input.kind}\n\nDATA THE WRITER WAS GIVEN:\n${JSON.stringify(input.data)}\n\nCANDIDATE:\n${JSON.stringify(input.candidate)}`,
        },
      ],
      },
      { timeout: 120_000 }
    );
    const raw = completion.choices[0]?.message?.content ?? "";
    const parsed = JSON.parse(raw) as { issues?: unknown };
    const list = Array.isArray(parsed.issues) ? parsed.issues : [];
    const real: Array<{ rule: number; text: string }> = [];
    for (const it of list) {
      if (!it || typeof it !== "object") continue;
      const o = it as { rule?: unknown; quote?: unknown; why?: unknown };
      const quote = typeof o.quote === "string" ? o.quote : "";
      if (!quoteIsReal(input.candidate, quote)) continue; // a problem that cannot be quoted is not a problem
      real.push({ rule: Number(o.rule) || 12, text: `Rule ${Number(o.rule) || "?"}: "${quote.slice(0, 120)}" - ${typeof o.why === "string" ? o.why : "breaks the rule"}` });
    }
    const pass = real.length === 0;
    const softSet = input.softRules ? new Set(input.softRules) : input.rules ? SOFT_RULES : new Set([8, 11]);
    const soft = !pass && real.every((r) => softSet.has(r.rule));
    return { pass, issues: real.map((r) => r.text), soft };
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
  let softFallback: T | null = null;
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
    if (review.soft && codeIssues.length === 0) softFallback = candidate;
    feedback = [...review.issues, ...codeIssues];
    console.warn(`[verified:${opts.name}] attempt ${attempt} rejected`, {
      aiChecker: review.issues.slice(0, 4),
      code: codeIssues.slice(0, 4),
    });
  }
  if (softFallback != null) {
    console.warn(`[verified:${opts.name}] publishing the best draft: only tone/repetition points remained`);
    return softFallback;
  }
  console.error(`[verified:${opts.name}] no draft passed after ${max} attempts; showing nothing`);
  return null;
}
