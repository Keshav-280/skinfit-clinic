import React from "react";
import { redirect } from "next/navigation";
import { db } from "../../src/db";
import { skinScans, dailyLogs, users } from "../../src/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { DashboardView } from "../../components/dashboard/DashboardView";
import { getSessionUserId } from "../../src/lib/auth/get-session";
import { AM_ROUTINE_ITEMS, PM_ROUTINE_ITEMS } from "../../src/lib/routine";
import { dateOnlyFromYmd, localCalendarYmd } from "../../src/lib/date-only";

export default async function DashboardPage() {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/login");
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) {
    redirect("/login");
  }

  const skinScanRows = await db.query.skinScans.findMany({
    where: eq(skinScans.userId, user.id),
    orderBy: [desc(skinScans.createdAt)],
    columns: {
      id: true,
      skinScore: true,
      createdAt: true,
      analysisResults: true,
    },
  });

  const skinScanHistory = skinScanRows.map((r) => ({
    id: r.id,
    skinScore: r.skinScore,
    createdAt: r.createdAt.toISOString(),
    analysisResults: r.analysisResults,
  }));

  const todayDateOnly = dateOnlyFromYmd(localCalendarYmd());
  const todayLog = await db.query.dailyLogs.findFirst({
    where: and(
      eq(dailyLogs.userId, user.id),
      eq(dailyLogs.date, todayDateOnly)
    ),
  });

  const amItems = [...AM_ROUTINE_ITEMS];
  const pmItems = [...PM_ROUTINE_ITEMS];

  const routineScore = 80;
  const weeklyChangePercent = 5;

  return (
    <DashboardView
      skinScanHistory={skinScanHistory}
      todayLog={todayLog ?? null}
      amItems={amItems}
      pmItems={pmItems}
      routineScore={routineScore}
      weeklyChangePercent={weeklyChangePercent}
      doctorFeedback=""
    />
  );
}
