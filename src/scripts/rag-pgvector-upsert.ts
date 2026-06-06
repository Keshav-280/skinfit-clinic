import "dotenv/config";
import { loadTextbookChunks } from "@/src/lib/ragTextbookIndex";
import { embedTextsForPinecone } from "@/src/lib/ragPinecone";
import { upsertPgvectorChunks } from "@/src/lib/ragPgvector";

/**
 * Upsert textbook chunks into Postgres pgvector (replaces Pinecone for RAG).
 *
 * Prereqs:
 * - Run migration: drizzle/0038_rag_pgvector.sql (or db:migrate)
 * - pgvector extension enabled on Postgres
 * - OPENAI_API_KEY for embeddings
 *
 * Env: RAG_EMBEDDING_DIMENSIONS must match vector column (default 1536)
 */
async function main() {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    console.error("Missing OPENAI_API_KEY for embeddings.");
    process.exit(1);
  }

  const chunks = loadTextbookChunks();
  if (chunks.length === 0) {
    console.error("No chunks. Run: npm run rag:index:textbook");
    process.exit(1);
  }

  const batch = 32;
  for (let i = 0; i < chunks.length; i += batch) {
    const slice = chunks.slice(i, i + batch);
    const texts = slice.map((c) =>
      `${c.source}\n${c.tags.join(" ")}\n${c.text}`.slice(0, 8000)
    );
    const vectors = await embedTextsForPinecone(texts);
    await upsertPgvectorChunks(
      slice.map((chunk, j) => ({ chunk, embedding: vectors[j]! }))
    );
    console.log(`Upserted ${Math.min(i + batch, chunks.length)} / ${chunks.length}`);
  }
  console.log("pgvector upsert complete. Set RAG_VECTOR_STORE=pgvector on the server.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
