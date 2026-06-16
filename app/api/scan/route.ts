import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { eq } from "drizzle-orm";
import { db } from "../../../src/db";
import { scans, skinScans, users } from "../../../src/db/schema";
import { getSessionUserIdFromRequest } from "../../../src/lib/auth/get-session";
import { buildDummyAiSummary } from "../../../src/lib/dummyScanSummary";
import { patientClarityToGrade } from "../../../src/lib/clarityGrade";
import { getFaceAnalysisServiceSecret } from "../../../src/lib/faceAnalysisEnv";
import {
  runFaceAnalysisDualScan,
  runFaceAnalysisCentreSmiling,
  runFaceAnalysisService,
} from "../../../src/lib/faceAnalysisInference";
import { runFaceAnalysisServiceV2 } from "../../../src/lib/faceAnalysisInferenceV2";
import { FACE_SCAN_CAPTURE_STEPS } from "../../../src/lib/faceScanCaptures";
import {
  inferenceParamsToRows,
  insertParameterScoresForScan,
} from "../../../src/lib/insertParameterScores";
import { persistScanTrackerSnapshot } from "../../../src/lib/scanTrackerSnapshot";
import { getAssignedDoctorIdForPatient } from "../../../src/lib/doctorPatientCare";
import { notifyDoctorsPatientScanCompleted } from "../../../src/lib/scanDoctorAlerts";
import { readWebFormData } from "../../../src/lib/webRequestFormData";
import {
  buildPreviewJpegDataUri,
  bufferToOrientedJpegBuffer,
} from "../../../src/lib/scanImagePreview";
import {
  buildLegacyMetricsFromModel,
  buildScanPayloadFromAnalyzeV1,
  buildScanPayloadFromAnalyzeV2,
  buildScanPayloadFromCentreAndSmiling,
  clinicalScoresFromModel,
  modelEightClarityScores,
  parseModelFeatureScores,
} from "../../../src/lib/modelClinicalMetrics";
import {
  invalidateUserHomeCache,
  invalidateUserInsightsCache,
  invalidateUserScanDerivedCaches,
} from "../../../src/lib/infra";
import { computeRagKaiScore } from "../../../src/lib/ragEightParams";

function isMissingFaceCaptureColumn(error: unknown): boolean {
  const err = error as { code?: string; message?: string };
  if (err?.code === "42703") return true;
  const m = err?.message ?? "";
  return (
    /face_capture_images/i.test(m) &&
    (/does not exist/i.test(m) || /undefined column/i.test(m))
  );
}

function bufferToDataUri(buf: Buffer, mimeType: string): string {
  const mime = mimeType || "image/jpeg";
  return `data:${mime};base64,${buf.toString("base64")}`;
}

const REGION_LABELS = ["Acne", "Wrinkle", "Pigmentation", "Texture"] as const;

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomSeverity15(): number {
  return Math.round((1 + Math.random() * 4) * 10) / 10;
}

function generateClinicalFeatureScores() {
  return {
    active_acne: randomSeverity15(),
    skin_quality: randomSeverity15(),
    wrinkle_severity: randomSeverity15(),
    sagging_volume: randomSeverity15(),
    under_eye: randomSeverity15(),
    hair_health: randomSeverity15(),
    acne_scars: randomSeverity15(),
    pigmentation_model: randomSeverity15(),
  };
}

