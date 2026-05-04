import OpenAI from "openai";
import { Pinecone } from "@pinecone-database/pinecone";
import type { TextbookChunk } from "@/src/lib/ragTextbookIndex";

/**
 * Default 1536 for `text-embedding-3-small`. If your Pinecone index was created with
 * a smaller dimension (e.g. 512), set `OPENAI_EMBEDDING_DIMENSIONS=512` so upsert + query match.
 */
export const RAG_EMBEDDING_MODEL =
  process.env.OPENAI_EMBEDDING_MODEL?.trim() || "text-embedding-3-small";

function embeddingDimensionsOption(): { dimensions: number } | undefined {
  const raw = process.env.OPENAI_EMBEDDING_DIMENSIONS?.trim();
  if (!raw) return undefined;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 8) return undefined;
  if (!RAG_EMBEDDING_MODEL.includes("text-embedding-3")) return undefined;
  return { dimensions: n };
}

let pineconeClient: Pinecone | null = null;

export function isPineconeTextbookConfigured(): boolean {
  return Boolean(
    process.env.PINECONE_API_KEY?.trim() &&
      process.env.PINECONE_INDEX_NAME?.trim() &&
      process.env.OPENAI_API_KEY?.trim()
  );
}

function getPinecone(): Pinecone {
  if (!pineconeClient) {
    const key = process.env.PINECONE_API_KEY?.trim();
    if (!key) throw new Error("PINECONE_API_KEY missing");
    pineconeClient = new Pinecone({ apiKey: key });
  }
  return pineconeClient;
}

function getOpenAI(): OpenAI {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("OPENAI_API_KEY missing");
  return new OpenAI({ apiKey: key });
}

export async function embedTextsForPinecone(texts: string[]): Promise<number[][]> {
  const openai = getOpenAI();
  const out: number[][] = [];
  const batchSize = 64;
  for (let i = 0; i < texts.length; i += batchSize) {
    const slice = texts.slice(i, i + batchSize).map((t) => t.slice(0, 8000));
    const dimOpt = embeddingDimensionsOption();
    const res = await openai.embeddings.create({
      model: RAG_EMBEDDING_MODEL,
      input: slice,
      ...(dimOpt ? dimOpt : {}),
    });
    for (const row of res.data.sort((a, b) => a.index - b.index)) {
      out.push(row.embedding);
    }
  }
  return out;
}

export async function embedQueryForPinecone(query: string): Promise<number[]> {
  const [v] = await embedTextsForPinecone([query]);
  return v ?? [];
}

export function pineconeMetadataFromChunk(c: TextbookChunk): Record<string, string | number> {
  return {
    chunkId: c.id,
    source: c.source.slice(0, 512),
    pageHint: c.pageHint ?? -1,
    tags: c.tags.join(",").slice(0, 2000),
    text: c.text.slice(0, 32000),
  };
}

export function chunkFromPineconeMetadata(
  id: string,
  meta: Record<string, unknown> | null | undefined
): TextbookChunk | null {
  if (!meta) return null;
  const text = typeof meta.text === "string" ? meta.text : "";
  if (!text.trim()) return null;
  const tagsRaw = meta.tags;
  const tags =
    typeof tagsRaw === "string"
      ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean)
      : Array.isArray(tagsRaw)
        ? tagsRaw.map(String)
        : [];
  const pageHint =
    typeof meta.pageHint === "number"
      ? meta.pageHint
      : typeof meta.pageHint === "string"
        ? parseInt(meta.pageHint, 10)
        : null;
  return {
    id: typeof meta.chunkId === "string" ? meta.chunkId : id,
    source: typeof meta.source === "string" ? meta.source : "",
    pageHint: pageHint != null && Number.isFinite(pageHint) && pageHint >= 0 ? pageHint : null,
    tags,
    text,
  };
}

/**
 * Semantic retrieval against Pinecone (cosine / dotproduct index).
 * Returns empty if not configured or on error (caller falls back to BM25).
 */
export async function pineconeTextbookRetrieve(params: {
  query: string;
  topK: number;
}): Promise<Array<{ chunk: TextbookChunk; score: number }>> {
  if (!isPineconeTextbookConfigured()) return [];

  const indexName = process.env.PINECONE_INDEX_NAME!.trim();
  const ns = process.env.PINECONE_NAMESPACE?.trim();
  const pc = getPinecone();
  let index = pc.index(indexName);
  if (ns) index = index.namespace(ns);

  const vector = await embedQueryForPinecone(params.query.slice(0, 8000));
  const res = await index.query({
    vector,
    topK: params.topK,
    includeMetadata: true,
  });

  const out: Array<{ chunk: TextbookChunk; score: number }> = [];
  for (const m of res.matches ?? []) {
    const chunk = chunkFromPineconeMetadata(m.id, m.metadata as Record<string, unknown>);
    if (!chunk) continue;
    const score = typeof m.score === "number" ? m.score : 0;
    out.push({ chunk, score });
  }
  return out;
}
