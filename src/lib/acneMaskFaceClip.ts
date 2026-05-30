/** Bump when acne face-clip algorithm changes (triggers one-time re-clip on report open). */
export const ACNE_MASK_FACE_CLIP_VERSION = 2;

export function acneMaskNeedsFaceClip(scores: Record<string, unknown>): boolean {
  return scores.acneMaskFaceClipVersion !== ACNE_MASK_FACE_CLIP_VERSION;
}
