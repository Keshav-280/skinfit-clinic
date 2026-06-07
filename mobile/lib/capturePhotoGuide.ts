const WEB_BASE =
  process.env.EXPO_PUBLIC_WEB_PORTAL_URL?.replace(/\/$/, "") ??
  process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "") ??
  "";

const PHOTO_GUIDE = `${WEB_BASE}/images/photo-guide`;

export const CAPTURE_PHOTO_GUIDE_CARDS = [
  {
    title: "Good Lighting",
    description: "Use natural light facing your face",
    good: true,
    image: `${PHOTO_GUIDE}/good-lighting.jpg`,
  },
  {
    title: "Hair Back",
    description: "Keep your hair off your face",
    good: true,
    image: `${PHOTO_GUIDE}/hair-back.jpg`,
  },
  {
    title: "No Accessories",
    description: "Remove glasses, earrings, caps",
    good: true,
    image: `${PHOTO_GUIDE}/no-accessories.jpg`,
  },
  {
    title: "Avoid Sunglasses",
    description: "Don't wear sunglasses or tinted glasses",
    good: false,
    image: `${PHOTO_GUIDE}/avoid-sunglasses.jpg`,
  },
  {
    title: "Avoid Dark Lighting",
    description: "Don't stand in dark or backlight",
    good: false,
    image: `${PHOTO_GUIDE}/avoid-dark-lighting.jpg`,
  },
] as const;

export const CAPTURE_PHOTO_GUIDE_GOOD = [
  "Clear and bright",
  "Face in frame",
  "Neutral background",
  "Look at the camera",
] as const;

export const CAPTURE_PHOTO_GUIDE_AVOID = [
  "Blurry or low quality",
  "Face not visible",
  "Busy background",
  "Extreme angles",
] as const;

export const CAPTURE_PHOTO_GUIDE_SUMMARY_GOOD = `${PHOTO_GUIDE}/summary-good.jpg`;
export const CAPTURE_PHOTO_GUIDE_SUMMARY_AVOID = `${PHOTO_GUIDE}/summary-avoid.jpg`;
