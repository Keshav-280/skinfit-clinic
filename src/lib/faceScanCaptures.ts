/** Five-angle protocol for kAI baseline + weekly tracker (order matters for API). */
export const FACE_SCAN_CAPTURE_STEPS = [
  {
    id: "centre",
    title: "Front face — neutral",
    instruction:
      "Look straight at the camera. Neutral expression, eyes open. Natural light, face fills the oval.",
  },
  {
    id: "left",
    title: "Turn head left",
    instruction: "Turn your head ~30° to your left. Keep shoulders still; only rotate your face.",
  },
  {
    id: "right",
    title: "Turn head right",
    instruction: "Turn your head ~30° to your right. Same framing as the previous shot.",
  },
  {
    id: "eyes_closed",
    title: "Front face — eyes closed",
    instruction: "Face forward again with your eyes gently closed. Relax your forehead.",
  },
  {
    id: "smiling",
    title: "Front face — smiling",
    instruction: "Natural smile — teeth optional. This helps assess dynamic lines vs static wrinkles.",
  },
] as const;

export type FaceScanCaptureId = (typeof FACE_SCAN_CAPTURE_STEPS)[number]["id"];

/** Short tips under the upload zone (web has no shutter countdown). */
export const FACE_SCAN_INSTRUCTIONS_BELOW_CAMERA = [
  "Natural light; avoid harsh backlight.",
  "Camera at eye level, face centered.",
] as const;
