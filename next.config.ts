import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const PDFJS_TRACE = [
  "./node_modules/pdfjs-dist/package.json",
  "./node_modules/pdfjs-dist/legacy/build/pdf.mjs",
  "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
  "./node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs",
];

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingIncludes: {
    // kAI reads these at runtime (src/lib/kaiKnowledge.ts); make sure they ship in the image.
    "/api/ai/chat": [
      "./src/data/rag/open_sources_chunks.json",
      "./src/data/rag/clinic_chunks.json",
    ],
    "/api/skinfit-report-generator": PDFJS_TRACE,
    "/api/doctor/patients/**": PDFJS_TRACE,
  },
  serverExternalPackages: [
    "@mediapipe/tasks-vision",
    "bullmq",
    "ioredis",
    "pdfjs-dist",
    "sharp",
    "jspdf",
  ],
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

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
  sourcemaps: {
    disable: false,
  },
});
