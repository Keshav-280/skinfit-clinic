import OpenAI from "openai";
import { eq } from "drizzle-orm";
import { scanJobs, scans, skinScans, users, mobileCaptureSessions } from "@/src/db/schema";
import type { NodePgAppDatabase } from "@/src/db/database-types";

export type ScanJobDatabase = NodePgAppDatabase;
import { buildDummyAiSummary } from "@/src/lib/dummyScanSummary";
import { patientClarityToGrade } from "@/src/lib/clarityGrade";
import { getFaceAnalysisServiceSecret } from "@/src/lib/faceAnalysisEnv";
import {
  runFaceAnalysisDualScan,
  runFaceAnalysisCentreSmiling,
  runFaceAnalysisService,
} from "@/src/lib/faceAnalysisInference";
import { runFaceAnalysisServiceV2 } from "@/src/lib/faceAnalysisInferenceV2";
import {
  runAcneDetector,
  applyAcneDetectorToScanPayload,
} from "@/src/lib/acneDetectorInference";
import {
  inferenceParamsToRows,
  insertParameterScoresForScan,
} from "@/src/lib/insertParameterScores";
import {
  buildScanPayloadFromAnalyzeV1,
  buildScanPayloadFromAnalyzeV2,
  buildScanPayloadFromCentreAndSmiling,
  modelEightClarityScores,
  parseModelFeatureScores,
} from "@/src/lib/modelClinicalMetrics";
import { getStorage } from "@/src/lib/infra";
import { logger } from "@/src/lib/infra";
import { publishNotification } from "@/src/lib/infra";
import {
  invalidateUserHomeCache,
  invalidateUserInsightsCache,
  invalidateUserScanDerivedCaches,
} from "@/src/lib/infra";
import {
  maskExportVersionFromDataUri,
  MASK_EXPORT_VERSION_TITLE_FREE,
} from "@/src/lib/maskImageCrop";
import { persistDataUriToStorage } from "@/src/lib/resolveScanImageUrl";
import { persistScanTrackerSnapshot } from "@/src/lib/scanTrackerSnapshot";
import { getAssignedDoctorIdForPatient } from "@/src/lib/doctorPatientCare";
import { notifyDoctorsPatientScanCompleted } from "@/src/lib/scanDoctorAlerts";
import type { ScanJobPayload } from "@/src/lib/infra";
import { cropJpegBufferForMlStep } from "@/src/lib/cropScanImageForMl";
import { formatFaceIdentityCheckSummary } from "@/src/lib/faceIdentityCheckDisplay";
import {
  buildFaceIdentityInputsFromPaths,
  enforceScanFaceIdentity,
} from "@/src/lib/scanFaceIdentityGate";

async function pathToMlFile(
  relativePath: string,
  stepId: "centre" | "left" | "right" | "eyes_closed" | "smiling",
  captureCropContext: ScanJobPayload["captureCropContext"]
): Promise<File> {
  const storage = getStorage();
  const buf = await storage.read(relativePath);
  const cropped = await cropJpegBufferForMlStep(buf, stepId, captureCropContext);
  return new File([new Uint8Array(cropped)], `${stepId}.jpg`, {
    type: "image/jpeg",
  });
}

