import { loadTextbookChunks, type TextbookChunk } from "@/src/lib/ragTextbookIndex";

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "has",
  "have",
  "in",
  "is",
  "it",
  "its",
  "of",
  "on",
  "or",
  "that",
  "the",
  "to",
  "was",
  "were",
  "will",
  "with",
  "this",
  "those",
  "these",
  "been",
  "can",
  "may",
  "also",
  "than",
  "then",
  "they",
  "their",
  "there",
  "when",
  "which",
  "who",
  "what",
  "how",
  "into",
  "over",
  "about",
  "not",
  "but",
  "if",
  "so",
  "such",
  "your",
  "you",
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

export type Bm25Index = {
  chunks: TextbookChunk[];
  docTokens: string[][];
  /** Term counts per chunk, so scoring does not re-count words on every query. */
  docTf: Map<string, number>[];
  docLengths: number[];
  avgDocLength: number;
  idf: Map<string, number>;
};

let cachedIndex: Bm25Index | null = null;

export function buildBm25Index(chunks: TextbookChunk[]): Bm25Index {
  const docTokens: string[][] = [];
  const docTf: Map<string, number>[] = [];
  const docLengths: number[] = [];
  const df = new Map<string, number>();
  for (const c of chunks) {
    const tokens = tokenize(`${c.tags.join(" ")} ${c.text}`);
    docTokens.push(tokens);
    docLengths.push(tokens.length);
    const tf = new Map<string, number>();
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
    docTf.push(tf);
    for (const t of tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);
  }
  const N = chunks.length;
  const idf = new Map<string, number>();
  for (const [term, freq] of df.entries()) {
    idf.set(term, Math.log(1 + (N - freq + 0.5) / (freq + 0.5)));
  }
  const avgDocLength =
    docLengths.reduce((s, n) => s + n, 0) / Math.max(1, docLengths.length);
  return { chunks, docTokens, docTf, docLengths, avgDocLength, idf };
}

export function getBm25Index(): Bm25Index {
  if (cachedIndex) return cachedIndex;
  const chunks = loadTextbookChunks();
  cachedIndex = buildBm25Index(chunks);
  return cachedIndex;
}

/**
 * BM25 scoring with k1=1.5, b=0.75.
 * Accepts weighted query terms for phrase/tag boosts.
 */
export function bm25Retrieve(params: {
  query: string;
  boostTerms?: string[];
  topK?: number;
}): Array<{ chunk: TextbookChunk; score: number }> {
  return bm25Search(getBm25Index(), params);
}

/** Same scoring against any index (kAI keeps its own, licence-safe one). */
export function bm25Search(
  idx: Bm25Index,
  params: { query: string; boostTerms?: string[]; boostFactor?: number; topK?: number }
): Array<{ chunk: TextbookChunk; score: number }> {
  if (idx.chunks.length === 0) return [];

  const queryTokens = tokenize(params.query);
  const boostTokens = new Set(
    (params.boostTerms ?? []).flatMap((t) => tokenize(t))
  );
  const terms = Array.from(new Set(queryTokens));
  if (terms.length === 0) return [];

  const k1 = 1.5;
  const b = 0.75;

  const scores: number[] = new Array(idx.chunks.length).fill(0);

  for (const term of terms) {
    const termIdf = idx.idf.get(term);
    if (termIdf == null || termIdf <= 0) continue;
    const boost = boostTokens.has(term) ? (params.boostFactor ?? 1.6) : 1;

    for (let i = 0; i < idx.docTokens.length; i += 1) {
      const tf = idx.docTf[i]!.get(term) ?? 0;
      if (tf === 0) continue;
      const dl = idx.docLengths[i] || 1;
      const norm = 1 - b + b * (dl / idx.avgDocLength);
      const score = termIdf * ((tf * (k1 + 1)) / (tf + k1 * norm));
      scores[i] += score * boost;
    }
  }

  const topK = params.topK ?? 6;
  const ranked: Array<{ chunk: TextbookChunk; score: number }> = [];
  for (let i = 0; i < scores.length; i += 1) {
    if (scores[i] > 0) ranked.push({ chunk: idx.chunks[i], score: scores[i] });
  }
  ranked.sort((a, b) => b.score - a.score);
  return ranked.slice(0, topK);
}
