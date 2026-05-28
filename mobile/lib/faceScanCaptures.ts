/** Keep in sync with repo root `src/lib/faceScanCaptures.ts`. */

/** Five-angle protocol for kAI baseline + weekly tracker (order matters for API). */
export const FACE_SCAN_CAPTURE_STEPS = [
  {
    id: "centre",
    title: "Front face — neutral",
    instruction:
      "Look straight at the camera. Neutral expression, eyes open. Remove spectacles. Keep your face centered in the frame.",
  },
  {
    id: "left",
    title: "Turn head left",
    instruction:
      "Turn your head ~30° to your left. Keep the same framing and rotate your face only. No spectacles.",
  },
  {
    id: "right",
    title: "Turn head right",
    instruction: "Turn your head ~30° to your right. Same framing as the previous shot. No spectacles.",
  },
  {
    id: "eyes_closed",
    title: "Front face — eyes closed",
    instruction:
      "Face forward again with eyes gently closed. Remove spectacles. AI checks eye closure.",
  },
  {
    id: "smiling",
    title: "Front face — smiling",
    instruction:
      "Natural smile — teeth optional. Remove spectacles. Same framing as the front shot.",
  },
] as const;

export type FaceScanCaptureId = (typeof FACE_SCAN_CAPTURE_STEPS)[number]["id"];

export const FACE_SCAN_INSTRUCTIONS_BELOW_CAMERA = [
  "Natural light; avoid harsh backlight.",
  "Camera at eye level, face centered.",
  "Remove spectacles before capture.",
] as const;

export const FACE_SCAN_INSTRUCTIONS = FACE_SCAN_CAPTURE_STEPS.map((s) => s.instruction);
