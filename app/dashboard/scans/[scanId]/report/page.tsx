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
  parseScanWrinkleMaskDataUri,
} from "../../../../../src/lib/parseClinicalScores";
import { scanDisplayMetricsFromRow } from "../../../../../src/lib/resolveScanDisplayScores";
import {
  buildKaiReportParamRows,
  defaultInitialActions,
  filterScoredReportParams,
  initialReportHeadline,
  pickTopConcernName,
} from "../../../../../src/lib/kaiReportMapping";
import {
  movementToHeroBadge,
  scoreToGrade,
  subtitleFromGrades,
} from "../../../../../src/lib/report/gradeComputation";
import { buildMovementGroups, overallMovementFromScores } from "../../../../../src/lib/report/buildMovementGroups";
import { loadWellnessAndWeatherForScan } from "../../../../../src/lib/wellnessWeatherContext";
import {
  generateInitialReportContent,
  generateUpdateReportContent,
} from "../../../../../src/lib/report/generateReportContent";
import {
  buildAttributionCards,
  defaultNextStep,
  defaultUpdateActions,
  defaultUpdateHeadline,
  formatScanDateShort,
  formatShareLine,
  templateWeekHighlight,
  weekRecapFromWellness,
} from "../../../../../src/lib/report/updateReportTemplates";
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

function metricsFromRow(row: {
  overallScore: number;
  acne: number;
  wrinkles: number;
  pigmentation: number;
  hydration: number;
  texture: number;
  scores: unknown;
}) {
  return scanDisplayMetricsFromRow({
    overallScore: row.overallScore,
    acne: row.acne,
    wrinkles: row.wrinkles,
    pigmentation: row.pigmentation,
    hydration: row.hydration,
    texture: row.texture,
    scores: row.scores,
  });
}

function paramRowsFromMetrics(
  metrics: ReturnType<typeof metricsFromRow>
) {
  return filterScoredReportParams(
    buildKaiReportParamRows({
      clinical: metrics.clinical_scores ?? null,
      legacy: {
        acne: metrics.acne,
        wrinkles: metrics.wrinkles,
        pigmentation: metrics.pigmentation ?? 0,
        hydration: metrics.hydration,
        texture: metrics.texture ?? 0,
      },
    })
  );
}

