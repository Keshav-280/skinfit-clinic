import type { AnnotatorShape } from "@/src/lib/annotatorAnnotations";

export type AnnotatorAssignmentRange = {
  userId: string;
  startIndex: number;
  endIndex: number;
  userName?: string | null;
  userEmail?: string | null;
};

export type AnnotatorPersistedState = {
  perImageByCategory: Record<
    string,
    Record<string, { spec?: string; grade?: string; score?: number }>
  >;
  annotations: AnnotatorShape[];
  currentIndex: number;
};

/** Split [0, imageCount-1] evenly across annotators (stable order). */
export function rebalanceAssignmentRanges(
  userIds: string[],
  imageCount: number
): AnnotatorAssignmentRange[] {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0 || imageCount <= 0) return [];

  const base = Math.floor(imageCount / ids.length);
  const remainder = imageCount % ids.length;
  let cursor = 0;

  return ids.map((userId, i) => {
    const size = base + (i < remainder ? 1 : 0);
    const startIndex = cursor;
    const endIndex = size > 0 ? cursor + size - 1 : cursor - 1;
    cursor = endIndex + 1;
    return { userId, startIndex, endIndex };
  });
}

export function assignmentForUser(
  userId: string,
  assignments: AnnotatorAssignmentRange[]
): AnnotatorAssignmentRange | null {
  return assignments.find((a) => a.userId === userId) ?? null;
}

export function ownerUserIdForImageIndex(
  imageIndex: number,
  assignments: AnnotatorAssignmentRange[]
): string | null {
  for (const a of assignments) {
    if (imageIndex >= a.startIndex && imageIndex <= a.endIndex) return a.userId;
  }
  return null;
}

export function imageIndexInAssignment(
  imageIndex: number,
  assignment: Pick<AnnotatorAssignmentRange, "startIndex" | "endIndex"> | null
): boolean {
  if (!assignment) return true;
  return imageIndex >= assignment.startIndex && imageIndex <= assignment.endIndex;
}

export function pickLabelsInRange(
  perImageByCategory: AnnotatorPersistedState["perImageByCategory"],
  startIndex: number,
  endIndex: number
): AnnotatorPersistedState["perImageByCategory"] {
  const out: AnnotatorPersistedState["perImageByCategory"] = {};
  for (const [idx, patch] of Object.entries(perImageByCategory ?? {})) {
    const imageIndex = Number(idx);
    if (!Number.isFinite(imageIndex)) continue;
    if (imageIndex < startIndex || imageIndex > endIndex) continue;
    out[String(imageIndex)] = patch;
  }
  return out;
}

export function pickAnnotationsInRange(
  annotations: AnnotatorShape[],
  startIndex: number,
  endIndex: number
): AnnotatorShape[] {
  return (annotations ?? []).filter(
    (ann) =>
      Number.isFinite(ann.imageIndex) &&
      ann.imageIndex >= startIndex &&
      ann.imageIndex <= endIndex
  );
}

export function filterPersistedStateForRange(
  state: AnnotatorPersistedState,
  startIndex: number,
  endIndex: number
): AnnotatorPersistedState {
  return {
    perImageByCategory: pickLabelsInRange(state.perImageByCategory, startIndex, endIndex),
    annotations: pickAnnotationsInRange(state.annotations, startIndex, endIndex),
    currentIndex: Math.min(
      Math.max(startIndex, state.currentIndex),
      endIndex
    ),
  };
}

export function stripPersistedStateToAssignment(
  state: AnnotatorPersistedState,
  assignment: Pick<AnnotatorAssignmentRange, "startIndex" | "endIndex"> | null
): AnnotatorPersistedState {
  if (!assignment) return state;
  return filterPersistedStateForRange(
    state,
    assignment.startIndex,
    assignment.endIndex
  );
}