function generateDetectedRegions(): Array<{
  issue: string;
  coordinates: { x: number; y: number };
}> {
  const templates: Array<{ issue: string; x: number; y: number }> = [
    { issue: "Acne", x: 44, y: 52 },
    { issue: "Acne", x: 56, y: 54 },
    { issue: "Acne", x: 50, y: 58 },
    { issue: "Wrinkle", x: 48, y: 38 },
    { issue: "Wrinkle", x: 42, y: 42 },
    { issue: "Pigmentation", x: 52, y: 44 },
    { issue: "Texture", x: 38, y: 48 },
  ];
  const pick = randomInt(5, 7);
  const out: Array<{ issue: string; coordinates: { x: number; y: number } }> = [];
  const shuffled = [...templates].sort(() => Math.random() - 0.5);
  for (let i = 0; i < pick && i < shuffled.length; i++) {
    const t = shuffled[i];
    out.push({
      issue: t.issue,
      coordinates: {
        x: Math.min(92, Math.max(8, t.x + randomInt(-4, 4))),
        y: Math.min(90, Math.max(12, t.y + randomInt(-4, 4))),
      },
    });
  }
  while (out.length < 5) {
    out.push({
      issue: REGION_LABELS[randomInt(0, REGION_LABELS.length - 1)],
      coordinates: { x: randomInt(30, 70), y: randomInt(28, 72) },
    });
  }
  return out;
}

function severityToClarity(s: number) {
  const x = Math.max(1, Math.min(5, s));
  return Math.round(100 - ((x - 1) / 4) * 100);
}

/** Offline / fallback: four AI-like scores + eight pending (no fake clinical values for pending). */
function buildDummyKaiV2() {
  const mfs = generateClinicalFeatureScores();
  const acne100 = severityToClarity(mfs.active_acne);
  const wr100 = severityToClarity(mfs.wrinkle_severity);
  const el100 = severityToClarity(mfs.sagging_volume);
  const sq100 = severityToClarity(mfs.skin_quality);
  const scar100 = severityToClarity(mfs.acne_scars);
  const underEye100 = severityToClarity(mfs.under_eye);
  const pig100 = severityToClarity(mfs.pigmentation_model);
  const overall =
    computeRagKaiScore({
      active_acne: acne100,
      sagging_volume: el100,
      wrinkles: wr100,
      acne_scar: scar100,
      under_eye: underEye100,
      pigmentation: pig100,
    }) ?? Math.round((acne100 + wr100 + el100 + scar100 + underEye100 + pig100) / 6);
  const params = {
    acne_pimples: { value: acne100, source: "ai" as const, severity_flag: false },
    wrinkles: {
      value: wr100,
      source: "ai" as const,
      severity_flag: false,
      extras: { dynamic_wrinkle_proxy: 0.2, static_wrinkle_proxy: 0.15 },
    },
    elasticity: { value: el100, source: "ai" as const, severity_flag: false },
    skin_quality: { value: sq100, source: "ai" as const, severity_flag: false },
    acne_scars: { value: null, source: "pending" as const, severity_flag: false },
    pores: { value: null, source: "pending" as const, severity_flag: false },
    pigmentation: { value: null, source: "pending" as const, severity_flag: false },
    uniformity: { value: null, source: "pending" as const, severity_flag: false },
    sebum: { value: null, source: "pending" as const, severity_flag: false },
    hydration: { value: null, source: "pending" as const, severity_flag: false },
    redness: { value: null, source: "pending" as const, severity_flag: false },
    tone_evenness: { value: null, source: "pending" as const, severity_flag: false },
    uv_damage: { value: null, source: "pending" as const, severity_flag: false },
  };
  const texture100 = scar100;
  return {
    overallKaiScore: overall,
    params,
    legacyMetrics: {
      acne: acne100,
      wrinkles: wr100,
      pigmentation: pig100,
      hydration: underEye100,
      texture: texture100,
      overall_score: overall,
    },
    modelFeatureScores: {
      active_acne: mfs.active_acne,
      skin_quality: mfs.skin_quality,
      wrinkle_severity: mfs.wrinkle_severity,
      sagging_volume: mfs.sagging_volume,
      under_eye: mfs.under_eye,
      hair_health: mfs.hair_health,
      acne_scars: mfs.acne_scars,
      pigmentation_model: mfs.pigmentation_model,
    },
    detected_regions: generateDetectedRegions(),
  };
}

