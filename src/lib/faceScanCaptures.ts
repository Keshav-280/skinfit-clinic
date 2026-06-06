/** Per-step tips shown during live capture (mobile + web). */
export const CAPTURE_STEP_TIPS = {
  centre: [
    "Keep your head straight",
    "Eyes open naturally",
    "Relax your face",
  ],
  left: [
    "Keep your head level",
    "Don't tilt up or down",
    "Show full side of your face",
  ],
  right: [
    "Keep your head level",
    "Don't tilt up or down",
    "Show full side of your face",
  ],
  smiling: [
    "Smile naturally",
    "Show your teeth",
    "Keep your head straight",
  ],
  eyes_closed: [
    "Don't squeeze your eyes",
    "Relax your face",
    "Keep your head straight",
  ],
} as const satisfies Record<string, readonly [string, string, string]>;

/** Five-angle protocol for kAI baseline + weekly tracker (order matters for API). */
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
    subtitle: "Turn your face to the left.",
    tips: CAPTURE_STEP_TIPS.left,
    instruction:
      "Turn your head ~30° to your left. Keep the same framing and rotate your face only. No spectacles.",
  },
  {
    id: "right",
    title: "Right Side Profile",
    subtitle: "Turn your face to the right.",
    tips: CAPTURE_STEP_TIPS.right,
    instruction: "Turn your head ~30° to your right. Same framing as the previous shot. No spectacles.",
  },
  {
    id: "eyes_closed",
    title: "Eyes Closed",
    subtitle: "Close your eyes gently and relax your face.",
    tips: CAPTURE_STEP_TIPS.eyes_closed,
    instruction:
      "Face forward again with eyes gently closed. Remove spectacles. AI checks eye closure.",
  },
  {
    id: "smiling",
    title: "Smiling Photo",
    subtitle: "Face the camera and give a natural smile.",
    tips: CAPTURE_STEP_TIPS.smiling,
    instruction:
      "Natural smile — teeth optional. Remove spectacles. Same framing as the front shot.",
  },
] as const;

export type FaceScanCaptureId = (typeof FACE_SCAN_CAPTURE_STEPS)[number]["id"];

/** Used when the patient skips naming a scan. */
export const DEFAULT_SCAN_NAME = "Untitled Scan";

export const SCAN_NAME_INPUT_PLACEHOLDER = "e.g., Morning routine (optional)";

export function resolveScanName(name: string | null | undefined): string {
  const trimmed = name?.trim();
  return trimmed || DEFAULT_SCAN_NAME;
}

/** Short tips under the upload zone (web has no shutter countdown). */
export const FACE_SCAN_INSTRUCTIONS_BELOW_CAMERA = [
  "Natural light; avoid harsh backlight.",
  "Camera at eye level, face centered.",
  "Remove spectacles before capture.",
] as const;
