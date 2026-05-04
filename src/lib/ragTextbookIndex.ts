import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type TextbookChunk = {
  id: string;
  source: string;
  pageHint: number | null;
  tags: string[];
  text: string;
};

let cachedChunks: TextbookChunk[] | null = null;

/** Comma-separated paths relative to repo root, e.g. `src/data/rag/iadvl_chunks.json,src/data/rag/extra_chunks.json` */
function chunkJsonPaths(): string[] {
  const cwd = process.cwd();
  const custom = process.env.RAG_CHUNK_JSON_PATHS?.split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((p) => join(cwd, p));
  if (custom?.length) {
    return custom.filter((p) => existsSync(p));
  }

  const ragDir = join(cwd, "src", "data", "rag");
  const catalog = join(ragDir, "catalog_chunks.json");
  if (existsSync(catalog)) {
    return [catalog];
  }
  const paths: string[] = [];
  const primary = join(ragDir, "iadvl_chunks.json");
  if (existsSync(primary)) paths.push(primary);
  const extra = join(ragDir, "extra_chunks.json");
  if (existsSync(extra)) paths.push(extra);
  return paths;
}

export function loadTextbookChunks(): TextbookChunk[] {
  if (cachedChunks) return cachedChunks;
  const seen = new Set<string>();
  const merged: TextbookChunk[] = [];
  for (const p of chunkJsonPaths()) {
    try {
      const raw = readFileSync(p, "utf8");
      const parsed = JSON.parse(raw) as TextbookChunk[];
      if (!Array.isArray(parsed)) continue;
      for (const c of parsed) {
        if (!c?.id || typeof c.id !== "string") continue;
        if (seen.has(c.id)) continue;
        seen.add(c.id);
        merged.push({
          id: c.id,
          source: typeof c.source === "string" ? c.source : "",
          pageHint:
            typeof c.pageHint === "number" && Number.isFinite(c.pageHint)
              ? c.pageHint
              : null,
          tags: Array.isArray(c.tags) ? c.tags.map(String) : [],
          text: typeof c.text === "string" ? c.text : "",
        });
      }
    } catch {
      /* skip unreadable file */
    }
  }
  cachedChunks = merged;
  return cachedChunks;
}

function scoreChunk(c: TextbookChunk, queryTerms: string[]) {
  const hay = `${c.tags.join(" ")} ${c.text}`.toLowerCase();
  let score = 0;
  for (const t of queryTerms) {
    if (!t) continue;
    if (hay.includes(t)) score += 1;
  }
  return score;
}

export function retrieveTextbookChunks(params: {
  queryTerms: string[];
  topK?: number;
}) {
  const all = loadTextbookChunks();
  if (all.length === 0) return [];
  const terms = params.queryTerms.map((t) => t.trim().toLowerCase()).filter(Boolean);
  if (terms.length === 0) return all.slice(0, params.topK ?? 6);
  const scored = all
    .map((c) => ({ c, s: scoreChunk(c, terms) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s);
  return scored.slice(0, params.topK ?? 6).map((x) => x.c);
}
