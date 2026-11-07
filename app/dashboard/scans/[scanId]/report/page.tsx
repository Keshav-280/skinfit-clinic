import { notFound, redirect } from "next/navigation";
import { and, asc, desc, eq, lt } from "drizzle-orm";
import { format, startOfDay } from "date-fns";
import { db } from "../../../../../src/db";
import { scans, scheduleEvents, users } from "../../../../../src/db/schema";
import { getSessionUserId } from "../../../../../src/lib/auth/get-session";
import { isPatientClinicVisited } from "../../../../../src/lib/patientClinicVisit";
import { buildFaceCaptureGallery } from "../../../../../src/lib/faceCaptureGallery";
import { patientScanImagePath } from "../../../../../src/lib/patientScanImagePath";
import type { FaceCaptureRef } from "../../../../../src/lib/resolveScanImageUrl";
import {
  parseScanDetectionRegions,
  parseScanDetectionRegionsByPose,
  parseScanProxyRegions,
  parseScanWrinkleLines,
  ensureScarsAndUnderEyeProxyRegions,
} from "../../../../../src/lib/scanDetectionRegions";
import {
  parseMaskExportVersion,
  parseScanSpotAnnotatedUrl,
  parseScanSpotAnnotatedByPose,
  parseScanWrinkleMaskDataUri,
} from "../../../../../src/lib/parseClinicalScores";
import { scanDisplayResolvedFromRow } from "../../../../../src/lib/resolveScanDisplayScores";
import {
  buildKaiReportParamRowsFromRag,
  clarityToSeverity,
  initialReportHeadline,
  pickTopConcernName,
} from "../../../../../src/lib/kaiReportMapping";
import {
  movementToHeroBadge,
  scoreToGrade,
  subtitleFromGrades,
} from "../../../../../src/lib/report/gradeComputation";
import {
  buildMovementGroups,
  focusParamMovement,
  overallMovementFromHistory,
} from "../../../../../src/lib/report/buildMovementGroups";
import { loadReportScoreHistory } from "../../../../../src/lib/report/reportScoreHistory";
import { loadWellnessAndWeatherForScan } from "../../../../../src/lib/wellnessWeatherContext";
import {
  type GeneratedInitialReport,
  type GeneratedUpdateReport,
} from "../../../../../src/lib/report/generateReportContent";
import { scheduleReportGeneration } from "../../../../../src/lib/report/reportGenerationQueue";
import { readKaiReportSnapshot } from "../../../../../src/lib/report/kaiReportSnapshot";
import {
  buildAttributionCards,
  defaultNextStep,
  defaultUpdateHeadline,
  formatScanDateShort,
  formatShareLine,
  templateWeekHighlight,
  weekRecapFromWellness,
} from "../../../../../src/lib/report/updateReportTemplates";
import { coalesceFocusActions } from "../../../../../src/lib/report/reportFocusActions";
import { computeMultiWeekInsights } from "../../../../../src/lib/multiWeekPatternAnalysis";
import { InitialKaiScanReport } from "../../../../../components/report/InitialKaiScanReport";
import { UpdateKaiScanReport } from "../../../../../components/report/UpdateKaiScanReport";

function hasMissingColumn(error: unknown, column: string): boolean {
  const err = error as { code?: string; message?: string };
  if (err?.code === "42703") return true;
  return (
    typeof err?.message === "string" &&
    err.message.toLowerCase().includes(column.toLowerCase())
  );
}

const SCAN_COLUMNS = {
  id: true,
  overallScore: true,
  acne: true,
  wrinkles: true,
  hydration: true,
  aiSummary: true,
  createdAt: true,
  faceCaptureImages: true,
  imageUrl: true,
  scores: true,
  pigmentation: true,
  texture: true,
} as const;

async function loadScanRow(userId: string, id: number) {
  try {
    return await db.query.scans.findFirst({
      where: and(eq(scans.id, id), eq(scans.userId, userId)),
      columns: SCAN_COLUMNS,
    });
  } catch (e) {
    const missingFaceCapture = hasMissingColumn(e, "face_capture_images");
    if (!missingFaceCapture) throw e;
    return await db.query.scans.findFirst({
      where: and(eq(scans.id, id), eq(scans.userId, userId)),
      columns: {
        id: true,
        overallScore: true,
        acne: true,
        wrinkles: true,
        hydration: true,
        aiSummary: true,
        createdAt: true,
        imageUrl: true,
        scores: true,
        pigmentation: true,
        texture: true,
      },
    });
  }
}

