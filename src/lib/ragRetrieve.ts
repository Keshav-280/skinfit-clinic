import { bm25Retrieve } from "@/src/lib/ragBm25";
import {
  isPgvectorRagConfigured,
  isPgvectorRagPopulated,
  pgvectorTextbookRetrieve,
} from "@/src/lib/ragPgvector";
import {
  isPineconeTextbookConfigured,
  pineconeTextbookRetrieve,
} from "@/src/lib/ragPinecone";
import { ragVectorStoreMode } from "@/src/lib/ragVectorStore";
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
 * Production retrieval: hybrid vector + BM25 (RRF), or BM25-only.
 * Vector store: pgvector (Postgres) preferred in auto mode, then Pinecone, else keyword BM25.
 */
export async function productionTextbookRetrieve(params: {
  query: string;
  boostTerms?: string[];
  topK?: number;
}): Promise<Array<{ chunk: TextbookChunk; score: number }>> {
  const topK = params.topK ?? 6;
  const boost = (params.boostTerms ?? []).filter(Boolean).join(" ");
  const queryForVector = [params.query, boost].filter(Boolean).join(" ").trim();
  const mode = ragVectorStoreMode();

  const bm25 = bm25Retrieve({
    query: params.query,
    boostTerms: params.boostTerms,
    topK: Math.max(topK * 2, topK),
  });

  if (mode === "bm25") {
    return bm25.slice(0, topK);
  }

  let vector: Array<{ chunk: TextbookChunk; score: number }> = [];

  const tryPgvector =
    mode === "pgvector" ||
    (mode === "auto" && isPgvectorRagConfigured() && (await isPgvectorRagPopulated()));

  if (tryPgvector) {
    console.log("[rag] Querying pgvector (Postgres)...");
    vector = await pgvectorTextbookRetrieve({
      query: queryForVector || params.query,
      topK: Math.max(topK * 2, topK),
    });
    if (vector.length > 0) {
      console.log(`[rag] pgvector returned ${vector.length} matches.`);
    }
  }

  const tryPinecone =
    vector.length === 0 &&
    (mode === "pinecone" || mode === "auto") &&
    isPineconeTextbookConfigured();

  if (tryPinecone) {
    console.log(
      `[rag] Querying Pinecone index: ${process.env.PINECONE_INDEX_NAME}...`
    );
    try {
      vector = await pineconeTextbookRetrieve({
        query: queryForVector || params.query,
        topK: Math.max(topK * 2, topK),
      });
      console.log(`[rag] Pinecone returned ${vector.length} matches.`);
    } catch (e) {
      console.error("[rag] Pinecone query failed:", e);
    }
  }

  if (vector.length === 0) {
    console.log("[rag] No vector matches — using BM25 keyword search only.");
    return bm25.slice(0, topK);
  }

  return rrfMerge([vector, bm25], RRF_K, topK);
}
