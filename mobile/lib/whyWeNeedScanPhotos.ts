/** Bundled asset — avoids slow remote fetch of the web portal image. */
export const FACE_OUTLINE_DIAGRAM_IMAGE = require("@/assets/images/face-outline-diagram.png");

export const WHY_WE_NEED_SCAN_PHOTOS = {
  title: "Why we need these photos?",
  subtitle:
    "These 3 photos help our AI analyze your facial features accurately and provide you with personalized recommendations.",
  left: [
    {
      title: "Front Profile",
      description: "Overall facial symmetry",
    },
  ],
  right: [
    {
      title: "Side Profiles",
      description: "Left and right contours",
    },
  ],
} as const;
