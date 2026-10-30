// Turns the clinic's own material (SOPs, treatment guides, FAQs, leaflets, the call script)
// into searchable chunks for kAI.
//
// 1. Put plain text or Markdown files in:  src/data/rag/clinic/   (.txt or .md; convert Word/PDF to text first)
//    - One topic per file works best, e.g. "melasma-treatment-protocol.md", "faq-laser-aftercare.txt".
//    - Optional first line:  # Title of the document
//    - Optional line starting with  Tags:  acne, peel, aftercare
// 2. Run:  node src/scripts/rag-ingest-clinic-docs.mjs
// 3. Output: src/data/rag/clinic_chunks.json   (load with RAG_CHUNK_JSON_PATHS, see below)
//
// RAG_CHUNK_JSON_PATHS=src/data/rag/open_sources_chunks.json,src/data/rag/clinic_chunks.json

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, extname, join } from "node:path";

const DIR = join("src", "data", "rag", "clinic");
const OUT = join("src", "data", "rag", "clinic_chunks.json");
const CHUNK_CHARS = 1200;

if (!existsSync(DIR)) {
  mkdirSync(DIR, { recursive: true });
  console.log(`Created ${DIR}. Put the clinic's .txt / .md files there and run this again.`);
  process.exit(0);
}

const files = readdirSync(DIR).filter((f) => [".txt", ".md"].includes(extname(f).toLowerCase()));
if (!files.length) {
  console.log(`No .txt or .md files in ${DIR} yet.`);
  process.exit(0);
}

const chunks = [];
for (const f of files) {
  const raw = readFileSync(join(DIR, f), "utf-8").replace(/\r\n/g, "\n");
  const lines = raw.split("\n");
  let title = basename(f, extname(f)).replace(/[-_]+/g, " ");
  let tags = [];
  const body = [];
  for (const line of lines) {
    const h = line.match(/^#\s+(.+)/);
    if (h && body.length === 0) {
      title = h[1].trim();
      continue;
    }
    const t = line.match(/^tags:\s*(.+)/i);
    if (t) {
      tags = t[1].split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
      continue;
    }
    body.push(line);
  }
  // split on blank lines, then pack paragraphs up to CHUNK_CHARS
  const paras = body.join("\n").split(/\n\s*\n/).map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean);
  let buf = "";
  let n = 0;
  const flush = () => {
    if (buf.trim().length > 40) {
      chunks.push({
        id: `clinic-${basename(f, extname(f))}-${n++}`,
        source: `SkinFit Wellness clinic guidance: ${title} [CLINIC OWN]`,
        pageHint: null,
        tags: ["clinic", ...tags],
        text: buf.trim(),
      });
    }
    buf = "";
  };
  for (const p of paras) {
    if (buf && (buf + " " + p).length > CHUNK_CHARS) flush();
    buf += (buf ? " " : "") + p;
  }
  flush();
  console.log(`${f}: ${n} chunks`);
}

writeFileSync(OUT, JSON.stringify(chunks));
console.log(`\nWrote ${chunks.length} chunks from ${files.length} files to ${OUT}`);
