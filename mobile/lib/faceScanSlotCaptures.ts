import { FACE_SCAN_CAPTURE_STEPS } from "@/lib/faceScanCaptures";

export const FACE_SCAN_SLOT_COUNT = FACE_SCAN_CAPTURE_STEPS.length;

export type FaceScanSlotUris = (string | null)[];

export function emptyFaceScanSlots(): FaceScanSlotUris {
  return Array.from({ length: FACE_SCAN_SLOT_COUNT }, () => null);
}

export function filledFaceScanSlotCount(slots: FaceScanSlotUris): number {
  return slots.filter(Boolean).length;
}

export function allFaceScanSlotsFilled(slots: FaceScanSlotUris): boolean {
  return slots.length === FACE_SCAN_SLOT_COUNT && slots.every(Boolean);
}

export function firstEmptyFaceScanSlotIndex(slots: FaceScanSlotUris): number {
  const idx = slots.findIndex((s) => !s);
  return idx >= 0 ? idx : FACE_SCAN_SLOT_COUNT - 1;
}

export function faceScanSlotsToUris(slots: FaceScanSlotUris): string[] {
  return slots.filter((u): u is string => typeof u === "string" && u.length > 0);
}

/** Fill empty slots in order with picked image URIs (web parity). */
export function applyImagesToEmptyFaceScanSlots(
  slots: FaceScanSlotUris,
  imageUris: string[]
): { slots: FaceScanSlotUris; added: number; skipped: number } {
  const next = [...slots];
  let imageIdx = 0;
  let added = 0;
  for (let i = 0; i < FACE_SCAN_SLOT_COUNT && imageIdx < imageUris.length; i++) {
    if (next[i]) continue;
    next[i] = imageUris[imageIdx++]!;
    added += 1;
  }
  const skipped = Math.max(0, imageUris.length - added);
  return { slots: next, added, skipped };
}

export function assignFaceScanSlot(
  slots: FaceScanSlotUris,
  index: number,
  uri: string
): FaceScanSlotUris {
  const next = [...slots];
  next[index] = uri;
  return next;
}

export function clearFaceScanSlot(
  slots: FaceScanSlotUris,
  index: number
): FaceScanSlotUris {
  const next = [...slots];
  next[index] = null;
  return next;
}
