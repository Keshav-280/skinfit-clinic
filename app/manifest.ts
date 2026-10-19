import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SkinFit Wellness",
    short_name: "SkinFit",
    description:
      "Clinical indigo, softened by rose - AI-guided skin care with your doctor.",
    id: "/",
    scope: "/",
    start_url: "/dashboard",
    display: "standalone",
    orientation: "portrait",
    lang: "en-IN",
    categories: ["health", "medical", "lifestyle"],
    // Lets PWABuilder / Play tooling use the existing Play listing's package name.
    related_applications: [
      {
        platform: "play",
        url: "https://play.google.com/store/apps/details?id=app.skinfit.clinic",
        id: "app.skinfit.clinic",
      },
    ],
    prefer_related_applications: false,
    background_color: "#FAF8F5",
    theme_color: "#1E1B31",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/brand/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/brand/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
