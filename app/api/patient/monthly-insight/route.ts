import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/src/db";
import { monthlyReports, users } from "@/src/db/schema";
import { userHasQuestionnaire } from "@/src/lib/onboardingAccess";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import { CacheKeys, cacheAside } from "@/src/lib/infra";
import {
  computePatientInsightSchedule,
  getPatientFirstScanAt,
} from "@/src/lib/patientInsightSchedule";
import type { MonthlyRagCronPayloadV1 } from "@/src/lib/ragCronMonthlyPayload";

function isRagPayloadV1(v: unknown): v is MonthlyRagCronPayloadV1 {
  if (!v || typeof v !== "object") return false;
  const x = v as Record<string, unknown>;
  return x.kind === "rag_monthly_v1" && !!x.monthly;
}

export async function GET(request: Request) {
  const userId = await getSessionUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const payload = await cacheAside(CacheKeys.monthlyInsight(userId), 900, async () => {
    const [userRow, firstScanAt] = await Promise.all([
      db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { primaryConcern: true },
      }),
      getPatientFirstScanAt(userId),
    ]);
    const questionnaireLocked = !userHasQuestionnaire(userRow?.primaryConcern);
    const schedule = computePatientInsightSchedule(firstScanAt);

    let row = null;
    if (schedule.dueMonthlyPeriodStart) {
      [row] = await db
        .select()
        .from(monthlyReports)
        .where(
          and(
            eq(monthlyReports.userId, userId),
            eq(monthlyReports.monthStart, schedule.dueMonthlyPeriodStart)
          )
        )
        .orderBy(desc(monthlyReports.createdAt))
        .limit(1);
    }

    if (!row) {
      const [latestRow] = await db
        .select()
        .from(monthlyReports)
        .where(eq(monthlyReports.userId, userId))
        .orderBy(desc(monthlyReports.monthStart), desc(monthlyReports.createdAt))
        .limit(1);
      row = latestRow ?? null;
    }

    const ragPayload = isRagPayloadV1(row?.payloadJson) ? row.payloadJson : null;
    const hasDueReport =
      schedule.dueMonthlyPeriodStart != null &&
      row != null &&
      row.monthStart.getTime() === schedule.dueMonthlyPeriodStart.getTime() &&
      ragPayload != null;

    const locked = questionnaireLocked || schedule.monthlyLocked || !hasDueReport;
    const nextInsightAt =
      schedule.nextMonthlyInsightAt ??
      schedule.dueMonthlyPeriodStart?.toISOString() ??
      null;

    return {
      questionnaireLocked,
      locked,
      nextInsightAt,
      firstScanYmd: schedule.firstScanYmd,
      latestMonthStart: row ? row.monthStart.toISOString().slice(0, 10) : null,
      monthly: hasDueReport ? ragPayload?.monthly ?? null : null,
    };
  });

  return NextResponse.json(payload);
}
