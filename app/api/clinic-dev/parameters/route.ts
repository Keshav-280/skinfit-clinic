import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { parameterScores, scans } from "@/src/db/schema";
import { KAI_PARAM_KEYS, type KaiParamKey } from "@/src/lib/kaiParameters";

type Action = "list" | "save";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    action?: string;
    scanId?: number;
    rows?: Array<{ paramKey: string; value: number }>;
  } | null;
  if (!body?.action) {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }
  const action = body.action as Action;
  const scanId =
    typeof body.scanId === "number" && body.scanId >= 1 ? body.scanId : NaN;
  if (!Number.isFinite(scanId)) {
    return NextResponse.json({ error: "INVALID_SCAN_ID" }, { status: 400 });
  }

  const [scan] = await db
    .select({ id: scans.id, userId: scans.userId })
    .from(scans)
    .where(eq(scans.id, scanId))
    .limit(1);
  if (!scan) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  if (action === "list") {
    const rows = await db
      .select()
      .from(parameterScores)
      .where(eq(parameterScores.scanId, scanId));
    return NextResponse.json({ ok: true, rows });
  }

  if (action === "save") {
    if (!Array.isArray(body.rows)) {
      return NextResponse.json({ error: "ROWS_REQUIRED" }, { status: 400 });
    }
    for (const r of body.rows) {
      if (!r || typeof r.paramKey !== "string") continue;
      const key = r.paramKey as KaiParamKey;
      if (!KAI_PARAM_KEYS.includes(key)) continue;
      if (typeof r.value !== "number" || !Number.isFinite(r.value)) continue;
      const v = Math.min(100, Math.max(0, Math.round(r.value)));
      const [existing] = await db
        .select()
        .from(parameterScores)
        .where(
          and(
            eq(parameterScores.scanId, scanId),
            eq(parameterScores.paramKey, key)
          )
        )
        .limit(1);
      if (!existing) continue;
      if (existing.source === "ai") continue;
      await db
        .update(parameterScores)
        .set({ value: v, source: "doctor" })
        .where(eq(parameterScores.id, existing.id));
    }
    const rows = await db
      .select()
      .from(parameterScores)
      .where(eq(parameterScores.scanId, scanId));
    return NextResponse.json({ ok: true, rows });
  }

  return NextResponse.json({ error: "INVALID_action" }, { status: 400 });
}
