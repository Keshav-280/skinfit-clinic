import "dotenv/config";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { PDFParse } from "pdf-parse";

type Chunk = {
  id: string;
  source: string;
  pageHint: number | null;
  tags: string[];
  text: string;
};

const TAG_MAP: Record<string, string[]> = {
  acne: ["acne", "pimples", "comedone", "papule", "pustule"],
  pigmentation: ["pigmentation", "melasma", "hyperpigmentation", "pih"],
  wrinkles: ["wrinkle", "photoaging", "fine line", "ageing"],
  under_eye: ["under-eye", "periorbital", "dark circle", "infraorbital"],
  acne_scar: ["acne scar", "scar", "atrophic scar", "rolling scar"],
  skin_quality: ["barrier", "texture", "hydration", "xerosis"],
  sagging_volume: ["sagging", "laxity", "firmness", "volume loss"],
  hair_health: ["hair", "alopecia", "scalp", "hair shaft"],
};

function extractTags(text: string) {
  const lower = text.toLowerCase();
  const tags: string[] = [];
  for (const [tag, words] of Object.entries(TAG_MAP)) {
    if (words.some((w) => lower.includes(w))) tags.push(tag);
  }
  return tags;
}

function splitChunks(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  const size = 1100;
  const overlap = 140;
  const out: string[] = [];
  let i = 0;
  while (i < normalized.length) {
    out.push(normalized.slice(i, i + size));
    i += size - overlap;
  }
  return out;
}

function slugId(s: string) {
  const x = s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 36);
  return x || "book";
}

function resolvePdfPath(p: string) {
  if (p.startsWith("/") || /^[A-Za-z]:[\\/]/.test(p)) return p;
  return join(process.cwd(), p);
}

/**
 * Multiple PDFs: separate paths with `|` (pipe). Commas inside filenames
 * (e.g. Rook's `...Dermatology,_4_Volume_Set,...pdf`) break comma-splitting.
 * Legacy: if there is no `|` in the value, we still split on `,` for two simple paths.
 */
function parsePdfPaths(): string[] {
  const raw = process.env.RAG_TEXTBOOK_PDFS?.trim();
  if (raw) {
    const parts = raw.includes("|")
      ? raw.split("|")
      : raw.split(",");
    const list = parts.map((s) => s.trim()).filter(Boolean);
    if (list.length) return list.map(resolvePdfPath);
  }
  const one =
    process.env.RAG_TEXTBOOK_PDF ??
    join(
      process.cwd(),
      "books",
      "iadvl-textbook-of-dermatology-3-vol-set-5nbsped-9381496706-9789381496701_compress.pdf"
    );
  return [resolvePdfPath(one)];
}

async function chunksFromPdfFile(
  pdfPath: string,
  sourceLabel: string
): Promise<Chunk[]> {
  const pdfData = readFileSync(pdfPath);
  const parser = new PDFParse({ data: pdfData });
  const parsed = await parser.getText();
  await parser.destroy();
  const rawPages = parsed.pages.map((p) => p.text);
  const idPrefix = slugId(sourceLabel);

  const chunks: Chunk[] = [];
  for (let p = 0; p < rawPages.length; p += 1) {
    const page = rawPages[p] ?? "";
    if (page.trim().length < 120) continue;
    const pieces = splitChunks(page);
    for (let i = 0; i < pieces.length; i += 1) {
      const text = pieces[i].trim();
      if (text.length < 240) continue;
      const tags = extractTags(text);
      if (tags.length === 0) continue;
      chunks.push({
        id: `${idPrefix}-p${p + 1}-c${i + 1}`,
        source: sourceLabel,
        pageHint: p + 1,
        tags,
        text,
      });
    }
  }
  return chunks;
}

async function main() {
  const pdfPaths = parsePdfPaths();
  const labelParts =
    process.env.RAG_TEXTBOOK_SOURCE_LABELS?.split("|")
      .map((s) => s.trim())
      .filter(Boolean) ?? [];

  const all: Chunk[] = [];
  for (let i = 0; i < pdfPaths.length; i += 1) {
    const path = pdfPaths[i]!;
    const label =
      labelParts[i] ??
      (i === 0 && pdfPaths.length === 1
        ? "IADVL Textbook of Dermatology"
        : basename(path, ".pdf").replace(/_/g, " "));
    const part = await chunksFromPdfFile(path, label);
    all.push(...part);
    console.log(`${path} → ${part.length} chunks (${label})`);
  }

  const multi = pdfPaths.length > 1;
  const outPath =
    process.env.RAG_CHUNKS_OUT?.trim() ||
    join(
      process.cwd(),
      "src",
      "data",
      "rag",
      multi ? "catalog_chunks.json" : "iadvl_chunks.json"
    );
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(all, null, 2), "utf8");
  console.log(`Wrote ${all.length} total chunks → ${outPath}`);
  if (multi) {
    console.log(
      "Multi-textbook build: ensure runtime loads this file (default loader uses catalog_chunks.json when present)."
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