function resolvedFromRow(row: {
  overallScore: number;
  acne: number;
  wrinkles: number;
  pigmentation: number;
  hydration: number;
  texture: number;
  scores: unknown;
}) {
  return scanDisplayResolvedFromRow({
    overallScore: row.overallScore,
    acne: row.acne,
    wrinkles: row.wrinkles,
    pigmentation: row.pigmentation,
    hydration: row.hydration,
    texture: row.texture,
    scores: row.scores,
  });
}

function annotatedPhotosForScan(scores: unknown): Record<string, string> | undefined {
  const byPose = parseScanSpotAnnotatedByPose(scores);
  if (byPose) return byPose;
  const centre = parseScanSpotAnnotatedUrl(scores);
  return centre ? { centre } : undefined;
}

function galleryImages(
  scanId: number,
  faceCaptureImages: FaceCaptureRef[] | null | undefined,
  annotatedByPose?: Record<string, string> | null
) {
  const gallery = buildFaceCaptureGallery(scanId, faceCaptureImages);
  if (gallery && gallery.length > 0) {
    return gallery.map((g) => ({
      url:
        (g.poseId && annotatedByPose?.[g.poseId]) ||
        g.imageUrl,
      label: g.label,
      poseId: g.poseId,
    }));
  }
  const centreAnnotated = annotatedByPose?.centre;
  return [
    {
      url: centreAnnotated || patientScanImagePath(scanId),
      label: "Front profile",
      poseId: "centre",
    },
  ];
}

function faceMapProxyRegions(
  scores: unknown,
  clinical: {
    acne_scars?: number | null;
    under_eye?: number | null;
  } | null | undefined,
  legacy?: {
    hydration?: number;
    texture?: number;
  }
) {
  const scarsSeverity =
    typeof clinical?.acne_scars === "number" && Number.isFinite(clinical.acne_scars)
      ? clinical.acne_scars
      : typeof legacy?.texture === "number" && legacy.texture > 0
        ? clarityToSeverity(legacy.texture)
        : null;
  const underSeverity =
    typeof clinical?.under_eye === "number" && Number.isFinite(clinical.under_eye)
      ? clinical.under_eye
      : typeof legacy?.hydration === "number" && legacy.hydration > 0
        ? clarityToSeverity(legacy.hydration)
        : null;

  return ensureScarsAndUnderEyeProxyRegions(parseScanProxyRegions(scores), {
    acne_scars: scarsSeverity,
    under_eye: underSeverity,
  });
}

function centreImageUrl(
  scanId: number,
  images: Array<{ url: string; poseId?: string; label?: string }>
): string {
  const centre =
    images.find((i) => i.poseId === "centre") ??
    images.find((i) => /front|centr/i.test(i.label ?? "")) ??
    images[0];
  return centre?.url ?? patientScanImagePath(scanId);
}

/** Week number = chronological index (1-based). Streak = consecutive ≤10-day gaps. */
function weekMeta(
  orderedIds: Array<{ id: number; createdAt: Date }>,
  currentId: number
): { weekNumber: number; streak: number } {
  const idx = orderedIds.findIndex((s) => s.id === currentId);
  const weekNumber = idx >= 0 ? idx + 1 : orderedIds.length;
  let streak = 1;
  for (let i = (idx >= 0 ? idx : orderedIds.length - 1); i > 0; i--) {
    const cur = orderedIds[i]!;
    const prev = orderedIds[i - 1]!;
    const gapDays =
      (cur.createdAt.getTime() - prev.createdAt.getTime()) /
      (24 * 60 * 60 * 1000);
    if (gapDays <= 10) streak += 1;
    else break;
  }
  return { weekNumber, streak };
}

