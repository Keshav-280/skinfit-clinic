/** Which backend stores textbook embeddings for semantic RAG search. */
export type RagVectorStoreMode = "auto" | "pgvector" | "pinecone" | "bm25";

export function ragVectorStoreMode(): RagVectorStoreMode {
  const v = process.env.RAG_VECTOR_STORE?.trim().toLowerCase();
  if (v === "pgvector" || v === "pinecone" || v === "bm25") return v;
  return "auto";
}
