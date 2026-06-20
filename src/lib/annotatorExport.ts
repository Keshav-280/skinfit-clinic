import {
  ANNOTATOR_CATEGORIES,
  fullAnnotatorCategoryDefaults,
  type AnnotatorCategory,
} from "@/src/lib/annotatorTaxonomy";
import type { AnnotatorShape } from "@/src/lib/annotatorAnnotations";
import {
  ownerUserIdForImageIndex,
  type AnnotatorAssignmentRange,
  type AnnotatorPersistedState,
} from "@/src/lib/annotatorAssignments";
import {
  isSeverityGrade,
  normalizeSeverityGrade,
  severityGradeToScore,
  type SeverityGrade,
} from "@/src/lib/annotatorSeverityGrade";

export type AnnotatorExportImageMeta = {
  index: number;
  fileName: string;
  imageWidth: number | null;
  imageHeight: number | null;
};

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

function labelsForImage(
  perImageByCategory: AnnotatorPersistedState["perImageByCategory"],
  imageIndex: number
): Record<AnnotatorCategory, { spec: string; grade: SeverityGrade; score: number }> {
  const base = fullAnnotatorCategoryDefaults();
  const patch = perImageByCategory[String(imageIndex)] ?? {};
  const merged: Record<AnnotatorCategory, { spec: string; grade: SeverityGrade }> = {
    ...base,
  };
  for (const c of ANNOTATOR_CATEGORIES) {
    if (patch[c]) merged[c] = normalizeCategoryEntry({ ...base[c], ...patch[c] });
  }
  return Object.fromEntries(
    ANNOTATOR_CATEGORIES.map((c) => [
      c,
      {
        spec: merged[c].spec,
        grade: merged[c].grade,
        score: severityGradeToScore(merged[c].grade),
      },
    ])
  ) as Record<AnnotatorCategory, { spec: string; grade: SeverityGrade; score: number }>;
}

export function buildMergedAnnotatorExport(params: {
  images: AnnotatorExportImageMeta[];
  assignments: AnnotatorAssignmentRange[];
  statesByUserId: Map<string, AnnotatorPersistedState>;
  imageDimensions?: Record<number, { width: number; height: number }>;
}) {
  const { images, assignments, statesByUserId, imageDimensions = {} } = params;
  const parallelConfigured = assignments.length > 0;

  const labelsByImageIndex: Record<
    string,
    Record<AnnotatorCategory, { spec: string; grade: SeverityGrade; score: number }>
  > = {};

  const annotationBuckets: AnnotatorShape[] = [];

  for (const img of images) {
    const idx = img.index;
    let ownerId: string | null = null;
    if (parallelConfigured) {
      ownerId = ownerUserIdForImageIndex(idx, assignments);
    } else {
      ownerId = statesByUserId.keys().next().value ?? null;
    }

    const ownerState = ownerId ? statesByUserId.get(ownerId) : undefined;
    if (ownerState) {
      labelsByImageIndex[String(idx)] = labelsForImage(ownerState.perImageByCategory, idx);
      for (const ann of ownerState.annotations) {
        if (ann.imageIndex === idx) annotationBuckets.push(ann);
      }
    } else {
      labelsByImageIndex[String(idx)] = labelsForImage({}, idx);
    }
  }

  const exportAnnotations = annotationBuckets.map((ann) => ({
    ...ann,
    score: severityGradeToScore(
      isSeverityGrade(ann.severity) ? ann.severity : normalizeSeverityGrade(ann.severity, "A")
    ),
  }));

  return {
    schemaVersion: 2 as const,
    app: "skinnfit-clinical-annotator",
    exportedAt: new Date().toISOString(),
    note:
      "Images are not embedded. Match `images[].fileName` to files on disk. Points are normalized 0–1 vs image width/height. `grade` is A–E (A=least severe); `score` is numeric 1–5 for eval pipelines. Parallel mode merges each image from its assigned annotator.",
    parallel: {
      configured: parallelConfigured,
      assignments: assignments.map((a) => ({
        userId: a.userId,
        userName: a.userName ?? null,
        userEmail: a.userEmail ?? null,
        startIndex: a.startIndex,
        endIndex: a.endIndex,
      })),
    },
    imageCount: images.length,
    images: images.map((img) => ({
      index: img.index,
      fileName: img.fileName,
      imageWidth: imageDimensions[img.index]?.width ?? img.imageWidth ?? null,
      imageHeight: imageDimensions[img.index]?.height ?? img.imageHeight ?? null,
    })),
    labelsByImageIndex,
    annotations: exportAnnotations,
  };
}