export default async function KaiScanReportPage({
  params,
}: {
  params: Promise<{ scanId: string }>;
}) {
  const { scanId: scanIdParam } = await params;
  const scanId = Number.parseInt(scanIdParam, 10);
  if (!Number.isFinite(scanId) || scanId < 1) notFound();

  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const [user, row, scoresUnlocked] = await Promise.all([
    db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        id: true,
        name: true,
        age: true,
        gender: true,
        skinType: true,
        primaryConcern: true,
        fitzpatrick: true,
      },
    }),
    loadScanRow(userId, scanId),
    isPatientClinicVisited(userId),
  ]);

  if (!user) notFound();
  if (!row) notFound();

  // Compare against the most recent scan from a PRIOR calendar day. Two scans
  // taken the same day carry no meaningful weekly movement, so same-day scans
  // are excluded - with only same-day data the Initial report is shown instead.
  const [previousMeta, wellnessWeather] = await Promise.all([
    db.query.scans.findFirst({
      where: and(
        eq(scans.userId, userId),
        lt(scans.createdAt, startOfDay(row.createdAt))
      ),
      orderBy: [desc(scans.createdAt), desc(scans.id)],
      columns: { id: true },
    }),
    loadWellnessAndWeatherForScan({
      userId,
      scanDate: row.createdAt,
    }),
  ]);
  const previous = previousMeta
    ? await loadScanRow(userId, previousMeta.id)
    : null;
  const { wellness, cityWeather } = wellnessWeather;

  const doctorName = "Dr. Ruby";
  const faceCaptureImages =
    ("faceCaptureImages" in row ? row.faceCaptureImages : null) as
      | FaceCaptureRef[]
      | null;

  // ── Initial Report ──────────────────────────────────────────────
  if (!previous) {
    const resolved = resolvedFromRow(row);
    const metrics = resolved.metrics;
    const paramRows = buildKaiReportParamRowsFromRag(resolved.resolvedRagParamValues);
    const gradeInfo = scoreToGrade(metrics.overall_score);
    const topConcern = pickTopConcernName(paramRows);
    const annotatedByPose = annotatedPhotosForScan(row.scores);
    const scanImages = galleryImages(row.id, faceCaptureImages, annotatedByPose);

    const cachedInitial = readKaiReportSnapshot(row.scores, { allowStale: true });
    let llm: GeneratedInitialReport | null =
      cachedInitial?.kind === "initial"
        ? (cachedInitial.report as GeneratedInitialReport)
        : null;
    let aiUnavailable = cachedInitial?.kind === "initial" ? cachedInitial.aiUnavailable : false;

    // Never wait for the AI on page load: show what is saved, build the fresh report in the background.
    if (!llm || cachedInitial?.stale) scheduleReportGeneration(userId, row.id);

    const parameters = paramRows;

    const headline =
      llm?.overall?.headline?.trim() ||
      llm?.headline?.trim() ||
      initialReportHeadline(parameters);
    const synthesis =
      llm?.summary?.trim() ||
      row.aiSummary?.trim() ||
      `This baseline centres on ${topConcern.toLowerCase()}. On Indian skin, that pattern is often driven by a mix of UV, barrier stress and routine inconsistency - your next scans will show whether the plan is holding.`;
    const actions = coalesceFocusActions({
      llmActions: llm?.actions,
      rows: paramRows,
      wellness,
    });

    const markerCount = Math.max(parameters.length, 1);
    const grade = String(gradeInfo.score100);
    const position = gradeInfo.position;

    return (
      <InitialKaiScanReport
        aiPending={!llm}
        scanId={row.id}
        grade={grade}
        headline={headline}
        scanDateLabel={format(row.createdAt, "dd MMM yyyy")}
        position={position}
        subtitle={`${markerCount} marker${markerCount === 1 ? "" : "s"} mapped`}
        synthesis={synthesis}
        baselineBody={`${markerCount} marker${markerCount === 1 ? "" : "s"} ${markerCount === 1 ? "is" : "are"} now fixed against this capture. Next week’s scan measures the same points. Stability in week one is a good result - it means the baseline held.`}
        actions={actions}
        parameters={parameters}
        scanImages={scanImages}
        detectionRegions={parseScanDetectionRegions(row.scores)}
        detectionRegionsByPose={parseScanDetectionRegionsByPose(row.scores)}
        wrinkleLines={parseScanWrinkleLines(row.scores)}
        wrinkleMaskUrl={parseScanWrinkleMaskDataUri(row.scores) ?? null}
        bakedSpotAnnotations={Boolean(annotatedByPose)}
        maskExportVersion={parseMaskExportVersion(row.scores) ?? null}
        proxyRegions={faceMapProxyRegions(
          row.scores,
          metrics.clinical_scores,
          {
            hydration: metrics.hydration,
            texture: metrics.texture,
          }
        )}
        isExistingPatient={scoresUnlocked}
        doctorName={doctorName}
      />
    );
  }

  // ── Update Report ───────────────────────────────────────────────
  const [allScans, recentEvent, multiWeekInsights, scoreHistory] = await Promise.all([
    db.query.scans.findMany({
      where: eq(scans.userId, userId),
      orderBy: [asc(scans.createdAt), asc(scans.id)],
      columns: { id: true, createdAt: true },
    }),
    db.query.scheduleEvents.findFirst({
      where: and(eq(scheduleEvents.userId, userId)),
      orderBy: [desc(scheduleEvents.eventDate)],
      columns: { title: true, eventDate: true, eventKind: true },
    }),
    computeMultiWeekInsights(userId),
    loadReportScoreHistory(userId, { id: row.id, createdAt: row.createdAt }),
  ]);
  const firstScanAt = allScans[0]?.createdAt ?? row.createdAt;
  const { weekNumber, streak } = weekMeta(allScans, row.id);

  const resolved = resolvedFromRow(row);
  const prevResolved = resolvedFromRow(previous);
  const metrics = resolved.metrics;
  const prevMetrics = prevResolved.metrics;
  const paramRows = buildKaiReportParamRowsFromRag(resolved.resolvedRagParamValues);
  const prevParamRows = buildKaiReportParamRowsFromRag(
    prevResolved.resolvedRagParamValues
  );

  const gradeInfo = scoreToGrade(metrics.overall_score);
  const prevGradeInfo = scoreToGrade(prevMetrics.overall_score);
  // Overall movement: this scan against the LAST scan only.
  const overallMv = overallMovementFromHistory(scoreHistory.overall, true);

  const treatmentish =
    recentEvent &&
    (recentEvent.eventKind === "pre_treatment" ||
      recentEvent.eventKind === "post_treatment" ||
      /peel|laser|botox|filler|microneed|treatment/i.test(recentEvent.title))
      ? recentEvent
      : null;

  const cachedUpdate = readKaiReportSnapshot(row.scores, { allowStale: true });
  let llm: GeneratedUpdateReport | null =
    cachedUpdate?.kind === "update"
      ? (cachedUpdate.report as GeneratedUpdateReport)
      : null;
  let aiUnavailable = cachedUpdate?.kind === "update" ? cachedUpdate.aiUnavailable : false;

  // Never wait for the AI on page load: show what is saved, build the fresh report in the background.
  if (!llm || cachedUpdate?.stale) scheduleReportGeneration(userId, row.id);

  const movementGroups = buildMovementGroups({
    current: paramRows,
    previous: prevParamRows,
    firstScanAt,
    currentScanAt: row.createdAt,
    previousScanAt: previous.createdAt,
    history: scoreHistory.byReportKey,
    compareToLast: true,
  });

  const score100 = String(gradeInfo.score100);
  const position = {
    current: gradeInfo.position,
    previous: prevGradeInfo.position,
  };
  const prevScore100 = String(prevGradeInfo.score100);
  const mvKind = overallMv;

  const topConcern = pickTopConcernName(paramRows);
  const headline =
    llm?.overall?.headline?.trim() ||
    defaultUpdateHeadline(score100, paramRows, mvKind);
  const badge = movementToHeroBadge(mvKind);
  const daysSincePrevious = (row.createdAt.getTime() - previous.createdAt.getTime()) / 86_400_000;
  const subtitle = subtitleFromGrades(score100, prevScore100, mvKind, daysSincePrevious);

  const attributionCards = buildAttributionCards({
    cityWeather,
    wellness,
    recentTreatmentTitle: treatmentish?.title ?? null,
    recentTreatmentDate: treatmentish
      ? format(treatmentish.eventDate, "d MMM")
      : null,
    llm,
    multiWeekInsights,
  });

  const weekRecap =
    llm?.week_recap &&
    (llm.week_recap.sleep || llm.week_recap.stress || llm.week_recap.water)
      ? [
          { label: "Sleep", value: llm.week_recap.sleep || "-" },
          { label: "Stress", value: llm.week_recap.stress || "-" },
          {
            label: "Water",
            value: llm.week_recap.water || "-",
          },
          {
            label: "Routine",
            value: llm.week_recap.routine_adherence || "-",
          },
        ]
      : weekRecapFromWellness(wellness);

  const weekHighlight =
    llm?.week_recap?.highlight?.trim() || templateWeekHighlight(wellness);

  const actions = coalesceFocusActions({
    llmActions: llm?.actions,
    rows: paramRows,
    previousRows: prevParamRows,
    wellness,
    multiWeekInsights,
  });

  const nextStep = llm?.next_step?.reason
    ? {
        heading:
          llm.next_step.label?.trim() ||
          defaultNextStep({ doctorName, topConcern, escalate: llm.escalate })
            .heading,
        body: llm.next_step.reason.trim(),
      }
    : defaultNextStep({
        doctorName,
        topConcern,
        escalate: Boolean(llm?.escalate),
      });

  const annotatedByPose = annotatedPhotosForScan(row.scores);
  const currentImages = galleryImages(row.id, faceCaptureImages, annotatedByPose);
  const prevFace =
    ("faceCaptureImages" in previous ? previous.faceCaptureImages : null) as
      | FaceCaptureRef[]
      | null;
  const prevRawImages = galleryImages(previous.id, prevFace);
  const currentRawImages = galleryImages(row.id, faceCaptureImages);

  // The slider can also show the FIRST scan. Only offered when it is a different scan from both the
  // latest and the previous one.
  const firstId = allScans[0]?.id ?? null;
  const firstRow =
    firstId != null && firstId !== row.id && firstId !== previous.id
      ? await loadScanRow(userId, firstId)
      : null;
  const firstRawImages = firstRow
    ? galleryImages(
        firstRow.id,
        ("faceCaptureImages" in firstRow ? firstRow.faceCaptureImages : null) as FaceCaptureRef[] | null
      )
    : null;

  const shareLine =
    llm?.share_card?.line?.trim() ||
    formatShareLine(weekNumber, score100, mvKind, topConcern);

  return (
    <UpdateKaiScanReport
      scanId={row.id}
      grade={score100}
      headline={headline}
      metaLeft={`Week ${weekNumber} · ${streak}-week streak`}
      metaRight={format(row.createdAt, "dd MMM yyyy")}
      movementBadge={badge}
      subtitle={subtitle}
      position={position}
      thenNow={{
        previous: {
          url: centreImageUrl(previous.id, prevRawImages),
          date: formatScanDateShort(previous.createdAt),
        },
        current: {
          url: centreImageUrl(row.id, currentRawImages),
          date: formatScanDateShort(row.createdAt),
        },
        ...(firstRow && firstRawImages
          ? {
              first: {
                url: centreImageUrl(firstRow.id, firstRawImages),
                date: formatScanDateShort(firstRow.createdAt),
              },
            }
          : {}),
      }}
      scanImages={currentImages}
      detectionRegions={parseScanDetectionRegions(row.scores)}
      detectionRegionsByPose={parseScanDetectionRegionsByPose(row.scores)}
      wrinkleLines={parseScanWrinkleLines(row.scores)}
      wrinkleMaskUrl={parseScanWrinkleMaskDataUri(row.scores) ?? null}
      spotAnnotatedUrl={parseScanSpotAnnotatedUrl(row.scores) ?? null}
      bakedSpotAnnotations={Boolean(annotatedByPose)}
      maskExportVersion={parseMaskExportVersion(row.scores) ?? null}
      proxyRegions={faceMapProxyRegions(row.scores, metrics.clinical_scores, {
        hydration: metrics.hydration,
        texture: metrics.texture,
      })}
      parameters={paramRows}
      movementGroups={movementGroups}
      attributionCards={attributionCards}
      weekRecap={weekRecap}
      weekHighlight={weekHighlight}
      actions={actions.slice(0, 3)}
      nextStep={nextStep}
      doctorName={doctorName}
      aiUnavailable={aiUnavailable || !llm}
      shareLine={shareLine}
    />
  );
}
