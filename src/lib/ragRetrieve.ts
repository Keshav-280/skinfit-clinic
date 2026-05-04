import { bm25Retrieve } from "@/src/lib/ragBm25";
import {
  isPineconeTextbookConfigured,
  pineconeTextbookRetrieve,
} from "@/src/lib/ragPinecone";
import type { TextbookChunk } from "@/src/lib/ragTextbookIndex";

const RRF_K = 60;

function rrfMerge(
  lists: Array<Array<{ chunk: TextbookChunk; score: number }>>,
  k: number,
  topN: number
): Array<{ chunk: TextbookChunk; score: number }> {
  const scores = new Map<string, number>();
  const chunks = new Map<string, TextbookChunk>();
  for (const list of lists) {
    list.forEach((item, rank) => {
      const id = item.chunk.id;
      if (!chunks.has(id)) chunks.set(id, item.chunk);
      scores.set(id, (scores.get(id) ?? 0) + 1 / (k + rank + 1));
    });
  }
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([id, score]) => ({ chunk: chunks.get(id)!, score }));
}

/**
 * Production retrieval: hybrid Reciprocal Rank Fusion of Pinecone + BM25 when
 * Pinecone is configured; otherwise BM25-only (local JSON catalog).
 */
export async function productionTextbookRetrieve(params: {
  query: string;
  boostTerms?: string[];
  topK?: number;
}): Promise<Array<{ chunk: TextbookChunk; score: number }>> {
  const topK = params.topK ?? 6;
  const boost = (params.boostTerms ?? []).filter(Boolean).join(" ");
  const queryForVector = [params.query, boost].filter(Boolean).join(" ").trim();

  const bm25 = bm25Retrieve({
    query: params.query,
    boostTerms: params.boostTerms,
    topK: Math.max(topK * 2, topK),
  });

  if (!isPineconeTextbookConfigured()) {
    return bm25.slice(0, topK);
  }

  let vector: Array<{ chunk: TextbookChunk; score: number }> = [];
  try {
    vector = await pineconeTextbookRetrieve({
      query: queryForVector || params.query,
      topK: Math.max(topK * 2, topK),
    });
  } catch (e) {
    console.error("[rag] Pinecone query failed; using BM25 only:", e);
  }

  if (vector.length === 0) {
    return bm25.slice(0, topK);
  }

  return rrfMerge([vector, bm25], RRF_K, topK);
}
