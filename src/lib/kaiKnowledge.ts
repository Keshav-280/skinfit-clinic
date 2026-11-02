import "server-only";

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { buildBm25Index, bm25Search, tokenize, type Bm25Index } from "@/src/lib/ragBm25";
import type { TextbookChunk } from "@/src/lib/ragTextbookIndex";

/**
 * Reference material for kAI's answers.
 *
 * kAI has its own index, separate from the one used by reports and insights, so it only ever
 * reads material we are allowed to reuse: commercially licensed open-access articles
 * (src/data/rag/open_sources_chunks.json, CC BY / CC0 only) and the clinic's own documents
 * (src/data/rag/clinic_chunks.json, written by rag-ingest-clinic-docs.mjs).
 * Override with KAI_RAG_CHUNK_JSON_PATHS (comma-separated, relative to the repo root).
 */
const DEFAULT_FILES = [
  "src/data/rag/open_sources_chunks.json",
  "src/data/rag/clinic_chunks.json",
];

/** The clinic's own guidance outranks general literature when both match. */
const CLINIC_BOOST = 1.5;
/** Ignore weak matches: below this score a chunk is noise for a short question. */
export const KAI_MIN_SCORE = 7;
/** Keep chunks within this fraction of the best match. */
const RELATIVE_CUTOFF = 0.55;
const MAX_CHUNKS = 4;
const MAX_CHARS_PER_CHUNK = 750;

let cached: Bm25Index | null = null;
let cachedTopics: Set<string> | null = null;

/** Tag words too generic to prove a question is about skin. */
const GENERIC_TOPICS = new Set(["skin", "dermatology", "topical", "volume", "ageing"]);

function filePaths(): string[] {
  const custom = process.env.KAI_RAG_CHUNK_JSON_PATHS?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return (custom?.length ? custom : DEFAULT_FILES)
    .map((p) => join(process.cwd(), p))
    .filter((p) => existsSync(p));
}

function loadIndex(): Bm25Index {
  if (cached) return cached;
  const seen = new Set<string>();
  const chunks: TextbookChunk[] = [];
  for (const p of filePaths()) {
    try {
      const parsed = JSON.parse(readFileSync(p, "utf8")) as TextbookChunk[];
      if (!Array.isArray(parsed)) continue;
      for (const c of parsed) {
        if (!c?.id || typeof c.text !== "string" || seen.has(c.id)) continue;
        seen.add(c.id);
        chunks.push({
          id: c.id,
          source: typeof c.source === "string" ? c.source : "",
          pageHint: null,
          tags: Array.isArray(c.tags) ? c.tags.map(String) : [],
          text: c.text,
        });
      }
    } catch {
      /* skip an unreadable file; kAI still works without reference material */
    }
  }
  cached = buildBm25Index(chunks);
  // Topic words = what the corpus tags its articles with (acne, melasma, microneedling ...).
  cachedTopics = new Set(
    chunks.flatMap((c) => c.tags.flatMap((t) => tokenize(t))).filter((t) => !GENERIC_TOPICS.has(t))
  );
  return cached;
}

/** Everyday words people type → the terms the literature uses. */
const SYNONYMS: Array<[RegExp, string]> = [
  [/\b(pimples?|zits?|breakouts?|spots?)\b/i, "acne"],
  [/\b(dark spots?|marks?|patches|tan|tanning|blemish\w*)\b/i, "pigmentation hyperpigmentation"],
  [/\bmelasma\b/i, "melasma pigmentation"],
  [/\b(dark circles?|under[- ]?eyes?|eye bags?)\b/i, "periorbital infraorbital dark circles"],
  [/\b(wrinkles?|fine lines?|lines|ageing|aging)\b/i, "wrinkle photoaging"],
  [/\b(sagging|loose skin|jowls?|volume)\b/i, "skin laxity sagging"],
  [/\b(scars?|pits|pitted|ice ?pick)\b/i, "scar scarring"],
  [/\b(hair ?fall|hair loss|thinning|shedding|bald\w*)\b/i, "hair loss alopecia"],
  [/\b(sun ?screen|spf|sun|uv)\b/i, "sunscreen photoprotection"],
  [/\b(retinol|retin-?a|tretinoin|adapalene)\b/i, "retinoid"],
  [/\b(vit(amin)? ?c)\b/i, "vitamin c"],
  [/\b(peels?)\b/i, "chemical peel"],
  [/\b(needling|derma ?roller)\b/i, "microneedling"],
  [/\b(botox|botulinum)\b/i, "botulinum toxin"],
  [/\b(fillers?)\b/i, "dermal filler"],
  [/\b(moisturi[sz]er|dry skin|dryness|barrier)\b/i, "skin barrier moisturizer"],
  [/\b(sleep|stress)\b/i, "sleep stress skin"],
  [/\b(diet|food|sugar|dairy|milk)\b/i, "diet"],
];

