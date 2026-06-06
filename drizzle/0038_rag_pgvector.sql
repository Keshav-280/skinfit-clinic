-- Textbook RAG embeddings in Postgres (pgvector). Requires pgvector on the instance.
-- Dimension 1536 matches OpenAI text-embedding-3-small; set OPENAI_EMBEDDING_DIMENSIONS=1024 for Voyage and adjust column if needed.
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS "rag_textbook_embeddings" (
  "chunk_id" varchar(512) PRIMARY KEY NOT NULL,
  "source" text NOT NULL DEFAULT '',
  "page_hint" integer,
  "tags" text NOT NULL DEFAULT '',
  "body_text" text NOT NULL,
  "embedding" vector(1536) NOT NULL,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "rag_textbook_embeddings_hnsw_idx"
  ON "rag_textbook_embeddings"
  USING hnsw ("embedding" vector_cosine_ops);
