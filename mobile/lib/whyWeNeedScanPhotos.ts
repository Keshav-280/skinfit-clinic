const WEB_BASE =
  process.env.EXPO_PUBLIC_WEB_PORTAL_URL?.replace(/\/$/, "") ??
  process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "") ??
  "";

export const FACE_OUTLINE_DIAGRAM_URL = `${WEB_BASE}/images/face-outline-diagram.png?v=2`;

export const WHY_WE_NEED_SCAN_PHOTOS = {
  title: "Why we need these photos?",
  subtitle:
    "These 5 photos help our AI analyze your facial features accurately and provide you with personalized recommendations.",
  left: [
    {
      title: "Side Profiles",
      description: "Helps analyze facial structure and contours",
    },
    {
      title: "Front Profile",
      description: "Helps assess overall facial symmetry",
    },
  ],
  right: [
    {
      title: "Smiling Photo",
      description: "Helps evaluate smile lines and dynamics",
    },
    {
      title: "Eyes Closed",
      description: "Helps analyze skin and fine lines better",
    },
  ],
} as const;
