/**
 * Smoke test: dual POST /analyze + merge (same as scan route + dual_pose_scan.ipynb).
 * Run: npx tsx src/scripts/verify-dual-pose-pipeline.ts [centre.jpg] [smiling.jpg]
 */
import "dotenv/config";
import { readFileSync } from "fs";
import { buildScanPayloadFromCentreAndSmiling } from "@/src/lib/modelClinicalMetrics";
import {
  normalizeModelFeatureScores,
  type FaceAnalysisInferenceResult,
} from "@/src/lib/faceAnalysisInference";

const base = process.env.FACE_ANALYSIS_SERVICE_URL?.trim();
const secret = process.env.FACE_ANALYSIS_SERVICE_SECRET?.trim();

async function analyzeFile(path: string): Promise<FaceAnalysisInferenceResult> {
  if (!base) throw new Error("FACE_ANALYSIS_SERVICE_URL not set");
  const buf = readFileSync(path);
  const fd = new FormData();
  fd.append("image", new Blob([buf]), path.split("/").pop() || "scan.jpg");
  const headers: HeadersInit = {};
  if (secret) headers["X-API-Key"] = secret;
  const url = `${base.replace(/\/$/, "")}/analyze`;
  const res = await fetch(url, { method: "POST", body: fd, headers });
  const json = (await res.json()) as {
    ok?: boolean;
    detail?: string;
    metrics?: FaceAnalysisInferenceResult["metrics"];
    modelFeatureScores?: Record<string, unknown>;
    detected_regions?: FaceAnalysisInferenceResult["detected_regions"];
    acneMaskDataUri?: string;
    wrinkleMaskDataUri?: string;
  };
  if (!res.ok || !json.ok) {
    throw new Error(json.detail || `HTTP ${res.status}`);
  }
  return {
    metrics: json.metrics!,
    modelFeatureScores: normalizeModelFeatureScores(json.modelFeatureScores),
    detected_regions: json.detected_regions ?? [],
    ...(json.acneMaskDataUri ? { acneMaskDataUri: json.acneMaskDataUri } : {}),
    ...(json.wrinkleMaskDataUri
      ? { wrinkleMaskDataUri: json.wrinkleMaskDataUri }
      : {}),
  };
}

async function main() {
  const centrePath =
    process.argv[2] ||
    "/Users/sagnikdey/Desktop/face_analysis_tool/face.png";
  const smilePath = process.argv[3] || centrePath;

  if (process.env.FACE_ANALYSIS_SINGLE_IMAGE === "1") {
    console.warn("WARN: FACE_ANALYSIS_SINGLE_IMAGE=1 — production uses dual-pose");
  }
  if (process.env.FACE_ANALYSIS_USE_V2 === "1") {
    console.warn("WARN: FACE_ANALYSIS_USE_V2=1 — production uses dual /analyze");
  }

  console.log("API:", base);
  console.log("Centre:", centrePath);
  console.log("Smiling:", smilePath);

  const [centre, smiling] = await Promise.all([
    analyzeFile(centrePath),
    analyzeFile(smilePath),
  ]);

  const merged = buildScanPayloadFromCentreAndSmiling(centre, smiling);

  console.log("\n--- Merge (production) ---");
  console.log("active_acne (centre):", merged.modelFeatureScores.active_acne);
  console.log("wrinkle_severity (smile):", merged.modelFeatureScores.wrinkle_severity);
  console.log("wrinkle_mask_severity:", merged.modelFeatureScores.wrinkle_mask_severity);
  console.log("legacy wrinkles 0-100:", merged.legacyMetrics.wrinkles);
  console.log("acne mask:", Boolean(merged.acneMaskDataUri));
  console.log("wrinkle mask:", Boolean(merged.wrinkleMaskDataUri));

  if (!merged.acneMaskDataUri) {
    console.error("FAIL: missing acneMaskDataUri");
    process.exit(1);
  }
  if (!merged.wrinkleMaskDataUri) {
    console.error("FAIL: missing wrinkleMaskDataUri");
    process.exit(1);
  }
  console.log("\nOK: dual-pose pipeline verified");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
