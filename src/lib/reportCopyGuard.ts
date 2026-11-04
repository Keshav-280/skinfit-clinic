/**
 * Keeps patient report copy readable and safe.
 *
 * Problems this fixes: raw textbook chunks (cut mid-sentence, rare-disease chapters) were pasted
 * into the report as "insights", and AI text could carry numbers that are not in the data.
 */
import type { TextbookChunk } from "@/src/lib/ragTextbookIndex";
import type { RagKaiParamKey } from "@/src/lib/ragEightParams";

/** Words that mark clinical-reference text a patient should never see pasted into a report. */
const NON_CONSUMER_TERMS =
  /\b(syndrome|mutation|mutations|autosomal|congenital|hereditary|genodermatosis|carcinoma|lymphoma|sarcoma|metastas\w*|etiology|pathogenesis|histopatholog\w*|biopsy|gene|genes|allele|chromosom\w*|neonat\w*|infantile)\b/i;

export function isConsumerSafeChunk(text: string): boolean {
  return !NON_CONSUMER_TERMS.test(text);
}

/** Drops rare-disease chunks and weak matches (keeps anything within 45% of the best score). */
export function filterConsumerEvidence<T extends { chunk: TextbookChunk; score: number }>(
  evidence: T[]
): T[] {
  const safe = evidence.filter((e) => isConsumerSafeChunk(e.chunk.text));
  if (safe.length === 0) return [];
  const top = Math.max(...safe.map((e) => e.score));
  return safe.filter((e) => e.score >= top * 0.45);
}

const NUM = /\d+(?:\.\d+)?/g;

/** True when every number in `text` also appears as a number in `data`. */
export function numbersAreGrounded(text: string, data: string): boolean {
  const allowed = new Set(data.match(NUM) ?? []);
  for (const n of text.match(NUM) ?? []) {
    if (!allowed.has(n)) return false;
  }
  return true;
}

/** A finished, readable sentence or two: no cut-off, no clinical jargon, sensible length. */
export function isCleanCopy(text: string | null | undefined, maxChars = 320): boolean {
  const t = (text ?? "").trim();
  if (t.length < 20 || t.length > maxChars) return false;
  if (!/[.!?]["')\]]?$/.test(t)) return false;
  if (NON_CONSUMER_TERMS.test(t)) return false;
  if (/\b(E\d+|chunk|textbook evidence)\b/i.test(t)) return false;
  return true;
}

const CURATED: Partial<Record<RagKaiParamKey, { insight: string; article: string }>> = {
  active_acne: {
    insight:
      "Breakouts settle with steady habits more than quick fixes. A calm, regular routine and clean pillowcases help most.",
    article: "Everyday habits that keep breakouts calmer",
  },
  acne_scar: {
    insight:
      "Scars fade slowly, over months. Daily sun protection and a steady routine protect the progress you make.",
    article: "Why marks and scars take time to fade",
  },
  pigmentation: {
    insight:
      "Uneven tone responds best to daily sun protection. Scan in the same light each time so changes you see are real.",
    article: "Sun protection and even skin tone",
  },
  wrinkles: {
    insight:
      "Fine lines follow sleep, hydration and sun habits. Small daily routines add up more than occasional big efforts.",
    article: "Habits that keep skin looking smooth",
  },
  under_eye: {
    insight:
      "Under-eye shadows swing with sleep, salt and screen time. A steady bedtime often helps more than any product.",
    article: "What really affects under-eye shadows",
  },
  sagging_volume: {
    insight:
      "Firmness changes slowly, so look at weeks and months, not days. Sun protection and steady habits support it.",
    article: "Keeping skin firm: what helps over time",
  },
};

const GENERIC = {
  insight:
    "Skin changes slowly, so a steady morning and evening routine is the best lever you have. Weekly check-ins show what is working.",
  article: "Barrier-first skincare basics",
};

export function curatedInsight(key: RagKaiParamKey | null | undefined) {
  return (key && CURATED[key]) || GENERIC;
}
