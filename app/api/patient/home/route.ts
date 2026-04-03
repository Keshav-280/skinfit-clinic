import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { dailyLogs, skinScans } from "@/src/db/schema";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import { dateOnlyFromYmd, localCalendarYmd } from "@/src/lib/date-only";
import { AM_ROUTINE_ITEMS, PM_ROUTINE_ITEMS } from "@/src/lib/routine";

export async function GET(request: Request) {
  const userId = await getSessionUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const todayDateOnly = dateOnlyFromYmd(localCalendarYmd());
  const [skinScanRows, todayLog] = await Promise.all([
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
      }
    : null;

  return NextResponse.json({
    skinScanHistory,
    todayLog: todayLogOut,
    amItems: [...AM_ROUTINE_ITEMS],
    pmItems: [...PM_ROUTINE_ITEMS],
    routineScore: 80,
    weeklyChangePercent: 5,
    doctorFeedback: "",
  });
}
