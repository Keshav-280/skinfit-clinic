import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/src/db";
import { monthlyReports } from "@/src/db/schema";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import { dateOnlyFromYmd, localCalendarYmd } from "@/src/lib/date-only";
import type { MonthlyRagCronPayloadV1 } from "@/src/lib/ragCronMonthlyPayload";

function nextMonthlyCronAtUtcIso(now = new Date()) {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  let next = new Date(Date.UTC(y, m, 1, 5, 30, 0, 0));
  if (now.getTime() >= next.getTime()) {
    next = new Date(Date.UTC(y, m + 1, 1, 5, 30, 0, 0));
  }
  return next.toISOString();
}

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

  const monthStartStr = `${localCalendarYmd().slice(0, 7)}-01`;
  const monthStart = dateOnlyFromYmd(monthStartStr);

  const [currentMonthRow] = await db
    .select()
    .from(monthlyReports)
    .where(
      and(eq(monthlyReports.userId, userId), eq(monthlyReports.monthStart, monthStart))
    )
    .orderBy(desc(monthlyReports.createdAt))
    .limit(1);

  const [latestRow] = await db
    .select()
    .from(monthlyReports)
    .where(eq(monthlyReports.userId, userId))
    .orderBy(desc(monthlyReports.monthStart), desc(monthlyReports.createdAt))
    .limit(1);

  const row = currentMonthRow ?? latestRow ?? null;
  const ragPayload = isRagPayloadV1(row?.payloadJson) ? row.payloadJson : null;

  const nextInsightAtIso = nextMonthlyCronAtUtcIso();
  const locked = !ragPayload;

  return NextResponse.json({
    locked,
    nextInsightAt: nextInsightAtIso,
    latestMonthStart: row ? row.monthStart.toISOString().slice(0, 10) : null,
    monthly: ragPayload?.monthly ?? null,
  });
}

