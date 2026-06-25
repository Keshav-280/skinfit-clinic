/**
 * Export annotator JSON from the database (same merged data as the web Export button).
 * No browser needed — reads Postgres directly.
 *
 * On EC2 (from laptop):
 *   ssh -i skinfit-key.pem ubuntu@13.234.166.154 \
 *     'cd /opt/skinfit && LOCAL_POSTGRES_URL="postgresql://skinfit:skinfit_local_dev@127.0.0.1:5433/skinfit" \
 *      npx tsx src/scripts/export-annotator-json.ts /tmp/skinnfit-export.json && cat /tmp/skinnfit-export.json' \
 *     > skinnfit-export.json
 *
 * On EC2 (already SSH'd):
 *   cd /opt/skinfit
 *   LOCAL_POSTGRES_URL='postgresql://skinfit:skinfit_local_dev@127.0.0.1:5433/skinfit' \
 *     npx tsx src/scripts/export-annotator-json.ts ~/skinnfit-export.json
 */
import "dotenv/config";
import { writeFileSync } from "fs";
import { asc, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { annotatorImages, annotatorState } from "@/src/db/schema";
import {
  ANNOTATOR_SCOPE,
  allShapesMerged,
  mergedLabelsForExport,
  parseCollaborationStore,
} from "@/src/lib/annotatorCollaboration";
import {
  normalizeSeverityGrade,
  severityGradeToScore,
  type SeverityGrade,
} from "@/src/lib/annotatorSeverityGrade";

const ALL_CATEGORIES = [
  "Active Acne",
  "Acne Scars",
  "Pigmentation",
  "Wrinkles",
  "Sagging & Volume",
  "Under-Eye",
] as const;

type Category = (typeof ALL_CATEGORIES)[number];

function defaultEntry(cat: Category): { spec: string; grade: SeverityGrade } {
  return { spec: "", grade: "A" };
}

function normalizeCategoryEntry(raw: {
  spec?: string;
  grade?: unknown;
  score?: unknown;
}): { spec: string; grade: SeverityGrade } {
  return {
    spec: typeof raw.spec === "string" ? raw.spec : "",
    grade: normalizeSeverityGrade(raw.grade ?? raw.score, "A"),
  };
}

async function main() {
  const outPath =
    process.argv[2] ??
    `skinnfit-annotations-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.json`;

  const [stateRow] = await db
    .select()
    .from(annotatorState)
    .where(eq(annotatorState.scope, ANNOTATOR_SCOPE))
    .limit(1);

  const store = parseCollaborationStore(stateRow ?? null);
  const mergedLabels = mergedLabelsForExport(store);
  const rawShapes = allShapesMerged(store);

  const annotations = rawShapes
    .filter((ann) => Array.isArray(ann.points) && ann.points.length >= (ann.type === "line" ? 2 : 3))
    .map((ann) => {
      const severity = normalizeSeverityGrade(ann.severity, "A");
      return {
        ...ann,
        severity,
        score: severityGradeToScore(severity),
      };
    });

  const images = await db
    .select({
      fileName: annotatorImages.fileName,
      sortOrder: annotatorImages.sortOrder,
    })
    .from(annotatorImages)
    .orderBy(asc(annotatorImages.sortOrder), asc(annotatorImages.id));

  const labelsByImageIndex: Record<
    string,
    Record<Category, { spec: string; grade: SeverityGrade; score: number }>
  > = {};

  for (let i = 0; i < images.length; i++) {
    const base = Object.fromEntries(ALL_CATEGORIES.map((c) => [c, defaultEntry(c)])) as Record<
      Category,
      { spec: string; grade: SeverityGrade }
    >;
    const patch = mergedLabels[String(i)] ?? {};
    const merged = { ...base };
    for (const c of ALL_CATEGORIES) {
      const entry = patch[c];
      if (entry) merged[c] = normalizeCategoryEntry(entry);
    }
    labelsByImageIndex[String(i)] = Object.fromEntries(
      ALL_CATEGORIES.map((c) => [
        c,
        {
          spec: merged[c].spec,
          grade: merged[c].grade,
          score: severityGradeToScore(merged[c].grade),
        },
      ])
    ) as Record<Category, { spec: string; grade: SeverityGrade; score: number }>;
  }

  const payload = {
    schemaVersion: 2,
    app: "skinnfit-clinical-annotator",
    exportedAt: new Date().toISOString(),
    note:
      "Images are not embedded. Match `images[].fileName` to files on disk. Points are normalized 0–1 vs image width/height. `grade` is A–E (A=least severe); `score` is numeric 1–5 for eval pipelines. Merged export includes all collaborators' shapes and labels.",
    imageCount: images.length,
    images: images.map((img, i) => ({
      index: i,
      fileName: img.fileName,
      imageWidth: null,
      imageHeight: null,
    })),
    labelsByImageIndex,
    annotations,
  };

  const json = JSON.stringify(payload, null, 2);
  writeFileSync(outPath, json, "utf8");
  console.error(
    `Exported ${annotations.length} annotations, ${images.length} images → ${outPath} (${(json.length / 1024 / 1024).toFixed(2)} MB)`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
