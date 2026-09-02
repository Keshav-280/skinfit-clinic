import { format } from "date-fns";

/** Per-step tips shown during live capture (mobile + web). */
export const CAPTURE_STEP_TIPS = {
  centre: [
    "Keep your head straight",
    "Eyes open naturally",
    "Relax your face",
  ],
  left: [
    "Turn right to show your left side",
    "Keep your head level",
    "Don't tilt up or down",
  ],
  right: [
    "Turn left to show your right side",
    "Keep your head level",
    "Don't tilt up or down",
  ],
} as const satisfies Record<string, readonly [string, string, string]>;

/** Three-angle protocol for kAI baseline + weekly tracker (order matters for API). */
export const FACE_SCAN_CAPTURE_STEPS = [
  {
    id: "centre",
    title: "Front Profile",
    subtitle: "Look straight into the camera with a relaxed face.",
    tips: CAPTURE_STEP_TIPS.centre,
    instruction:
      "Look straight at the camera. Neutral expression, eyes open. Remove spectacles. Keep your face centered in the frame.",
  },
  {
    id: "left",
    title: "Left Side Profile",
    subtitle: "Turn your face to the right so your left side faces the camera.",
    tips: CAPTURE_STEP_TIPS.left,
    instruction:
      "Turn your head ~30° to your right so your left profile faces the camera. Keep the same framing and rotate your face only. No spectacles.",
  },
  {
    id: "right",
    title: "Right Side Profile",
    subtitle: "Turn your face to the left so your right side faces the camera.",
    tips: CAPTURE_STEP_TIPS.right,
    instruction:
      "Turn your head ~30° to your left so your right profile faces the camera. Same framing as the previous shot. No spectacles.",
  },
] as const;

export type FaceScanCaptureId = (typeof FACE_SCAN_CAPTURE_STEPS)[number]["id"];

/** Left/right profile shots - one cheek faces away, so frame-half brightness differs by design. */
export function isSideProfileCaptureStep(
  stepId: FaceScanCaptureId | string | null | undefined
): boolean {
  return stepId === "left" || stepId === "right";
}

/** @deprecated use buildAutoScanName - kept for legacy rows/labels */
export const DEFAULT_SCAN_NAME = "Untitled Scan";

export type BuildAutoScanNameOptions = {
  /** 1-based scan index for this patient; omitted when unknown. */
  scanNumber?: number;
  at?: Date;
};

/** `Scan-3-06-06-2026-14-30` - number, date, and time for easy sorting. */
export function buildAutoScanName(options: BuildAutoScanNameOptions = {}): string {
  const at = options.at ?? new Date();
  const datePart = format(at, "dd-MM-yyyy");
  const timePart = format(at, "HH-mm");
  const n = options.scanNumber;
  if (typeof n === "number" && n > 0) {
    return `Scan-${n}-${datePart}-${timePart}`;
  }
  return `Scan-${datePart}-${timePart}`;
}

export const SCAN_NAME_INPUT_PLACEHOLDER = buildAutoScanName({
  scanNumber: 1,
  at: new Date(2026, 5, 6, 14, 30),
});

export function resolveScanName(
  name: string | null | undefined,
  options?: BuildAutoScanNameOptions
): string {
  const trimmed = name?.trim();
  return trimmed || buildAutoScanName(options);
}

export async function fetchNextScanNumber(
  loadHome: () => Promise<{ skinScanHistory?: unknown[] | null }>
): Promise<number> {
  try {
    const data = await loadHome();
    const count = Array.isArray(data.skinScanHistory) ? data.skinScanHistory.length : 0;
    return count + 1;
  } catch {
    return 1;
  }
}

/** Short tips under the upload zone (web has no shutter countdown). */
export const FACE_SCAN_INSTRUCTIONS_BELOW_CAMERA = [
  "Natural light; avoid harsh backlight.",
  "Camera at eye level, face centered.",
  "Remove spectacles before capture.",
] as const;
