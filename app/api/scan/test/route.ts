import { NextResponse } from "next/server";
import { and, eq, ilike, or } from "drizzle-orm";
import { db } from "@/src/db";
import { scans } from "@/src/db/schema";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";

const TEST_SCAN_NAME = "AI skin analysis";

export async function DELETE(req: Request) {
  const userId = await getSessionUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  // Delete only the known test/demo scans from the current user's history.
  const deleted = await db
    .delete(scans)
    .where(
      and(
        eq(scans.userId, userId),
        or(
          eq(scans.scanName, TEST_SCAN_NAME),
          // Matches titles like "AI skin scan – test_scan3"
          ilike(scans.scanName, "AI skin scan%test%")
        )
      )
    )
    .returning({ id: scans.id });

  return NextResponse.json({
    ok: true,
    deletedCount: deleted.length,
  });
}