function loadTopics(): Set<string> {
  loadIndex();
  return cachedTopics ?? new Set();
}

const ABOUT_OWN_RESULTS =
  /\b(my|the|this|latest|last)\s+(\w+\s+)?(score|scores|report|scan|result|results|grade|number)\b/i;

function expandQuery(text: string): string {
  const extra: string[] = [];
  for (const [re, add] of SYNONYMS) if (re.test(text)) extra.push(add);
  return [text, ...extra].join(" ");
}

export type KaiReference = {
  /** Plain label for the answer, e.g. "a 2024 review in Frontiers in Medicine". */
  label: string;
  fromClinic: boolean;
  text: string;
};

function labelFor(source: string): { label: string; fromClinic: boolean } {
  if (/\[CLINIC OWN\]/i.test(source)) {
    const title = source
      .replace(/^SkinFit Wellness clinic guidance:\s*/i, "")
      .replace(/\s*\[CLINIC OWN\]\s*$/i, "")
      .trim();
    return { label: `SkinFit clinic guidance${title ? `: ${title}` : ""}`, fromClinic: true };
  }
  // "Title (Journal Year) PMC123 [CC BY] https://..." → "Title (Journal Year)"
  const m = source.match(/^(.*?\([^()]*\))\s+PMC\d+/);
  const label = (m?.[1] ?? source.replace(/\s+PMC\d+.*$/, "")).trim();
  return { label, fromClinic: false };
}

function trimAtSentence(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("; "));
  return (stop > max * 0.5 ? cut.slice(0, stop + 1) : cut).trim();
}

/**
 * Finds reference passages for what the patient just asked. `recentUserText` (their previous
 * turn) helps short follow-ups such as "and how long does it take?".
 */
export function retrieveKaiReferences(input: {
  message: string;
  recentUserText?: string;
  boostTerms?: string[];
}): KaiReference[] {
  const idx = loadIndex();
  if (idx.chunks.length === 0) return [];

  const question = input.message.trim();
  // "What does my acne score mean?" is answered from their own report, not from articles.
  if (ABOUT_OWN_RESULTS.test(question)) return [];
  // A follow-up with no skin topic of its own ("how long does it take?") borrows the previous
  // question for context.
  const topics = loadTopics();
  const hasTopic = (t: string) => tokenize(expandQuery(t)).some((w) => topics.has(w));
  const query = expandQuery(
    !hasTopic(question) && input.recentUserText ? `${input.recentUserText} ${question}` : question
  );

  // Only look things up when the question is actually about a skin topic we hold material on.
  // ("thanks, that helps" or "what's the capital of France" must not pull articles in.)
  const anchors = [...new Set(tokenize(query).filter((t) => topics.has(t)))];
  if (anchors.length === 0) return [];

  const hits = bm25Search(idx, {
    query,
    // Topic words steer the search; stray words ("chin", "helps") must not.
    boostTerms: [...anchors, ...(input.boostTerms ?? [])],
    boostFactor: 3,
    topK: 12,
  })
    .map((h) => ({
      ...h,
      score: h.score * (/\[CLINIC OWN\]/i.test(h.chunk.source) ? CLINIC_BOOST : 1),
    }))
    .sort((a, b) => b.score - a.score);

  const best = hits[0]?.score ?? 0;
  if (best < KAI_MIN_SCORE) return [];

  const out: KaiReference[] = [];
  const perSource = new Map<string, number>();
  for (const h of hits) {
    if (out.length >= MAX_CHUNKS) break;
    if (h.score < best * RELATIVE_CUTOFF) break;
    // Don't let one article fill every slot.
    const n = perSource.get(h.chunk.source) ?? 0;
    if (n >= 2) continue;
    perSource.set(h.chunk.source, n + 1);
    const { label, fromClinic } = labelFor(h.chunk.source);
    out.push({ label, fromClinic, text: trimAtSentence(h.chunk.text, MAX_CHARS_PER_CHUNK) });
  }
  return out;
}

/** Text block appended to kAI's system prompt; empty when nothing relevant was found. */
export function formatKaiReferences(refs: KaiReference[]): string {
  if (refs.length === 0) return "";
  const body = refs
    .map((r, i) => `[${i + 1}] ${r.fromClinic ? "OUR CLINIC" : r.label}\n${r.text}`)
    .join("\n\n");
  return [
    "Reference material (background for you, not for the patient to read):",
    body,
    "How to use it: answer in your own plain words and keep the patient's own report first. Use it only where it genuinely fits their question; if it does not fit, ignore it and answer from general knowledge. Never quote at length. Never present a study as proof for this patient. Where it helps, mention the source in plain words (for example \"a 2024 review in Frontiers in Medicine\" or \"our clinic's guidance\"), never an ID or link. Clinic guidance outranks the articles if they differ. If a passage seems to contradict the patient's own report, trust the report and say what the clinic can clarify.",
  ].join("\n\n");
}
