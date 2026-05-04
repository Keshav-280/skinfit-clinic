import "dotenv/config";
import { Pinecone } from "@pinecone-database/pinecone";
import {
  embedTextsForPinecone,
  isPineconeTextbookConfigured,
  pineconeMetadataFromChunk,
} from "@/src/lib/ragPinecone";
import { loadTextbookChunks } from "@/src/lib/ragTextbookIndex";

/**
 * Upsert all local textbook chunks (see `loadTextbookChunks`) into Pinecone.
 *
 * Prereqs:
 * - Index exists with dimension matching `text-embedding-3-small` (1536) and metric cosine or dotproduct.
 * - Env: PINECONE_API_KEY, PINECONE_INDEX_NAME, OPENAI_API_KEY
 * - Optional: PINECONE_NAMESPACE, OPENAI_EMBEDDING_MODEL
 *
 * Run after: npm run rag:index:textbook
 */
async function main() {
  if (!isPineconeTextbookConfigured()) {
    console.error(
      "Missing PINECONE_API_KEY, PINECONE_INDEX_NAME, or OPENAI_API_KEY."
    );
    process.exit(1);
  }

  const chunks = loadTextbookChunks();
  if (chunks.length === 0) {
    console.error("No chunks loaded. Build JSON first: npm run rag:index:textbook");
    process.exit(1);
  }

  const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY!.trim() });
  let index = pc.index(process.env.PINECONE_INDEX_NAME!.trim());
  const ns = process.env.PINECONE_NAMESPACE?.trim();
  if (ns) index = index.namespace(ns);

  const batch = 48;
  for (let i = 0; i < chunks.length; i += batch) {
    const slice = chunks.slice(i, i + batch);
    const texts = slice.map((c) =>
      `${c.source}\n${c.tags.join(" ")}\n${c.text}`.slice(0, 8000)
    );
    const vectors = await embedTextsForPinecone(texts);
    const records = slice.map((c, j) => ({
      id: c.id.replace(/[^\w\-:.]/g, "_").slice(0, 512),
      values: vectors[j]!,
      metadata: pineconeMetadataFromChunk(c),
    }));
    await index.upsert(records);
    console.log(
      `Upserted ${Math.min(i + batch, chunks.length)} / ${chunks.length}`
    );
  }
  console.log("Pinecone upsert complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
