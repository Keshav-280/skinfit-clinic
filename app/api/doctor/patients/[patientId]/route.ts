import { NextResponse } from "next/server";
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
import { getDoctorPortalUserId } from "@/src/lib/auth/doctor-access";
import { ymdFromDateOnly } from "@/src/lib/date-only";
import { localYmdAndHm, normalizeIanaTimeZone } from "@/src/lib/timeZoneWallClock";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ patientId: string }> }
) {
  const staffId = await getDoctorPortalUserId();
  if (!staffId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { patientId } = await ctx.params;
  if (!patientId) {
    return NextResponse.json({ error: "INVALID" }, { status: 400 });
  }

  const patient = await db.query.users.findFirst({
    where: and(eq(users.id, patientId), eq(users.role, "patient")),
    columns: {
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
    },
  });

  if (!patient) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const [
    scanRowsRaw,
    visitRows,
    voiceRows,
    logRows,
    qaRows,
    dnaRow,
    legacySkinRows,
    weeklyRows,
    monthlyRows,
    apptRows,
  ] = await Promise.all([
    db.query.scans.findMany({
      where: eq(scans.userId, patientId),
      orderBy: [desc(scans.createdAt)],
      limit: 40,
    }),
    db
      .select({
        id: visitNotes.id,
        visitDate: visitNotes.visitDate,
        doctorName: visitNotes.doctorName,
        notes: visitNotes.notes,
        attachments: visitNotes.attachments,
        createdAt: visitNotes.createdAt,
      })
      .from(visitNotes)
      .where(eq(visitNotes.userId, patientId))
      .orderBy(desc(visitNotes.visitDate))
      .limit(25),
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
    db
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
      .limit(35),
  ]);

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
    scheduleRows = rows.map((r) => ({ ...r, eventKind: r.eventKind ?? "general" }));
  } catch {
    // Backward compatibility: older DBs may not have `event_kind` yet.
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

  const scanIds = scanRowsRaw.map((s) => s.id);
  const paramRows =
    scanIds.length > 0
      ? await db.query.parameterScores.findMany({
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
        })
      : [];

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

  const calendarTodayYmd = localYmdAndHm(
    new Date(),
    normalizeIanaTimeZone(patient.timezone)
  ).ymd;

  const pidEnc = encodeURIComponent(patientId);
  const scanList = scanRowsRaw.map((s) => {
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
      faceCaptureCount: s.faceCaptureImages?.length ? s.faceCaptureImages.length : 1,
      imageDoctorUrl: `/api/doctor/patients/${pidEnc}/scans/${s.id}/image?preview=1`,
    };
  });

  return NextResponse.json({
    success: true,
    calendarTodayYmd,
    patient: {
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
    },
    scans: scanList,
    parameterScoresByScanId,
    visits: visitRows.map((v) => ({
      id: v.id,
      visitDate:
        v.visitDate instanceof Date
          ? v.visitDate.toISOString().slice(0, 10)
          : String(v.visitDate),
      doctorName: v.doctorName,
      notes: v.notes,
      attachments: v.attachments ?? null,
      createdAt: v.createdAt.toISOString(),
    })),
    recentVoiceNotes: voiceRows.map((v) => ({
      id: v.id,
      scanId: v.scanId,
      createdAt: v.createdAt.toISOString(),
    })),
    dailyLogs: logRows.map((l) => ({
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
    })),
    questionnaireAnswers: qaRows.map((q) => ({
      id: q.id,
      questionId: q.questionId,
      answer: q.answer,
      questionnaireVersion: q.questionnaireVersion,
      createdAt: q.createdAt.toISOString(),
    })),
    skinDnaCard: dnaRow
      ? {
          skinType: dnaRow.skinType,
          primaryConcern: dnaRow.primaryConcern,
          sensitivityIndex: dnaRow.sensitivityIndex,
          uvSensitivity: dnaRow.uvSensitivity,
          hormonalCorrelation: dnaRow.hormonalCorrelation,
          revision: dnaRow.revision,
          updatedAt: dnaRow.updatedAt.toISOString(),
        }
      : null,
    legacySkinScans: legacySkinRows.map((r) => ({
      id: r.id,
      skinScore: r.skinScore,
      analysisResults: r.analysisResults,
      createdAt: r.createdAt.toISOString(),
    })),
    weeklyReports: weeklyRows.map((w) => ({
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
    })),
    monthlyReports: monthlyRows.map((m) => ({
      id: m.id,
      monthStartYmd: ymdFromDateOnly(m.monthStart),
      payloadJson: m.payloadJson,
      createdAt: m.createdAt.toISOString(),
    })),
    appointments: apptRows.map((a) => ({
      id: a.id,
      dateTime: a.dateTime.toISOString(),
      status: a.status,
      type: a.type,
      doctorName: a.doctorName,
      doctorEmail: a.doctorEmail,
    })),
    scheduleEvents: scheduleRows.map((s) => ({
      id: s.id,
      eventDateYmd: ymdFromDateOnly(s.eventDate),
      eventTimeHm: s.eventTimeHm ?? null,
      title: s.title,
      eventKind: s.eventKind,
      completed: s.completed,
    })),
  });
}