export async function POST(request: NextRequest) {
  if (
    process.env.SCAN_ASYNC_MODE === "1" ||
    process.env.SCAN_ASYNC_MODE === "true"
  ) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Synchronous scan disabled. Use POST /api/scans/submit and poll GET /api/scans/status/[jobId].",
        asyncEndpoint: "/api/scans/submit",
      },
      { status: 410 }
    );
  }

  try {
    const formData = await readWebFormData(request);
    const scanName = (formData.get("scanName") as string) || "Untitled Scan";

    const multiRaw = formData
      .getAll("images")
      .filter((x): x is File => x instanceof File && x.size > 0);

    if (multiRaw.length !== FACE_SCAN_CAPTURE_STEPS.length) {
      return NextResponse.json(
        {
          success: false,
          error: `Provide exactly ${FACE_SCAN_CAPTURE_STEPS.length} face images in order (${FACE_SCAN_CAPTURE_STEPS.map((s) => s.id).join(", ")}).`,
        },
        { status: 400 }
      );
    }

    const entries: Array<{
      label: string;
      dataUri: string;
      previewDataUri?: string;
    }> = [];
    const filesForV2: Record<
      "centre" | "left" | "right" | "eyes_closed" | "smiling",
      File
    > = {} as Record<
      "centre" | "left" | "right" | "eyes_closed" | "smiling",
      File
    >;

    for (let i = 0; i < multiRaw.length; i++) {
      const file = multiRaw[i];
      const stepId = FACE_SCAN_CAPTURE_STEPS[i].id;
      const rawBuf = Buffer.from(await file.arrayBuffer());
      const buf = await bufferToOrientedJpegBuffer(rawBuf);
      let previewDataUri: string | undefined;
      try {
        previewDataUri = await buildPreviewJpegDataUri(buf);
      } catch {
        previewDataUri = undefined;
      }
      entries.push({
        label: stepId,
        dataUri: bufferToDataUri(buf, "image/jpeg"),
        ...(previewDataUri ? { previewDataUri } : {}),
      });
      filesForV2[stepId] = new File(
        [new Uint8Array(buf)],
        file.name || `${stepId}.jpg`,
        { type: "image/jpeg" }
      );
    }

    const faceCaptureImages = entries;
    const imageDataUri = entries[0].dataUri;

    const userId = await getSessionUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Sign in to save a skin scan." },
        { status: 401 }
      );
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { id: true, name: true, age: true },
    });
    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 400 }
      );
    }

    const scanOpts = { patientAge: user.age ?? null };

    const inferenceBase = process.env.FACE_ANALYSIS_SERVICE_URL?.trim();
    const inferenceSecret = getFaceAnalysisServiceSecret();
    const allowDummyInferenceFallback =
      process.env.FACE_ANALYSIS_ALLOW_DUMMY === "1" ||
      process.env.FACE_ANALYSIS_ALLOW_DUMMY === "true";
    const inferenceTimeoutRaw = process.env.FACE_ANALYSIS_TIMEOUT_MS?.trim();
    const inferenceTimeoutMs = inferenceTimeoutRaw
      ? Math.max(5_000, parseInt(inferenceTimeoutRaw, 10) || 120_000)
      : 120_000;

    let overallKaiScore: number;
    let v2params: Record<string, unknown>;
    let metrics: {
      acne: number;
      pigmentation: number;
      wrinkles: number;
      hydration: number;
      texture: number;
      overall_score: number;
      clinical_scores: ReturnType<typeof clinicalScoresFromModel>;
    };
    let modelFeatureScores: Record<string, number | null>;
    let detected_regions: ReturnType<typeof generateDetectedRegions>;
    let overlayDataUri: string | undefined;
    let wrinkleMaskDataUri: string | undefined;
    let acneMaskDataUri: string | undefined;
    let spatialOutputs: Awaited<
      ReturnType<typeof runFaceAnalysisServiceV2>
    >["spatialOutputs"];

    const useV2 =
      process.env.FACE_ANALYSIS_USE_V2 === "1" ||
      process.env.FACE_ANALYSIS_USE_V2 === "true";
    const inferenceOpts = {
      baseUrl: inferenceBase!,
      apiKey: inferenceSecret,
      timeoutMs: inferenceTimeoutMs,
    };

    /**
     * Dual-pose default: centre → acne mask + scalars; smiling → wrinkle mask + score.
     * Uses `/analyze_dual_scan` (title-free JPEG overlays when inference is updated).
     * `FACE_ANALYSIS_LEGACY_ANALYZE=1` → old 2× `/analyze` with center-crop overlays.
     * `FACE_ANALYSIS_SINGLE_IMAGE=1` → single centre image only.
     */
    const singleImageMode =
      process.env.FACE_ANALYSIS_SINGLE_IMAGE === "1" ||
      process.env.FACE_ANALYSIS_SINGLE_IMAGE === "true";
    const legacyAnalyze =
      process.env.FACE_ANALYSIS_LEGACY_ANALYZE === "1" ||
      process.env.FACE_ANALYSIS_LEGACY_ANALYZE === "true";

    if (inferenceBase) {
      try {
        let merged;
        if (useV2) {
          merged = buildScanPayloadFromAnalyzeV2(
            await runFaceAnalysisServiceV2(filesForV2, inferenceOpts),
            scanOpts
          );
        } else if (singleImageMode) {
          merged = buildScanPayloadFromAnalyzeV1(
            await runFaceAnalysisService(filesForV2.centre, inferenceOpts),
            scanOpts
          );
        } else if (legacyAnalyze) {
          const dual = await runFaceAnalysisCentreSmiling(
            filesForV2.centre,
            filesForV2.smiling,
            inferenceOpts
          );
          merged = buildScanPayloadFromCentreAndSmiling(
            dual.centre,
            dual.smiling,
            scanOpts
          );
        } else {
          const dualScan = await runFaceAnalysisDualScan(
            filesForV2.centre,
            filesForV2.smiling,
            inferenceOpts
          );
          merged = buildScanPayloadFromAnalyzeV1(dualScan, scanOpts);
          if (process.env.NODE_ENV === "development") {
            console.info("[scan] dual-scan (test_local pipeline)", {
              acneMask: Boolean(dualScan.acneMaskDataUri),
              wrinkleMask: Boolean(dualScan.wrinkleMaskDataUri),
              wrinkles100: dualScan.metrics.wrinkles,
              acne100: dualScan.metrics.acne,
            });
          }
        }
        overallKaiScore = merged.overallKaiScore;
        v2params = merged.params as Record<string, unknown>;
        modelFeatureScores = merged.modelFeatureScores as Record<
          string,
          number | null
        >;
        metrics = {
          ...merged.legacyMetrics,
          clinical_scores: merged.clinical_scores,
        };
        detected_regions = merged.detected_regions;
        overlayDataUri = merged.overlayDataUri;
        wrinkleMaskDataUri = merged.wrinkleMaskDataUri;
        acneMaskDataUri = merged.acneMaskDataUri;
        spatialOutputs = merged.spatialOutputs;
      } catch (err) {
        console.error(
          useV2 ? "Face analysis v2 error:" : "Face analysis error:",
          err
        );
        if (!allowDummyInferenceFallback) {
          const msg =
            err instanceof Error ? err.message : "Face analysis failed";
          return NextResponse.json(
            {
              success: false,
              error:
                "Skin analysis service is unavailable. Try again shortly or contact support.",
              ...(process.env.NODE_ENV === "development" ? { detail: msg } : {}),
            },
            { status: 503 }
          );
        }
        await new Promise((resolve) => setTimeout(resolve, 2500));
        const dummy = buildDummyKaiV2();
        overallKaiScore = dummy.overallKaiScore;
        v2params = dummy.params;
        modelFeatureScores = dummy.modelFeatureScores;
        const dmfs = parseModelFeatureScores(
          dummy.modelFeatureScores as Record<string, number | null>
        );
        metrics = {
          ...buildLegacyMetricsFromModel(dmfs, dummy.overallKaiScore),
          clinical_scores: clinicalScoresFromModel(dmfs),
        };
        detected_regions = dummy.detected_regions;
      }
    } else {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      const dummy = buildDummyKaiV2();
      overallKaiScore = dummy.overallKaiScore;
      v2params = dummy.params;
      modelFeatureScores = dummy.modelFeatureScores;
      const dmfs = parseModelFeatureScores(
        dummy.modelFeatureScores as Record<string, number | null>
      );
      metrics = {
        ...buildLegacyMetricsFromModel(dmfs, dummy.overallKaiScore),
        clinical_scores: clinicalScoresFromModel(dmfs),
      };
      detected_regions = dummy.detected_regions;
    }

    const eczemaScore = Math.min(
      100,
      Math.max(
        0,
        Math.round(
          (metrics.hydration + metrics.acne + metrics.texture) / 3
        )
      )
    );

    let aiSummary = buildDummyAiSummary(metrics);
    const openaiKey = process.env.OPENAI_API_KEY?.trim();
    if (openaiKey) {
      try {
        const openai = new OpenAI({ apiKey: openaiKey });
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: [
                "You are an empathetic, professional dermatological AI assistant.",
                "Write exactly ONE short sentence summarizing skin health and one gentle, non-medical lifestyle tip.",
                "",
                "Patient-facing output must use letter grades A–E only (A is best). Never include raw numbers, percentages, or /100.",
                "You only have this single snapshot — no prior week, no deltas. Never imply something got worse, slipped, or declined over time.",
                "If you mention an area to refine, it must be justified by it being among the **lowest** grades vs the others — frame it as a *relative* gap versus stronger areas (e.g. hydration), not as an acute problem.",
                "If a grade is mid-range or strong (B or A), do not talk about it as if it were a major concern.",
                "",
                "Internal context uses 0–100 scores mapped to grades and optional 1–5 clinical severities (higher = worse on 1–5). Use grades in your sentence; ignore conflicting 1–5 hints if they disagree with the grade story.",
                "No clinical jargon, no diagnosis.",
              ].join("\n"),
            },
            {
              role: "user",
              content: [
                `Letter grades (A is best) — use these in your reply: acne ${patientClarityToGrade(metrics.acne)}, pigmentation ${patientClarityToGrade(metrics.pigmentation)}, wrinkles ${patientClarityToGrade(metrics.wrinkles)}, hydration ${patientClarityToGrade(metrics.hydration)}, texture ${patientClarityToGrade(metrics.texture)}, overall ${patientClarityToGrade(metrics.overall_score)}.`,
                `Optional internal context — 1–5 severity (higher is worse); do not quote numbers to the patient: active acne ${modelFeatureScores.active_acne}, skin quality ${modelFeatureScores.skin_quality}, wrinkle severity ${modelFeatureScores.wrinkle_severity}, sagging/volume ${modelFeatureScores.sagging_volume}, under-eye ${modelFeatureScores.under_eye}, hair ${modelFeatureScores.hair_health}.`,
              ].join("\n"),
            },
          ],
          max_tokens: 80,
        });
        const text = completion.choices[0]?.message?.content?.trim();
        if (text) aiSummary = text;
      } catch (err) {
        console.error("OpenAI summary error:", err);
      }
    }

    const mfsParsed = parseModelFeatureScores(
      modelFeatureScores as Record<string, number | null>
    );
    const modelEight = modelEightClarityScores(mfsParsed, scanOpts.patientAge);

    const analysisResults = {
      acne: metrics.acne,
      wrinkles: metrics.wrinkles,
      texture: metrics.texture,
      pigmentation: metrics.pigmentation,
      hydration: metrics.hydration,
      eczema: eczemaScore,
      kaiOverallScore: overallKaiScore,
      kaiParams: v2params,
      modelFeatureScores: mfsParsed,
      ...(spatialOutputs ? { spatialOutputs } : {}),
      ...modelEight,
    };

    const scanDoctorId = await getAssignedDoctorIdForPatient(user.id);

    const scanRowBase = {
      userId: user.id,
      doctorId: scanDoctorId,
      scanName: scanName.trim() || null,
      imageUrl: imageDataUri,
      overallScore: metrics.overall_score,
      acne: metrics.acne,
      pigmentation: metrics.pigmentation,
      wrinkles: metrics.wrinkles,
      hydration: metrics.hydration,
      texture: metrics.texture,
      aiSummary: aiSummary || null,
      annotations: detected_regions,
      scores: {
        modelFeatureScores: modelFeatureScores as Record<string, number | null>,
        overallKaiScore,
        kaiParams: v2params,
        ...(overlayDataUri ? { overlayDataUri } : {}),
        ...(wrinkleMaskDataUri ? { wrinkleMaskDataUri } : {}),
        ...(acneMaskDataUri ? { acneMaskDataUri } : {}),
        ...(spatialOutputs ? { spatialOutputs } : {}),
      },
    };

    /** Only `id` — avoids RETURNING on `tracker_snapshot` before migration 0030. */
    const scanInsertReturning = { id: scans.id };

    let inserted: { id: number } | undefined;
    try {
      [inserted] = await db
        .insert(scans)
        .values({
          ...scanRowBase,
          faceCaptureImages,
        })
        .returning(scanInsertReturning);
    } catch (insertErr) {
      if (faceCaptureImages && isMissingFaceCaptureColumn(insertErr)) {
        [inserted] = await db
          .insert(scans)
          .values({
            ...scanRowBase,
            faceCaptureImages: null,
          })
          .returning(scanInsertReturning);
      } else {
        throw insertErr;
      }
    }

    if (inserted?.id != null) {
      const paramRows = inferenceParamsToRows(
        v2params as Record<
          string,
          {
            value: number | null;
            source: string;
            severity_flag?: boolean;
            extras?: unknown;
          }
        >
      );
      await insertParameterScoresForScan(db, inserted.id, paramRows);
    }

    if (inserted?.id != null) {
      try {
        const saved = await persistScanTrackerSnapshot(user.id, inserted.id);
        if (!saved) {
          console.warn(
            "[scan] tracker snapshot not saved — report will backfill on first view",
            { scanId: inserted.id, userId: user.id }
          );
        }
      } catch (snapshotErr) {
        console.error("[scan] tracker snapshot persist failed", snapshotErr);
      }
    }

    await db.insert(skinScans).values({
      userId: user.id,
      originalImageUrl: imageDataUri,
      annotatedImageUrl: overlayDataUri ?? imageDataUri,
      skinScore: metrics.overall_score,
      analysisResults,
    });

    await Promise.all([
      invalidateUserHomeCache(user.id),
      invalidateUserScanDerivedCaches(user.id),
      invalidateUserInsightsCache(user.id),
    ]);

    if (inserted?.id != null) {
      void notifyDoctorsPatientScanCompleted({
        patientId: user.id,
        patientName: user.name?.trim() || "Patient",
        scanId: inserted.id,
        scanName: scanName.trim() || null,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        metrics,
        overallKaiScore,
        kaiParams: v2params,
        detected_regions,
        ai_summary: aiSummary,
        id: inserted?.id,
        userName: user.name,
        scanDate: new Date().toISOString(),
        ...(overlayDataUri ? { annotatedImageUrl: overlayDataUri } : {}),
        ...(wrinkleMaskDataUri ? { wrinkleMaskDataUri } : {}),
        ...(acneMaskDataUri ? { acneMaskDataUri } : {}),
        ...(spatialOutputs ? { spatialOutputs } : {}),
      },
    });
  } catch (error) {
    console.error("Scan API error:", error);
    const msg =
      error instanceof Error ? error.message : "Scan failed";
    const dev = process.env.NODE_ENV === "development";
    return NextResponse.json(
      {
        success: false,
        error: dev
          ? msg
          : "Could not save this scan. Try smaller photos or contact support if it continues.",
        ...(dev ? { detail: String(error) } : {}),
      },
      { status: 500 }
    );
  }
}
