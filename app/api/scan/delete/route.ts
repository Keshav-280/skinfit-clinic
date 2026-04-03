import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { scans } from "@/src/db/schema";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";

export async function DELETE(req: Request) {
  const userId = await getSessionUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  const scanId =
    typeof (body as { scanId?: unknown }).scanId === "number"
      ? (body as { scanId: number }).scanId
      : Number.parseInt(
          String((body as { scanId?: unknown }).scanId ?? ""),
          10
        );

  if (!Number.isFinite(scanId) || scanId < 1) {
    return NextResponse.json({ error: "INVALID_SCAN_ID" }, { status: 400 });
  }

  const deleted = await db
    .delete(scans)
    .where(and(eq(scans.userId, userId), eq(scans.id, scanId)))
    .returning({ id: scans.id });

  return NextResponse.json({
    ok: true,
    deletedCount: deleted.length,
  });
}

