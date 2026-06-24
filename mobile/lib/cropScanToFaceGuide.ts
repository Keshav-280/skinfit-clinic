/**
 * @deprecated Client-side face-guide crop removed — uploads are full-frame for identity;
 * tight ML crop runs on the server in `src/lib/cropScanImageForMl.ts`.
 */
export type ViewfinderSize = { width: number; height: number };

export async function cropScanPhotoToFaceGuide(
  uri: string,
  _stepId: unknown,
  _viewfinder?: ViewfinderSize,
  _opts?: { zoom?: number }
): Promise<string> {
  return uri;
}
