import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SkinFit Wellness",
    short_name: "SkinFit",
    description:
      "Clinical indigo, softened by rose — AI-guided skin care with your doctor.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#FAF8F5",
    theme_color: "#1E1B31",
    icons: [
      { src: "/icon", sizes: "192x192", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
