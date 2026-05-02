import { NextResponse } from "next/server";
import { and, desc, eq, gte } from "drizzle-orm";
import { subDays } from "date-fns";
import { db } from "@/src/db";
import {
  dailyFocus,
  dailyLogs,
  doctorFeedbackVoiceNotes,
  scans,
  skinScans,
  users,
  visitNotes,
} from "@/src/db/schema";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import {
  dateOnlyFromYmd,
  localCalendarYmd,
  parseYmdToDateOnly,
} from "@/src/lib/date-only";
import { AM_ROUTINE_ITEMS, PM_ROUTINE_ITEMS } from "@/src/lib/routine";

function clampPct(n: number) {
  return Math.min(100, Math.max(0, Math.round(n)));
}

export async function GET(request: Request) {
  const userId = await getSessionUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date");
  const parsed = dateParam ? parseYmdToDateOnly(dateParam) : null;
  const todayDateOnly = parsed
    ? parsed
    : dateOnlyFromYmd(localCalendarYmd());
  const weekCut = subDays(todayDateOnly, 7);

  const [
    skinScanRows,
    todayLog,
    userRow,
    lastScans,
    recentLogs,
    focusRow,
    voiceRow,
    visitRow,
  ] = await Promise.all([
    db.query.skinScans.findMany({
      where: eq(skinScans.userId, userId),
      orderBy: [desc(skinScans.createdAt)],
      columns: {
        id: true,
        skinScore: true,
        createdAt: true,
        analysisResults: true,
      },
    }),
    db.query.dailyLogs.findFirst({
      where: and(
        eq(dailyLogs.userId, userId),
        eq(dailyLogs.date, todayDateOnly)
      ),
    }),
    db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        streakCurrent: true,
        streakLongest: true,
        doctorFeedbackViewedAt: true,
        cycleTrackingEnabled: true,
      },
    }),
    db
      .select({
        overallScore: scans.overallScore,
        createdAt: scans.createdAt,
      })
      .from(scans)
      .where(eq(scans.userId, userId))
      .orderBy(desc(scans.createdAt))
      .limit(2),
    db
      .select()
      .from(dailyLogs)
      .where(
        and(eq(dailyLogs.userId, userId), gte(dailyLogs.date, weekCut))
      ),
    db.query.dailyFocus.findFirst({
      where: and(
        eq(dailyFocus.userId, userId),
        eq(dailyFocus.focusDate, todayDateOnly)
      ),
    }),
    db
      .select({
        id: doctorFeedbackVoiceNotes.id,
        audioDataUri: doctorFeedbackVoiceNotes.audioDataUri,
        createdAt: doctorFeedbackVoiceNotes.createdAt,
      })
      .from(doctorFeedbackVoiceNotes)
      .where(eq(doctorFeedbackVoiceNotes.userId, userId))
      .orderBy(desc(doctorFeedbackVoiceNotes.createdAt))
      .limit(1),
    db
      .select({ notes: visitNotes.notes, createdAt: visitNotes.createdAt })
      .from(visitNotes)
      .where(eq(visitNotes.userId, userId))
      .orderBy(desc(visitNotes.createdAt))
      .limit(1),
  ]);

  const skinScanHistory = skinScanRows.map((r) => ({
    id: r.id,
    skinScore: r.skinScore,
    createdAt: r.createdAt.toISOString(),
    analysisResults: r.analysisResults,
  }));

  const todayLogOut = todayLog
    ? {
        journalEntry: todayLog.journalEntry,
        sleepHours: todayLog.sleepHours,
        stressLevel: todayLog.stressLevel,
        waterGlasses: todayLog.waterGlasses,
        mood: todayLog.mood,
        amRoutine: todayLog.amRoutine,
        pmRoutine: todayLog.pmRoutine,
        routineAmSteps: todayLog.routineAmSteps ?? null,
        routinePmSteps: todayLog.routinePmSteps ?? null,
        dietType: todayLog.dietType ?? null,
        sunExposure: todayLog.sunExposure ?? null,
        cycleDay: todayLog.cycleDay ?? null,
        comments: todayLog.comments ?? null,
      }
    : null;

  const kaiSkinScore =
    lastScans[0]?.overallScore ?? skinScanRows[0]?.skinScore ?? 0;

  let weeklyDeltaScore = 0;
  if (lastScans.length >= 2) {
    weeklyDeltaScore =
      lastScans[0].overallScore - lastScans[1].overallScore;
  }

  let amPmDays = 0;
  let sleepSum = 0;
  let waterSum = 0;
  let highSun = 0;
  const amLen = AM_ROUTINE_ITEMS.length;
  const pmLen = PM_ROUTINE_ITEMS.length;
  for (const l of recentLogs) {
    const am = (l.routineAmSteps ?? []).filter(Boolean).length >= amLen;
    const pm = (l.routinePmSteps ?? []).filter(Boolean).length >= pmLen;
    if (am && pm) amPmDays += 1;
    sleepSum += l.sleepHours ?? 0;
    waterSum += l.waterGlasses ?? 0;
    if (l.sunExposure === "high" || l.sunExposure === "moderate") {
      highSun += 1;
    }
  }
  const n = Math.max(1, recentLogs.length);
  const routineCompletion7d = amPmDays / 7;
  const avgSleep = sleepSum / n;
  const avgWater = waterSum / n;
  const lifestyleAlignmentScore = clampPct(
    routineCompletion7d * 42 +
      Math.min(28, (avgSleep / 8) * 28) +
      Math.min(30, (avgWater / 8) * 30) -
      (highSun >= 4 ? 14 : highSun >= 2 ? 6 : 0)
  );

  const todayFocus = focusRow
    ? { message: focusRow.message, sourceParam: focusRow.sourceParam }
    : {
        message:
          "Today: finish AM + PM routine steps and log water — consistency drives your kAI trend lines.",
        sourceParam: null as string | null,
      };

  const vn = voiceRow[0];
  const viewedAt = userRow?.doctorFeedbackViewedAt;
  const doctorVoiceNoteIsNew = Boolean(
    vn && (!viewedAt || vn.createdAt > viewedAt)
  );

  const doctorFeedback = visitRow[0]?.notes?.trim() ?? "";

  return NextResponse.json({
    skinScanHistory,
    todayLog: todayLogOut,
    amItems: [...AM_ROUTINE_ITEMS],
    pmItems: [...PM_ROUTINE_ITEMS],
    kaiSkinScore: clampPct(kaiSkinScore),
    weeklyDeltaScore: Math.round(weeklyDeltaScore),
    lifestyleAlignmentScore,
    /** @deprecated use lifestyleAlignmentScore */
    routineScore: lifestyleAlignmentScore,
    /** @deprecated use weeklyDeltaScore */
    weeklyChangePercent: Math.round(weeklyDeltaScore),
    doctorFeedback,
    todayFocus,
    streakCurrent: userRow?.streakCurrent ?? 0,
    streakLongest: userRow?.streakLongest ?? 0,
    cycleTrackingEnabled: userRow?.cycleTrackingEnabled ?? false,
    doctorVoiceNote: vn
      ? {
          id: vn.id,
          audioDataUri: vn.audioDataUri,
          createdAt: vn.createdAt.toISOString(),
        }
      : null,
    doctorVoiceNoteIsNew,
  });
}