export async function processScanJob(
  jobId: string,
  payload: ScanJobPayload,
  database: ScanJobDatabase
): Promise<{ scanId: number }> {
  const started = Date.now();
  await database
    .update(scanJobs)
    .set({
      status: "processing",
      errorText: null,
      updatedAt: new Date(),
    })
    .where(eq(scanJobs.id, jobId));

  const inferenceBase = process.env.FACE_ANALYSIS_SERVICE_URL?.trim();
  const inferenceSecret = getFaceAnalysisServiceSecret();
  const inferenceTimeoutMs = Math.max(
    5_000,
    parseInt(process.env.FACE_ANALYSIS_TIMEOUT_MS?.trim() || "120000", 10) || 120_000
  );

  const keys = ["centre", "left", "right", "eyes_closed", "smiling"] as const;
  const filesForV2 = {} as Record<(typeof keys)[number], File>;
  for (const k of keys) {
    const rel = payload.imagePaths[k];
    if (!rel) throw new Error(`Missing image path for ${k}`);
    filesForV2[k] = await pathToMlFile(rel, k, payload.captureCropContext);
  }

  const identity = await enforceScanFaceIdentity({
    userId: payload.userId,
    scanName: payload.scanName,
    images: buildFaceIdentityInputsFromPaths(payload.imagePaths),
    skipWhenVerifiedAt: payload.identityVerifiedAt,
  });
  if (!identity.ok) {
    const checkSummary =
      identity.imageChecks?.length ?
        `\n${formatFaceIdentityCheckSummary(identity.imageChecks)}`
      : "";
    const errText = `${identity.code}: ${identity.message}${checkSummary}`;
    await database
      .update(scanJobs)
      .set({
        status: "failed",
        errorText: errText,
        updatedAt: new Date(),
      })
      .where(eq(scanJobs.id, jobId));
    throw new Error(errText);
  }

  const useV2 =
    process.env.FACE_ANALYSIS_USE_V2 === "1" ||
    process.env.FACE_ANALYSIS_USE_V2 === "true";
  const singleImageMode =
    process.env.FACE_ANALYSIS_SINGLE_IMAGE === "1" ||
    process.env.FACE_ANALYSIS_SINGLE_IMAGE === "true";
  const legacyAnalyze =
    process.env.FACE_ANALYSIS_LEGACY_ANALYZE === "1" ||
    process.env.FACE_ANALYSIS_LEGACY_ANALYZE === "true";

  if (!inferenceBase) {
    throw new Error("FACE_ANALYSIS_SERVICE_URL is required for async scan processing");
  }

  const inferenceOpts = {
    baseUrl: inferenceBase,
    apiKey: inferenceSecret,
    timeoutMs: inferenceTimeoutMs,
  };

  const [patientRow] = await database
    .select({ age: users.age })
    .from(users)
    .where(eq(users.id, payload.userId))
    .limit(1);
  const scanOpts = { patientAge: patientRow?.age ?? null };

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
  }

  // Replace ONLY the acne score + acne annotated image with the dedicated
  // YOLO acne detector (services/acne-detector-v1). Everything else stays from
  // the DINOv2 model. Soft-fail: if the detector is down, keep DINO acne.
  const acneDetectorBase = process.env.ACNE_DETECTOR_SERVICE_URL?.trim();
  const acneDetectorDisabled =
    process.env.ACNE_DETECTOR_DISABLED === "1" ||
    process.env.ACNE_DETECTOR_DISABLED === "true";
  if (acneDetectorBase && !acneDetectorDisabled) {
    try {
      const acneResult = await runAcneDetector(filesForV2.centre, {
        baseUrl: acneDetectorBase,
        apiKey: inferenceSecret,
        timeoutMs: inferenceTimeoutMs,
      });
      merged = applyAcneDetectorToScanPayload(merged, acneResult);
      logger.info("acne_detector_applied", {
        jobId,
        userId: payload.userId,
        grade: acneResult.grade.final_grade,
        score: acneResult.grade.score,
        lesions: acneResult.grade.f1?.active_lesion_count ?? null,
      });
    } catch (err) {
      logger.warn("acne_detector_skipped", {
        jobId,
        error: err instanceof Error ? err.message : String(err),
        hint: "scan continues with DINO acne score/mask",
      });
    }
  }

  const storage = getStorage();
  const upload = storage.upload.bind(storage);

  logger.inference(Date.now() - started, { jobId, userId: payload.userId });

  const overlayUrl = await persistDataUriToStorage(
    merged.overlayDataUri,
    "masks",
    upload
  );
  const wrinkleMaskUrl = await persistDataUriToStorage(
    merged.wrinkleMaskDataUri,
    "masks",
    upload
  );
  const acneMaskUrl = await persistDataUriToStorage(
    merged.acneMaskDataUri,
    "masks",
    upload
  );

  const wrMaskVersion = maskExportVersionFromDataUri(merged.wrinkleMaskDataUri);
  const acMaskVersion = maskExportVersionFromDataUri(merged.acneMaskDataUri);
  const maskExportVersion =
    wrMaskVersion === MASK_EXPORT_VERSION_TITLE_FREE &&
    acMaskVersion === MASK_EXPORT_VERSION_TITLE_FREE
      ? MASK_EXPORT_VERSION_TITLE_FREE
      : wrMaskVersion ?? acMaskVersion ?? 1;

  const metrics = {
    ...merged.legacyMetrics,
    clinical_scores: merged.clinical_scores,
  };
  const modelFeatureScores = merged.modelFeatureScores as Record<
    string,
    number | null
  >;

  let aiSummary = buildDummyAiSummary(metrics);
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  if (openaiKey) {
    try {
      const openai = new OpenAI({ apiKey: openaiKey });
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              "Write one short patient-facing sentence about this skin scan using ONLY the letter grades given below (A–E, A is best).",
              "STRICT RULES: never include raw numbers, percentages, or '/100'; never invent grades not listed; never mention UV, sun exposure, or sunscreen habits (this app does not collect sun-exposure data).",
              "Warm, plain language. No em dashes.",
              `Grades: overall ${patientClarityToGrade(metrics.overall_score)}, acne ${patientClarityToGrade(metrics.acne)}, wrinkles ${patientClarityToGrade(metrics.wrinkles)}, under-eye ${patientClarityToGrade(metrics.hydration)}.`,
            ].join(" "),
          },
        ],
        max_tokens: 80,
      });
      const text = completion.choices[0]?.message?.content?.trim();
      if (text) aiSummary = text;
    } catch (err) {
      const code =
        err &&
        typeof err === "object" &&
        "code" in err &&
        typeof (err as { code?: string }).code === "string"
          ? (err as { code: string }).code
          : null;
      logger.warn("openai_summary_skipped", {
        jobId,
        code: code ?? "unknown",
        hint:
          code === "insufficient_quota"
            ? "OpenAI billing/quota — scan continues with default summary"
            : undefined,
        error: String(err),
      });
    }
  }

  const [user] = await database
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.id, payload.userId))
    .limit(1);
  if (!user) throw new Error("User not found");

  const mfsParsed = parseModelFeatureScores(modelFeatureScores);
  const modelEight = modelEightClarityScores(mfsParsed, scanOpts.patientAge);
  const analysisResults = {
    acne: metrics.acne,
    wrinkles: metrics.wrinkles,
    texture: metrics.texture,
    pigmentation: metrics.pigmentation,
    hydration: metrics.hydration,
    kaiOverallScore: merged.overallKaiScore,
    kaiParams: merged.params,
    modelFeatureScores: mfsParsed,
    ...modelEight,
  };

  const scanDoctorId = await getAssignedDoctorIdForPatient(user.id);

  const [inserted] = await database
    .insert(scans)
    .values({
      userId: user.id,
      doctorId: scanDoctorId,
      scanName: payload.scanName.trim() || null,
      imageUrl: payload.primaryImageUrl,
      faceCaptureImages: payload.faceCaptureImages,
      overallScore: metrics.overall_score,
      acne: metrics.acne,
      pigmentation: metrics.pigmentation,
      wrinkles: metrics.wrinkles,
      hydration: metrics.hydration,
      texture: metrics.texture,
      aiSummary: aiSummary || null,
      annotations: merged.detected_regions,
      scores: {
        modelFeatureScores,
        overallKaiScore: merged.overallKaiScore,
        kaiParams: merged.params,
        ...(overlayUrl ? { overlayUrl } : {}),
        ...(wrinkleMaskUrl ? { wrinkleMaskUrl } : {}),
        ...(acneMaskUrl ? { acneMaskUrl } : {}),
        maskExportVersion,
        ...(merged.spatialOutputs ? { spatialOutputs: merged.spatialOutputs } : {}),
      },
    })
    .returning({ id: scans.id });

  if (inserted?.id != null) {
    await insertParameterScoresForScan(
      database,
      inserted.id,
      inferenceParamsToRows(
        merged.params as Record<
          string,
          {
            value: number | null;
            source: string;
            severity_flag?: boolean;
          }
        >
      )
    );
    const snapshotOk = await persistScanTrackerSnapshot(
      user.id,
      inserted.id,
      database
    );
    if (!snapshotOk) {
      throw new Error(
        "Tracker report (kAI RAG snapshot) could not be built — scan not marked ready"
      );
    }
  }

  await database.insert(skinScans).values({
    userId: user.id,
    originalImageUrl: payload.primaryImageUrl,
    annotatedImageUrl: overlayUrl ?? payload.primaryImageUrl,
    skinScore: metrics.overall_score,
    analysisResults,
  });

  await database
    .update(scanJobs)
    .set({
      status: "completed",
      resultScanId: inserted?.id ?? null,
      updatedAt: new Date(),
    })
    .where(eq(scanJobs.id, jobId));

  await publishNotification("scan.completed", payload.userId, {
    scanId: inserted?.id,
    jobId,
    scanName: payload.scanName ?? null,
  });

  if (inserted?.id != null) {
    await notifyDoctorsPatientScanCompleted({
      patientId: user.id,
      patientName: user.name?.trim() || "Patient",
      scanId: inserted.id,
      scanName: payload.scanName ?? null,
    });

    if (payload.mobileSessionId) {
      await database
        .update(mobileCaptureSessions)
        .set({
          status: "complete",
          scanId: inserted.id,
        })
        .where(eq(mobileCaptureSessions.id, payload.mobileSessionId));
    }
  }

  await Promise.all([
    invalidateUserHomeCache(payload.userId),
    invalidateUserScanDerivedCaches(payload.userId),
    invalidateUserInsightsCache(payload.userId),
  ]);

  return { scanId: inserted!.id };
}
