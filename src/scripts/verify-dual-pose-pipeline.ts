/**
 * Smoke test: POST /analyze_dual_scan + merge (production scan route default).
 * Run: npx tsx src/scripts/verify-dual-pose-pipeline.ts [centre.jpg] [smiling.jpg]
 */
import "dotenv/config";
import { readFileSync } from "fs";
import { buildScanPayloadFromAnalyzeV1 } from "@/src/lib/modelClinicalMetrics";
import { runFaceAnalysisDualScan } from "@/src/lib/faceAnalysisInference";
import { getFaceAnalysisServiceSecret } from "@/src/lib/faceAnalysisEnv";

const base = process.env.FACE_ANALYSIS_SERVICE_URL?.trim();
const secret = getFaceAnalysisServiceSecret();

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

  const centreBuf = readFileSync(centrePath);
  const smileBuf = readFileSync(smilePath);
  const centreFile = new File(
    [centreBuf],
    centrePath.split("/").pop() || "centre.jpg",
    { type: "image/jpeg" }
  );
  const smilingFile = new File(
    [smileBuf],
    smilePath.split("/").pop() || "smiling.jpg",
    { type: "image/jpeg" }
  );

  const dualScan = await runFaceAnalysisDualScan(centreFile, smilingFile, {
    baseUrl: base!,
    apiKey: secret,
    timeoutMs: 120_000,
  });
  const merged = buildScanPayloadFromAnalyzeV1(dualScan);

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
