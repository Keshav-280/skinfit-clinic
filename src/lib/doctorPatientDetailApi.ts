import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/src/db";
import {
  appointments,
  dailyLogs,
  doctorFeedbackVoiceNotes,
  monthlyReports,
  parameterScores,
  questionnaireAnswers,
  scans,
  scheduleEvents,
  skinDnaCards,
  skinScans,
  users,
  visitNotes,
  weeklyReports,
} from "@/src/db/schema";
import { ymdFromDateOnly } from "@/src/lib/date-only";
import { localYmdAndHm, normalizeIanaTimeZone } from "@/src/lib/timeZoneWallClock";
import {
  loadPatientMonthlyInsightSnapshot,
  loadPatientWeeklyInsightViewModel,
} from "@/src/lib/patientInsightParity.server";

export const DOCTOR_PATIENT_DETAIL_SECTIONS = [
  "profile",
  "scans",
  "activity",
  "schedule",
  "reports",
] as const;

export type DoctorPatientDetailSection =
  (typeof DOCTOR_PATIENT_DETAIL_SECTIONS)[number];

function isMissingFaceCaptureColumn(error: unknown): boolean {
  const err = error as { code?: string; message?: string };
  if (err?.code === "42703") return true;
  const m = err?.message ?? "";
  return (
    /face_capture_images/i.test(m) &&
    (/does not exist/i.test(m) || /undefined column/i.test(m))
  );
}

const DOCTOR_PATIENT_SCAN_COLUMNS = {
  id: true,
  scanName: true,
  overallScore: true,
  acne: true,
  pigmentation: true,
  wrinkles: true,
  hydration: true,
  texture: true,
  aiSummary: true,
  scores: true,
  annotations: true,
  createdAt: true,
  faceCaptureImages: true,
} as const;

function faceCaptureCountFromScanRow(row: unknown): number {
  const fc = (row as { faceCaptureImages?: unknown[] | null }).faceCaptureImages;
  const n = fc?.length;
  return n && n > 0 ? n : 1;
}

function scanScope(patientId: string) {
  return eq(scans.userId, patientId);
}

async function loadDoctorPatientScans(patientId: string) {
  try {
    return await db.query.scans.findMany({
      where: scanScope(patientId),
      orderBy: [desc(scans.createdAt)],
      limit: 40,
      columns: DOCTOR_PATIENT_SCAN_COLUMNS,
    });
  } catch (e) {
    if (!isMissingFaceCaptureColumn(e)) throw e;
    const { faceCaptureImages: _fc, ...withoutFace } = DOCTOR_PATIENT_SCAN_COLUMNS;
    return await db.query.scans.findMany({
      where: scanScope(patientId),
      orderBy: [desc(scans.createdAt)],
      limit: 40,
      columns: withoutFace,
    });
  }
}

export function parseDoctorPatientDetailSections(
  raw: string | null
): DoctorPatientDetailSection[] | "all" {
  if (!raw || raw.trim() === "" || raw === "all") return "all";
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const valid = parts.filter((p): p is DoctorPatientDetailSection =>
    (DOCTOR_PATIENT_DETAIL_SECTIONS as readonly string[]).includes(p)
  );
  if (valid.length === 0) return "all";
  return [...new Set(valid)];
}

const PATIENT_COLUMNS = {
  id: true,
  name: true,
  email: true,
  phone: true,
  phoneCountryCode: true,
  age: true,
  skinType: true,
  primaryGoal: true,
  timezone: true,
  routineRemindersEnabled: true,
  routineAmReminderHm: true,
  routinePmReminderHm: true,
  onboardingComplete: true,
  onboardingCompletedAt: true,
  primaryConcern: true,
  concernSeverity: true,
  concernDuration: true,
  triggers: true,
  priorTreatment: true,
  treatmentHistoryText: true,
  treatmentHistoryDuration: true,
  skinSensitivity: true,
  baselineSleep: true,
  baselineHydration: true,
  baselineDietType: true,
  baselineSunExposure: true,
  fitzpatrick: true,
  streakCurrent: true,
  streakLongest: true,
  streakLastDate: true,
  cycleTrackingEnabled: true,
  appointmentReminderHoursBefore: true,
  doctorFeedbackNote: true,
  doctorFeedbackUpdatedAt: true,
  createdAt: true,
  routinePlanAmItems: true,
  routinePlanPmItems: true,
  routinePlanClinicianLocked: true,
  clinicVisitedAt: true,
} as const;

