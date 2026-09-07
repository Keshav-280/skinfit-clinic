import { and, asc, desc, eq, lt } from "drizzle-orm";
import { format, startOfDay } from "date-fns";
import { db } from "@/src/db/client";
import { scans, scheduleEvents, users } from "@/src/db/schema";
import { isPatientClinicVisited } from "@/src/lib/patientClinicVisit";
import { buildKaiReportParamRowsFromRag } from "@/src/lib/kaiReportMapping";
import { scoreToGrade } from "@/src/lib/report/gradeComputation";
import { loadWellnessAndWeatherForScan } from "@/src/lib/wellnessWeatherContext";
import { scanDisplayResolvedFromRow } from "@/src/lib/resolveScanDisplayScores";
import {
  generateInitialReportContent,
  generateUpdateReportContent,
} from "@/src/lib/report/generateReportContent";
import {
  readKaiReportSnapshot,
  writeKaiReportSnapshot,
  type KaiReportKind,
} from "@/src/lib/report/kaiReportSnapshot";

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

/**
 * Build the Kai narrative once and store it on the scan so the report page
 * does not wait on OpenAI on first open (or later revisits).
 */
export async function generateAndPersistKaiReport(
  userId: string,
  scanId: number
): Promise<boolean> {
  const [user, row, scoresUnlocked] = await Promise.all([
    db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        name: true,
        age: true,
        gender: true,
        skinType: true,
        primaryConcern: true,
        fitzpatrick: true,
      },
    }),
    db.query.scans.findFirst({
      where: and(eq(scans.id, scanId), eq(scans.userId, userId)),
      columns: {
        id: true,
        createdAt: true,
        overallScore: true,
        acne: true,
        wrinkles: true,
        pigmentation: true,
        hydration: true,
        texture: true,
        scores: true,
        aiSummary: true,
      },
    }),
    isPatientClinicVisited(userId),
  ]);
  if (!user || !row) return false;

  const existing = readKaiReportSnapshot(row.scores);
  if (existing?.report) return true;

  const [previousMeta, { wellness, cityWeather }] = await Promise.all([
    db.query.scans.findFirst({
      where: and(
        eq(scans.userId, userId),
        lt(scans.createdAt, startOfDay(row.createdAt))
      ),
      orderBy: [desc(scans.createdAt), desc(scans.id)],
      columns: { id: true },
    }),
    loadWellnessAndWeatherForScan({ userId, scanDate: row.createdAt }),
  ]);

  const previous = previousMeta
    ? await db.query.scans.findFirst({
        where: and(eq(scans.id, previousMeta.id), eq(scans.userId, userId)),
        columns: {
          id: true,
          createdAt: true,
          overallScore: true,
          acne: true,
          wrinkles: true,
          pigmentation: true,
          hydration: true,
          texture: true,
          scores: true,
          aiSummary: true,
        },
      })
    : null;

  const resolved = resolvedFromRow(row);
  const paramRows = buildKaiReportParamRowsFromRag(resolved.resolvedRagParamValues);
  const gradeInfo = scoreToGrade(resolved.metrics.overall_score);
  const environment = cityWeather
    ? {
        city: cityWeather.city,
        detected: true,
        uv_index_peak: cityWeather.uvIndex,
        humidity_pct_avg: cityWeather.humidity,
        aqi_avg: cityWeather.aqi,
        temp_c_avg: cityWeather.tempC,
        condition: cityWeather.condition,
      }
    : null;
  const patient = {
    first_name: user.name?.split(/\s+/)[0] ?? null,
    age: user.age,
    sex: user.gender,
    skin_type: user.skinType,
    fitzpatrick: user.fitzpatrick,
    primary_concern: user.primaryConcern,
    under_clinic_care: scoresUnlocked,
  };

  let kind: KaiReportKind = "initial";
  let report: Awaited<
    ReturnType<typeof generateInitialReportContent>
  >["report"] = null;
  let aiUnavailable = true;

  if (!previous) {
    const generated = await generateInitialReportContent({
      patient,
      current_scan: {
        scan_id: String(row.id),
        captured_at: row.createdAt.toISOString(),
        grades: Object.fromEntries(
          paramRows.map((p) => [
            p.key,
            { score_10: p.score10, position: Math.round(p.clarity), severity: p.severity },
          ])
        ),
        overall: gradeInfo,
      },
      weekly_checkin: wellness,
      environment,
      focus_parameters: paramRows.map((p) => ({
        key: p.key,
        name: p.name,
        score_10: p.score10,
      })),
    });
    report = generated.report;
    aiUnavailable = generated.aiUnavailable;
  } else {
    kind = "update";
    const [allScans, recentEvent] = await Promise.all([
      db.query.scans.findMany({
        where: eq(scans.userId, userId),
        orderBy: [asc(scans.createdAt), asc(scans.id)],
        columns: { id: true },
      }),
      db.query.scheduleEvents.findFirst({
        where: eq(scheduleEvents.userId, userId),
        orderBy: [desc(scheduleEvents.eventDate)],
        columns: { title: true, eventDate: true, eventKind: true },
      }),
    ]);
    const weekNumber = Math.max(
      1,
      allScans.findIndex((s) => s.id === row.id) + 1
    );
    const prevResolved = resolvedFromRow(previous);
    const prevParamRows = buildKaiReportParamRowsFromRag(
      prevResolved.resolvedRagParamValues
    );
    const prevGradeInfo = scoreToGrade(prevResolved.metrics.overall_score);
    const treatmentish =
      recentEvent &&
      (recentEvent.eventKind === "pre_treatment" ||
        recentEvent.eventKind === "post_treatment" ||
        /peel|laser|botox|filler|microneed|treatment/i.test(recentEvent.title))
        ? recentEvent
        : null;

    const generated = await generateUpdateReportContent({
      patient,
      current_scan: {
        scan_id: String(row.id),
        captured_at: row.createdAt.toISOString(),
        week_number: weekNumber,
        grades: Object.fromEntries(
          paramRows.map((p) => [
            p.key,
            {
              score_10: p.score10,
              position: Math.round(p.clarity),
              severity: p.severity,
            },
          ])
        ),
        overall: gradeInfo,
      },
      previous_scan: {
        scan_id: String(previous.id),
        captured_at: previous.createdAt.toISOString(),
        grades: Object.fromEntries(
          prevParamRows.map((p) => [
            p.key,
            {
              score_10: p.score10,
              position: Math.round(p.clarity),
              severity: p.severity,
            },
          ])
        ),
        overall: prevGradeInfo,
        narrative_summary: previous.aiSummary,
      },
      weekly_checkin: wellness,
      focus_parameters: paramRows.map((p) => {
        const prev = prevParamRows.find((x) => x.key === p.key);
        return {
          key: p.key,
          name: p.name,
          score_10: p.score10,
          previous_score_10: prev?.score10 ?? null,
          movement: prev
            ? prev.score10 < p.score10
              ? "improved"
              : prev.score10 > p.score10
                ? "declined"
                : "holding"
            : "baseline",
        };
      }),
      environment: environment ?? {},
      clinic_record: {
        doctor: "Dr. Ruby",
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
    report = generated.report;
    aiUnavailable = generated.aiUnavailable;
  }

  if (!report) return false;
  await writeKaiReportSnapshot(userId, scanId, {
    kind,
    generatedAt: new Date().toISOString(),
    aiUnavailable,
    report,
  });
  return true;
}
