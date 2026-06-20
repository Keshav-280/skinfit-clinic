import type { SeverityGrade } from "@/src/lib/annotatorSeverityGrade";

export type AnnotatorPoint = { x: number; y: number };

export type AnnotatorShape = {
  id: string;
  imageIndex: number;
  category: string;
  spec: string;
  severity: SeverityGrade;
  color: string;
  type: "path" | "line";
  points: AnnotatorPoint[];
};

/** Drop shapes whose imageIndex is out of range. */
export function pruneAnnotations(
  annotations: AnnotatorShape[],
  imageCount: number
): AnnotatorShape[] {
  if (imageCount <= 0) return [];
  return annotations.filter(
    (ann) =>
      Number.isFinite(ann.imageIndex) &&
      ann.imageIndex >= 0 &&
      ann.imageIndex < imageCount
  );
}

/**
 * When the image list is rebuilt, remap shapes by fileName so labels stay on the same photo.
 * Falls back to pruning invalid indices when a fileName mapping is missing.
 */
export function remapAnnotationsByFileName(
  annotations: AnnotatorShape[],
  prevMeta: { name: string }[],
  nextMeta: { name: string }[],
  nextCount: number
): AnnotatorShape[] {
  if (nextCount <= 0) return [];

  const nextIndexByName = new Map<string, number>();
  nextMeta.forEach((m, i) => {
    if (i < nextCount && m.name) nextIndexByName.set(m.name, i);
  });

  const remapped: AnnotatorShape[] = [];
  for (const ann of annotations) {
    const oldName = prevMeta[ann.imageIndex]?.name;
    if (oldName && nextIndexByName.has(oldName)) {
      remapped.push({ ...ann, imageIndex: nextIndexByName.get(oldName)! });
      continue;
    }
    if (ann.imageIndex >= 0 && ann.imageIndex < nextCount) {
      remapped.push(ann);
    }
  }
  return remapped;
}

export function reconcileAnnotationsForImageSet(
  annotations: AnnotatorShape[],
  prevMeta: { name: string }[],
  nextMeta: { name: string }[]
): AnnotatorShape[] {
  const nextCount = nextMeta.length;
  if (prevMeta.length > 0 && nextMeta.length > 0) {
    return pruneAnnotations(
      remapAnnotationsByFileName(annotations, prevMeta, nextMeta, nextCount),
      nextCount
    );
  }
  return pruneAnnotations(annotations, nextCount);
}