export async function loadDoctorPatientRecord(patientId: string) {
  return db.query.users.findFirst({
    where: and(eq(users.id, patientId), eq(users.role, "patient")),
    columns: PATIENT_COLUMNS,
  });
}

export function serializeDoctorPatient(
  patient: NonNullable<Awaited<ReturnType<typeof loadDoctorPatientRecord>>>
) {
  return {
    ...patient,
    streakLastDate: patient.streakLastDate
      ? ymdFromDateOnly(patient.streakLastDate)
      : null,
    onboardingCompletedAt: patient.onboardingCompletedAt
      ? patient.onboardingCompletedAt.toISOString()
      : null,
    doctorFeedbackUpdatedAt: patient.doctorFeedbackUpdatedAt
      ? patient.doctorFeedbackUpdatedAt.toISOString()
      : null,
    createdAt: patient.createdAt.toISOString(),
    clinicVisitedAt: patient.clinicVisitedAt
      ? patient.clinicVisitedAt.toISOString()
      : null,
  };
}

export async function loadDoctorPatientDetailSections(
  patientId: string,
  patient: NonNullable<Awaited<ReturnType<typeof loadDoctorPatientRecord>>>,
  sections: DoctorPatientDetailSection[] | "all"
): Promise<Record<string, unknown>> {
  const want = (s: DoctorPatientDetailSection) =>
    sections === "all" || sections.includes(s);

  const payload: Record<string, unknown> = { success: true };

  if (want("profile")) {
    payload.calendarTodayYmd = localYmdAndHm(
      new Date(),
      normalizeIanaTimeZone(patient.timezone)
    ).ymd;
    payload.patient = serializeDoctorPatient(patient);
  }

  if (want("scans")) {
    const scanRowsRaw = await loadDoctorPatientScans(patientId);
    const scanIds = scanRowsRaw.map((s) => s.id);
    type ParamScoreRow = {
      scanId: number;
      paramKey: string;
      value: number | null;
      source: string;
      severityFlag: boolean;
      deltaVsPrev: number | null;
      extras: unknown;
      recordedAt: Date;
    };
    let paramRows: ParamScoreRow[] = [];
    if (scanIds.length > 0) {
      try {
        paramRows = await db.query.parameterScores.findMany({
          where: inArray(parameterScores.scanId, scanIds),
          columns: {
            scanId: true,
            paramKey: true,
            value: true,
            source: true,
            severityFlag: true,
            deltaVsPrev: true,
            extras: true,
            recordedAt: true,
          },
        });
      } catch (e) {
        console.warn(
          "[doctorPatientDetail] parameter_scores unavailable — scans list still returned",
          e
        );
      }
    }

    const parameterScoresByScanId: Record<
      string,
      Array<{
        paramKey: string;
        value: number | null;
        source: string;
        severityFlag: boolean;
        deltaVsPrev: number | null;
        extras: Record<string, unknown> | null;
        recordedAt: string;
      }>
    > = {};

    for (const pr of paramRows) {
      const key = String(pr.scanId);
      const list = parameterScoresByScanId[key] ?? [];
      list.push({
        paramKey: pr.paramKey,
        value: pr.value,
        source: pr.source,
        severityFlag: pr.severityFlag,
        deltaVsPrev: pr.deltaVsPrev,
        extras: (pr.extras as Record<string, unknown> | null) ?? null,
        recordedAt: pr.recordedAt.toISOString(),
      });
      parameterScoresByScanId[key] = list;
    }

    const pidEnc = encodeURIComponent(patientId);
    payload.scans = scanRowsRaw.map((s) => {
      const eczema = Math.min(
        100,
        Math.max(0, Math.round((s.hydration + s.acne + s.texture) / 3))
      );
      return {
        id: s.id,
        scanName: s.scanName,
        overallScore: s.overallScore,
        acne: s.acne,
        pigmentation: s.pigmentation,
        wrinkles: s.wrinkles,
        hydration: s.hydration,
        texture: s.texture,
        eczema,
        aiSummary: s.aiSummary,
        scores: s.scores,
        annotations: s.annotations,
        createdAt: s.createdAt.toISOString(),
        faceCaptureCount: faceCaptureCountFromScanRow(s),
        imageDoctorUrl: `/api/doctor/patients/${pidEnc}/scans/${s.id}/image?preview=1`,
      };
    });
    payload.parameterScoresByScanId = parameterScoresByScanId;
  }

  if (want("activity")) {
    const [visitRows, voiceRows, logRows, qaRows, dnaRow] = await Promise.all([
      db
        .select({
          id: visitNotes.id,
          visitDate: visitNotes.visitDate,
          doctorName: visitNotes.doctorName,
          notes: visitNotes.notes,
          purpose: visitNotes.purpose,
          treatments: visitNotes.treatments,
          preAdvice: visitNotes.preAdvice,
          postAdvice: visitNotes.postAdvice,
          prescription: visitNotes.prescription,
          responseRating: visitNotes.responseRating,
          attachments: visitNotes.attachments,
          createdAt: visitNotes.createdAt,
        })
        .from(visitNotes)
        .where(eq(visitNotes.userId, patientId))
        .orderBy(desc(visitNotes.visitDate))
        .limit(100),
      db
        .select({
          id: doctorFeedbackVoiceNotes.id,
          scanId: doctorFeedbackVoiceNotes.scanId,
          createdAt: doctorFeedbackVoiceNotes.createdAt,
        })
        .from(doctorFeedbackVoiceNotes)
        .where(eq(doctorFeedbackVoiceNotes.userId, patientId))
        .orderBy(desc(doctorFeedbackVoiceNotes.createdAt))
        .limit(30),
      db.query.dailyLogs.findMany({
        where: eq(dailyLogs.userId, patientId),
        orderBy: [desc(dailyLogs.date)],
        limit: 45,
      }),
      db.query.questionnaireAnswers.findMany({
        where: eq(questionnaireAnswers.userId, patientId),
        orderBy: [desc(questionnaireAnswers.createdAt)],
        limit: 200,
      }),
      db.query.skinDnaCards.findFirst({
        where: eq(skinDnaCards.userId, patientId),
      }),
    ]);

    payload.visits = visitRows.map((v) => ({
      id: v.id,
      visitDate:
        v.visitDate instanceof Date
          ? v.visitDate.toISOString().slice(0, 10)
          : String(v.visitDate),
      doctorName: v.doctorName,
      notes: v.notes,
      purpose: v.purpose ?? undefined,
      treatments: v.treatments ?? undefined,
      preAdvice: v.preAdvice ?? undefined,
      postAdvice: v.postAdvice ?? undefined,
      prescription: v.prescription ?? undefined,
      responseRating: v.responseRating ?? undefined,
      attachments: v.attachments ?? null,
      createdAt: v.createdAt.toISOString(),
    }));
    payload.recentVoiceNotes = voiceRows.map((v) => ({
      id: v.id,
      scanId: v.scanId,
      createdAt: v.createdAt.toISOString(),
    }));
    payload.dailyLogs = logRows.map((l) => ({
      id: l.id,
      dateYmd: ymdFromDateOnly(l.date),
      amRoutine: l.amRoutine,
      pmRoutine: l.pmRoutine,
      mood: l.mood,
      routineAmSteps: l.routineAmSteps ?? null,
      routinePmSteps: l.routinePmSteps ?? null,
      sleepHours: l.sleepHours,
      stressLevel: l.stressLevel,
      waterGlasses: l.waterGlasses,
      journalEntry: l.journalEntry,
      dietType: l.dietType,
      sunExposure: l.sunExposure,
      cycleDay: l.cycleDay,
      comments: l.comments,
      createdAt: l.createdAt.toISOString(),
    }));
    payload.questionnaireAnswers = qaRows.map((q) => ({
      id: q.id,
      questionId: q.questionId,
      answer: q.answer,
      questionnaireVersion: q.questionnaireVersion,
      createdAt: q.createdAt.toISOString(),
    }));
    payload.skinDnaCard = dnaRow
      ? {
          skinType: dnaRow.skinType,
          primaryConcern: dnaRow.primaryConcern,
          sensitivityIndex: dnaRow.sensitivityIndex,
          uvSensitivity: dnaRow.uvSensitivity,
          hormonalCorrelation: dnaRow.hormonalCorrelation,
          revision: dnaRow.revision,
          updatedAt: dnaRow.updatedAt.toISOString(),
        }
      : null;
  }

  if (want("schedule")) {
    const apptRows = await db
      .select({
        id: appointments.id,
        dateTime: appointments.dateTime,
        status: appointments.status,
        type: appointments.type,
        doctorName: users.name,
        doctorEmail: users.email,
      })
      .from(appointments)
      .innerJoin(users, eq(appointments.doctorId, users.id))
      .where(eq(appointments.userId, patientId))
      .orderBy(desc(appointments.dateTime))
      .limit(35);

    let scheduleRows: Array<{
      id: string;
      eventDate: Date;
      eventTimeHm: string | null;
      title: string;
      eventKind: string;
      completed: boolean;
    }> = [];

    try {
      const rows = await db.query.scheduleEvents.findMany({
        where: eq(scheduleEvents.userId, patientId),
        orderBy: [
          asc(scheduleEvents.eventDate),
          asc(scheduleEvents.eventTimeHm),
          asc(scheduleEvents.title),
        ],
        limit: 80,
        columns: {
          id: true,
          eventDate: true,
          eventTimeHm: true,
          title: true,
          eventKind: true,
          completed: true,
        },
      });
      scheduleRows = rows.map((r) => ({
        ...r,
        eventKind: r.eventKind ?? "general",
      }));
    } catch {
      const legacyRows = await db.query.scheduleEvents.findMany({
        where: eq(scheduleEvents.userId, patientId),
        orderBy: [
          asc(scheduleEvents.eventDate),
          asc(scheduleEvents.eventTimeHm),
          asc(scheduleEvents.title),
        ],
        limit: 80,
        columns: {
          id: true,
          eventDate: true,
          eventTimeHm: true,
          title: true,
          completed: true,
        },
      });
      scheduleRows = legacyRows.map((r) => ({ ...r, eventKind: "general" }));
    }

    payload.appointments = apptRows.map((a) => ({
      id: a.id,
      dateTime: a.dateTime.toISOString(),
      status: a.status,
      type: a.type,
      doctorName: a.doctorName,
      doctorEmail: a.doctorEmail,
    }));
    payload.scheduleEvents = scheduleRows.map((s) => ({
      id: s.id,
      eventDateYmd: ymdFromDateOnly(s.eventDate),
      eventTimeHm: s.eventTimeHm ?? null,
      title: s.title,
      eventKind: s.eventKind,
      completed: s.completed,
    }));
  }

  if (want("reports")) {
    const [legacySkinRows, weeklyRows, monthlyRows, patientWeeklyInsight, patientMonthlyInsight] =
      await Promise.all([
      db.query.skinScans.findMany({
        where: eq(skinScans.userId, patientId),
        orderBy: [desc(skinScans.createdAt)],
        limit: 20,
        columns: {
          id: true,
          skinScore: true,
          analysisResults: true,
          createdAt: true,
        },
      }),
      db.query.weeklyReports.findMany({
        where: eq(weeklyReports.userId, patientId),
        orderBy: [desc(weeklyReports.weekStart)],
        limit: 16,
      }),
      db.query.monthlyReports.findMany({
        where: eq(monthlyReports.userId, patientId),
        orderBy: [desc(monthlyReports.monthStart)],
        limit: 12,
      }),
      loadPatientWeeklyInsightViewModel(patientId),
      loadPatientMonthlyInsightSnapshot(patientId),
    ]);

    payload.legacySkinScans = legacySkinRows.map((r) => ({
      id: r.id,
      skinScore: r.skinScore,
      analysisResults: r.analysisResults,
      createdAt: r.createdAt.toISOString(),
    }));
    payload.weeklyReports = weeklyRows.map((w) => ({
      id: w.id,
      weekStartYmd: ymdFromDateOnly(w.weekStart),
      kaiScore: w.kaiScore,
      weeklyDelta: w.weeklyDelta,
      consistencyScore: w.consistencyScore,
      causesJson: w.causesJson,
      focusActionsJson: w.focusActionsJson,
      resourcesJson: w.resourcesJson,
      narrativeText: w.narrativeText,
      createdAt: w.createdAt.toISOString(),
    }));
    payload.monthlyReports = monthlyRows.map((m) => ({
      id: m.id,
      monthStartYmd: ymdFromDateOnly(m.monthStart),
      payloadJson: m.payloadJson,
      createdAt: m.createdAt.toISOString(),
    }));
    payload.patientWeeklyInsight = patientWeeklyInsight;
    payload.patientMonthlyInsight = patientMonthlyInsight;
  }

  return payload;
}
