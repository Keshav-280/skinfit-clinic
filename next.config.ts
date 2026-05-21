import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@mediapipe/tasks-vision"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
    ],
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "date-fns"],
  },
};

export default nextConfig;
