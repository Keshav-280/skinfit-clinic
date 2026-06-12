import { sql } from "drizzle-orm";
import { db } from "@/src/db/client";
import {
  embedQueryForPinecone,
  embedTextsForPinecone,
} from "@/src/lib/ragPinecone";
import { ragVectorStoreMode } from "@/src/lib/ragVectorStore";
import type { TextbookChunk } from "@/src/lib/ragTextbookIndex";

function formatPgVector(values: number[]): string {
  return `[${values.map((n) => (Number.isFinite(n) ? n : 0)).join(",")}]`;
}

function ragEmbeddingDimensions(): number {
  const raw =
    process.env.RAG_EMBEDDING_DIMENSIONS?.trim() ||
    process.env.OPENAI_EMBEDDING_DIMENSIONS?.trim();
  if (raw) {
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 8) return n;
  }
  return 1536;
}

export function isPgvectorRagConfigured(): boolean {
  if (!process.env.OPENAI_API_KEY?.trim()) return false;
  const mode = ragVectorStoreMode();
  return mode === "pgvector" || mode === "auto";
}

let populatedCache: { at: number; value: boolean } | null = null;
const POPULATED_TTL_MS = 60_000;

/** True when the embeddings table exists and has at least one row. */
export async function isPgvectorRagPopulated(): Promise<boolean> {
  const now = Date.now();
  if (populatedCache && now - populatedCache.at < POPULATED_TTL_MS) {
    return populatedCache.value;
  }
  try {
    const rows = await db.execute<{ ok: number }>(sql`
      SELECT 1 AS ok FROM rag_textbook_embeddings LIMIT 1
    `);
    const value = (rows.rows?.length ?? 0) > 0;
    populatedCache = { at: now, value };
    return value;
  } catch {
    populatedCache = { at: now, value: false };
    return false;
  }
}

export function chunkFromPgRow(row: {
  chunk_id: string;
  source: string | null;
  page_hint: number | null;
  tags: string | null;
  body_text: string;
}): TextbookChunk {
  return {
    id: row.chunk_id,
    source: row.source ?? "",
    pageHint:
      typeof row.page_hint === "number" && Number.isFinite(row.page_hint)
        ? row.page_hint
        : null,
    tags: (row.tags ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    text: row.body_text,
  };
}

/**
 * Cosine similarity search in Postgres (pgvector).
 * Returns empty on missing extension/table or query error (caller uses BM25).
 */
export async function pgvectorTextbookRetrieve(params: {
  query: string;
  topK: number;
}): Promise<Array<{ chunk: TextbookChunk; score: number }>> {
  if (!isPgvectorRagConfigured()) return [];

  const queryVec = await embedQueryForPinecone(params.query.slice(0, 8000));
  const expectedDim = ragEmbeddingDimensions();
  if (queryVec.length !== expectedDim) {
    console.warn(
      `[rag] pgvector query embedding dim ${queryVec.length} != expected ${expectedDim}`
    );
    return [];
  }

  const vecSql = sql.raw(`${formatPgVector(queryVec)}::vector`);

  try {
    const result = await db.execute<{
      chunk_id: string;
      source: string | null;
      page_hint: number | null;
      tags: string | null;
      body_text: string;
      score: number;
    }>(sql`
      SELECT
        chunk_id,
        source,
        page_hint,
        tags,
        body_text,
        1 - (embedding <=> ${vecSql}) AS score
      FROM rag_textbook_embeddings
      ORDER BY embedding <=> ${vecSql}
      LIMIT ${params.topK}
    `);

    const rows = result.rows ?? [];
    return rows.map((row) => ({
      chunk: chunkFromPgRow(row),
      score: typeof row.score === "number" ? row.score : 0,
    }));
  } catch (e) {
    console.error("[rag] pgvector query failed:", e);
    return [];
  }
}

export async function upsertPgvectorChunks(
  items: Array<{ chunk: TextbookChunk; embedding: number[] }>
): Promise<void> {
  const dim = ragEmbeddingDimensions();
  for (const { chunk, embedding } of items) {
    if (embedding.length !== dim) {
      throw new Error(
        `Embedding dim ${embedding.length} != RAG_EMBEDDING_DIMENSIONS ${dim} for chunk ${chunk.id}`
      );
    }
    const vecLiteral = formatPgVector(embedding);
    const chunkId = chunk.id.replace(/[^\w\-:.]/g, "_").slice(0, 512);
    await db.execute(sql`
      INSERT INTO rag_textbook_embeddings (
        chunk_id, source, page_hint, tags, body_text, embedding, updated_at
      ) VALUES (
        ${chunkId},
        ${chunk.source.slice(0, 2000)},
        ${chunk.pageHint},
        ${chunk.tags.join(",").slice(0, 2000)},
        ${chunk.text.slice(0, 32000)},
        ${sql.raw(`${vecLiteral}::vector`)},
        now()
      )
      ON CONFLICT (chunk_id) DO UPDATE SET
        source = EXCLUDED.source,
        page_hint = EXCLUDED.page_hint,
        tags = EXCLUDED.tags,
        body_text = EXCLUDED.body_text,
        embedding = EXCLUDED.embedding,
        updated_at = now()
    `);
  }
}
