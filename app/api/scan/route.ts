import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { eq } from "drizzle-orm";
import { db } from "../../../src/db";
import { scans, skinScans, users } from "../../../src/db/schema";
import { getSessionUserIdFromRequest } from "../../../src/lib/auth/get-session";
import { buildDummyAiSummary } from "../../../src/lib/dummyScanSummary";
import {
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
    pigmentation_model: null as number | null,
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
  const overall = Math.round((acne100 + wr100 + el100 + sq100) / 4);
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
  const texture100 = Math.round(
    (severityToClarity(mfs.sagging_volume) +
      severityToClarity(mfs.under_eye) +
      severityToClarity(mfs.hair_health)) /
      3
  );
  return {
    overallKaiScore: overall,
    params,
    legacyMetrics: {
      acne: acne100,
      wrinkles: wr100,
      pigmentation: 72,
      hydration: sq100,
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
      pigmentation_model: mfs.pigmentation_model,
    },
    detected_regions: generateDetectedRegions(),
  };
}

export async function POST(request: NextRequest) {
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

    const keys = ["centre", "left", "right", "eyes_closed", "smiling"] as const;

    for (let i = 0; i < multiRaw.length; i++) {
      const file = multiRaw[i];
      const label = FACE_SCAN_CAPTURE_STEPS[i].id;
      const rawBuf = Buffer.from(await file.arrayBuffer());
      const buf = await bufferToOrientedJpegBuffer(rawBuf);
      let previewDataUri: string | undefined;
      try {
        previewDataUri = await buildPreviewJpegDataUri(buf);
      } catch {
        previewDataUri = undefined;
      }
      entries.push({
        label,
        dataUri: bufferToDataUri(buf, "image/jpeg"),
        ...(previewDataUri ? { previewDataUri } : {}),
      });
      const k = keys[i];
      filesForV2[k] = new File([new Uint8Array(buf)], file.name || `${k}.jpg`, {
        type: "image/jpeg",
      });
    }

    const faceCaptureImages = entries;
    const imageDataUri = entries[0].dataUri;

    const inferenceBase = process.env.FACE_ANALYSIS_SERVICE_URL?.trim();
    const inferenceSecret = process.env.FACE_ANALYSIS_SERVICE_SECRET?.trim();
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
     * Dual-pose default: centre photo drives the 7 non-wrinkle parameters and the
     * acne mask; smiling photo drives the wrinkle severity and wrinkle mask.
     * `FACE_ANALYSIS_SINGLE_IMAGE=1` falls back to notebook-style single-image.
     */
    const singleImageMode =
      process.env.FACE_ANALYSIS_SINGLE_IMAGE === "1" ||
      process.env.FACE_ANALYSIS_SINGLE_IMAGE === "true";

    if (inferenceBase) {
      try {
        let merged;
        if (useV2) {
          merged = buildScanPayloadFromAnalyzeV2(
            await runFaceAnalysisServiceV2(filesForV2, inferenceOpts)
          );
        } else if (singleImageMode) {
          merged = buildScanPayloadFromAnalyzeV1(
            await runFaceAnalysisService(filesForV2.centre, inferenceOpts)
          );
        } else {
          // Default production path (matches dual_pose_scan.ipynb): 2× POST /analyze.
          const dual = await runFaceAnalysisCentreSmiling(
            filesForV2.centre,
            filesForV2.smiling,
            inferenceOpts
          );
          merged = buildScanPayloadFromCentreAndSmiling(
            dual.centre,
            dual.smiling
          );
          if (process.env.NODE_ENV === "development") {
            console.info("[scan] dual-pose inference", {
              centreAcneMask: Boolean(dual.centre.acneMaskDataUri),
              smilingWrinkleMask: Boolean(dual.smiling.wrinkleMaskDataUri),
              mergedWrinkleSeverity: merged.modelFeatureScores.wrinkle_severity,
              mergedAcneSeverity: merged.modelFeatureScores.active_acne,
            });
            if (!merged.acneMaskDataUri) {
              console.warn(
                "[scan] missing acneMaskDataUri from centre /analyze — check HF overlay build"
              );
            }
            if (!merged.wrinkleMaskDataUri) {
              console.warn(
                "[scan] missing wrinkleMaskDataUri from smiling /analyze — check HF overlay build"
              );
            }
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
                "PRIMARY numbers are the six patient scores below (0–100). For every one of them, HIGHER is BETTER (100 = best).",
                "You only have this single snapshot — no prior week, no deltas. Never imply something got worse, slipped, or declined over time.",
                "If you mention an area to refine, it must be justified by it being among the **lowest** of those six scores vs the others — frame it as a *relative* gap versus their own stronger metrics (e.g. hydration), not as an acute problem.",
                "If a score is mid-range or strong (e.g. mid-50s+), do not talk about it as if it were a major concern.",
                "",
                "Secondary block: clinical 1–5 features use the OPPOSITE rule (higher = more severe). Use them only for subtle wording if they align with the 0–100 story. If they seem to conflict with the 0–100 scores, ignore the 1–5 block for your sentence.",
                "No clinical jargon, no diagnosis.",
              ].join("\n"),
            },
            {
              role: "user",
              content: [
                `0–100 scores (higher is better) — use these for the main message: acne ${metrics.acne}, pigmentation ${metrics.pigmentation}, wrinkles ${metrics.wrinkles}, hydration ${metrics.hydration}, texture ${metrics.texture}, overall ${metrics.overall_score}.`,
                `Optional context — 1–5 severity style (higher is worse); must not contradict the 0–100 line: active acne ${modelFeatureScores.active_acne}, skin quality ${modelFeatureScores.skin_quality}, wrinkle severity ${modelFeatureScores.wrinkle_severity}, sagging/volume ${modelFeatureScores.sagging_volume}, under-eye ${modelFeatureScores.under_eye}, hair ${modelFeatureScores.hair_health}.`,
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

    const userId = await getSessionUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Sign in to save a skin scan." },
        { status: 401 }
      );
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { id: true, name: true },
    });
    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 400 }
      );
    }

    const mfsParsed = parseModelFeatureScores(
      modelFeatureScores as Record<string, number | null>
    );
    const modelEight = modelEightClarityScores(mfsParsed);

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

    const scanRowBase = {
      userId: user.id,
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
        await persistScanTrackerSnapshot(user.id, inserted.id);
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