function galleryImages(
  scanId: number,
  faceCaptureImages: FaceCaptureRef[] | null | undefined
) {
  const gallery = buildFaceCaptureGallery(scanId, faceCaptureImages);
  if (gallery && gallery.length > 0) {
    return gallery.map((g) => ({
      url: g.imageUrl,
      label: g.label,
      poseId: g.poseId,
    }));
  }
  return [
    {
      url: patientScanImagePath(scanId),
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
  } | null | undefined
) {
  return ensureScarsAndUnderEyeProxyRegions(parseScanProxyRegions(scores), {
    acne_scars: clinical?.acne_scars ?? null,
    under_eye: clinical?.under_eye ?? null,
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
  // are excluded — with only same-day data the Initial report is shown instead.
  const previousMeta = await db.query.scans.findFirst({
    where: and(
      eq(scans.userId, userId),
      lt(scans.createdAt, startOfDay(row.createdAt))
    ),
    orderBy: [desc(scans.createdAt), desc(scans.id)],
    columns: { id: true },
  });
  const previous = previousMeta
    ? await loadScanRow(userId, previousMeta.id)
    : null;

  const doctorName = "Dr. Ruby";
  const faceCaptureImages =
    ("faceCaptureImages" in row ? row.faceCaptureImages : null) as
      | FaceCaptureRef[]
      | null;

  // ── Initial Report ──────────────────────────────────────────────
  if (!previous) {
    const metrics = metricsFromRow(row);
    const paramRows = paramRowsFromMetrics(metrics);
    const gradeInfo = scoreToGrade(metrics.overall_score);
    const topConcern = pickTopConcernName(paramRows);
    const scanImages = galleryImages(row.id, faceCaptureImages);

    const { report: llm, aiUnavailable } = await generateInitialReportContent({
      patient: {
        first_name: user.name?.split(/\s+/)[0] ?? null,
        age: user.age,
        sex: user.gender,
        skin_type: user.skinType,
        fitzpatrick: user.fitzpatrick,
        primary_concern: user.primaryConcern,
        under_clinic_care: scoresUnlocked,
      },
      current_scan: {
        scan_id: String(row.id),
        captured_at: row.createdAt.toISOString(),
        grades: Object.fromEntries(
          paramRows.map((p) => [
            p.key,
            { letter: p.grade, severity: p.severity },
          ])
        ),
        overall: gradeInfo,
      },
    });

    const findingsByKey = new Map(
      (llm?.parameters ?? [])
        .filter((p) => p?.key && p.finding)
        .map((p) => [p.key!, p.finding!.trim()])
    );
    const parameters = paramRows.map((p) => ({
      ...p,
      finding: findingsByKey.get(p.key) || p.finding,
    }));

    const headline =
      llm?.overall?.headline?.trim() ||
      llm?.headline?.trim() ||
      initialReportHeadline(parameters);
    const synthesis =
      llm?.summary?.trim() ||
      row.aiSummary?.trim() ||
      `This baseline centres on ${topConcern.toLowerCase()}. On Indian skin, that pattern is often driven by a mix of UV, barrier stress and routine inconsistency — your next scans will show whether the plan is holding.`;
    const actions =
      llm?.actions?.filter((a) => typeof a === "string" && a.trim()).slice(0, 3) ??
      defaultInitialActions(topConcern);
    while (actions.length < 3) {
      actions.push(defaultInitialActions(topConcern)[actions.length]!);
    }

    const markerCount = Math.max(parameters.length, 1);
    const grade = llm?.overall?.letter?.trim() || gradeInfo.letter;
    const position = llm?.overall?.position ?? gradeInfo.position;

    return (
      <InitialKaiScanReport
        scanId={row.id}
        grade={grade}
        headline={headline}
        scanDateLabel={format(row.createdAt, "dd MMM yyyy")}
        position={position}
        subtitle={`${markerCount} marker${markerCount === 1 ? "" : "s"} mapped`}
        synthesis={synthesis}
        baselineBody={`${markerCount} marker${markerCount === 1 ? "" : "s"} ${markerCount === 1 ? "is" : "are"} now fixed against this capture. Next week’s scan measures the same points. Stability in week one is a good result — it means the baseline held.`}
        actions={actions.slice(0, 3)}
        parameters={parameters}
        scanImages={scanImages}
        detectionRegions={parseScanDetectionRegions(row.scores)}
        detectionRegionsByPose={parseScanDetectionRegionsByPose(row.scores)}
        wrinkleLines={parseScanWrinkleLines(row.scores)}
        wrinkleMaskUrl={parseScanWrinkleMaskDataUri(row.scores) ?? null}
        maskExportVersion={parseMaskExportVersion(row.scores) ?? null}
        proxyRegions={faceMapProxyRegions(
          row.scores,
          metrics.clinical_scores
        )}
        isExistingPatient={scoresUnlocked}
        doctorName={doctorName}
      />
    );
  }

  // ── Update Report ───────────────────────────────────────────────
  const allScans = await db.query.scans.findMany({
    where: eq(scans.userId, userId),
    orderBy: [asc(scans.createdAt), asc(scans.id)],
    columns: { id: true, createdAt: true },
  });
  const firstScanAt = allScans[0]?.createdAt ?? row.createdAt;
  const { weekNumber, streak } = weekMeta(allScans, row.id);

  const metrics = metricsFromRow(row);
  const prevMetrics = metricsFromRow(previous);
  const paramRows = paramRowsFromMetrics(metrics);
  const prevParamRows = paramRowsFromMetrics(prevMetrics);

  const gradeInfo = scoreToGrade(metrics.overall_score);
  const prevGradeInfo = scoreToGrade(prevMetrics.overall_score);
  const overallMv = overallMovementFromScores(
    metrics.overall_score,
    prevMetrics.overall_score
  );

  const { wellness, cityWeather } = await loadWellnessAndWeatherForScan({
    userId,
    scanDate: row.createdAt,
  });

  const recentEvent = await db.query.scheduleEvents.findFirst({
    where: and(eq(scheduleEvents.userId, userId)),
    orderBy: [desc(scheduleEvents.eventDate)],
    columns: { title: true, eventDate: true, eventKind: true },
  });
  const treatmentish =
    recentEvent &&
    (recentEvent.eventKind === "pre_treatment" ||
      recentEvent.eventKind === "post_treatment" ||
      /peel|laser|botox|filler|microneed|treatment/i.test(recentEvent.title))
      ? recentEvent
      : null;

  const { report: llm, aiUnavailable } = await generateUpdateReportContent({
    patient: {
      first_name: user.name?.split(/\s+/)[0] ?? null,
      age: user.age,
      sex: user.gender,
      skin_type: user.skinType,
      fitzpatrick: user.fitzpatrick,
      primary_concern: user.primaryConcern,
      under_clinic_care: scoresUnlocked,
    },
    current_scan: {
      scan_id: String(row.id),
      captured_at: row.createdAt.toISOString(),
      week_number: weekNumber,
      grades: Object.fromEntries(
        paramRows.map((p) => [p.key, { letter: p.grade, position: Math.round(100 - ((p.severity - 1) / 4) * 100), severity: p.severity }])
      ),
      overall: gradeInfo,
    },
    previous_scan: {
      scan_id: String(previous.id),
      captured_at: previous.createdAt.toISOString(),
      grades: Object.fromEntries(
        prevParamRows.map((p) => [p.key, { letter: p.grade, severity: p.severity }])
      ),
      overall: prevGradeInfo,
      narrative_summary: previous.aiSummary,
    },
    weekly_checkin: wellness ?? {},
    environment: cityWeather
      ? {
          city: cityWeather.city,
          detected: true,
          uv_index_peak: cityWeather.uvIndex,
          humidity_pct_avg: cityWeather.humidity,
          aqi_avg: cityWeather.aqi,
          temp_c_avg: cityWeather.tempC,
          condition: cityWeather.condition,
        }
      : {},
    clinic_record: {
      doctor: doctorName,
      treatments: treatmentish
        ? [
            {
              type: treatmentish.eventKind,
              title: treatmentish.title,
              date: format(treatmentish.eventDate, "yyyy-MM-dd"),
            },
          ]
        : [],
    },
  });

  const llmFindings: Record<string, { finding?: string; movement?: string }> =
    {};
  for (const p of llm?.parameters ?? []) {
    if (!p?.key) continue;
    llmFindings[p.key] = {
      finding: p.finding,
      movement: p.movement,
    };
  }

  const movementGroups = buildMovementGroups({
    current: paramRows,
    previous: prevParamRows,
    firstScanAt,
    currentScanAt: row.createdAt,
    llmFindings,
  });

  const letter = llm?.overall?.letter?.trim() || gradeInfo.letter;
  const position = {
    current: llm?.overall?.position ?? gradeInfo.position,
    previous: llm?.overall?.previous_position ?? prevGradeInfo.position,
  };
  const prevLetter =
    llm?.overall?.previous_letter?.trim() || prevGradeInfo.letter;
  const mvKind =
    (llm?.overall?.movement as typeof overallMv | undefined) &&
    ["improved", "holding", "declined"].includes(String(llm?.overall?.movement))
      ? (llm!.overall!.movement as typeof overallMv)
      : overallMv;

  const topConcern = pickTopConcernName(paramRows);
  const headline =
    llm?.overall?.headline?.trim() ||
    defaultUpdateHeadline(letter, paramRows, mvKind);
  const badge = movementToHeroBadge(mvKind);
  const subtitle = subtitleFromGrades(letter, prevLetter, mvKind);

  const attributionCards = buildAttributionCards({
    cityWeather,
    wellness,
    recentTreatmentTitle: treatmentish?.title ?? null,
    recentTreatmentDate: treatmentish
      ? format(treatmentish.eventDate, "d MMM")
      : null,
    llm,
  });

  const weekRecap =
    llm?.week_recap &&
    (llm.week_recap.sleep || llm.week_recap.stress || llm.week_recap.water)
      ? [
          { label: "Sleep", value: llm.week_recap.sleep || "—" },
          { label: "Stress", value: llm.week_recap.stress || "—" },
          {
            label: "Water",
            value: llm.week_recap.water || "—",
          },
          {
            label: "Routine",
            value: llm.week_recap.routine_adherence || "—",
          },
        ]
      : weekRecapFromWellness(wellness);

  const weekHighlight =
    llm?.week_recap?.highlight?.trim() || templateWeekHighlight(wellness);

  const actionsRaw =
    llm?.actions?.filter((a) => typeof a === "string" && a.trim()).slice(0, 3) ??
    [];
  const actions =
    actionsRaw.length >= 3
      ? actionsRaw
      : defaultUpdateActions({ topConcern });

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

  const currentImages = galleryImages(row.id, faceCaptureImages);
  const prevFace =
    ("faceCaptureImages" in previous ? previous.faceCaptureImages : null) as
      | FaceCaptureRef[]
      | null;
  const prevImages = galleryImages(previous.id, prevFace);

  const shareLine =
    llm?.share_card?.line?.trim() ||
    formatShareLine(weekNumber, letter, mvKind, topConcern);

  return (
    <UpdateKaiScanReport
      scanId={row.id}
      grade={letter}
      headline={headline}
      metaLeft={`Week ${weekNumber} · ${streak}-week streak`}
      metaRight={format(row.createdAt, "dd MMM yyyy")}
      movementBadge={badge}
      subtitle={subtitle}
      position={position}
      thenNow={{
        previous: {
          url: centreImageUrl(previous.id, prevImages),
          date: formatScanDateShort(previous.createdAt),
        },
        current: {
          url: centreImageUrl(row.id, currentImages),
          date: formatScanDateShort(row.createdAt),
        },
      }}
      scanImages={currentImages}
      detectionRegions={parseScanDetectionRegions(row.scores)}
      detectionRegionsByPose={parseScanDetectionRegionsByPose(row.scores)}
      wrinkleLines={parseScanWrinkleLines(row.scores)}
      wrinkleMaskUrl={parseScanWrinkleMaskDataUri(row.scores) ?? null}
      maskExportVersion={parseMaskExportVersion(row.scores) ?? null}
      proxyRegions={faceMapProxyRegions(row.scores, metrics.clinical_scores)}
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
