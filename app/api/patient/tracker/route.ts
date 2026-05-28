import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { scans } from "@/src/db/schema";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import { CacheKeys, cacheAside } from "@/src/lib/infra";
import { loadScanTrackerReport } from "@/src/lib/scanTrackerSnapshot";
import type { PatientTrackerReport } from "@/src/lib/patientTrackerReport.types";

function hasMissingTrackerSnapshotColumn(error: unknown): boolean {
  const err = error as { code?: string; message?: string };
  return (
    err?.code === "42703" ||
    (typeof err?.message === "string" &&
      err.message.toLowerCase().includes("tracker_snapshot"))
  );
}

export async function GET(request: Request) {
  const userId = await getSessionUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const scanIdRaw = searchParams.get("scanId");
  const scanId = scanIdRaw ? Number.parseInt(scanIdRaw, 10) : NaN;
  if (!Number.isFinite(scanId) || scanId < 1) {
    return NextResponse.json({ error: "INVALID_SCAN_ID" }, { status: 400 });
  }

  const report = await cacheAside(
    CacheKeys.tracker(userId, scanId),
    900,
    async () => {
      let stored: PatientTrackerReport | null | undefined;
      try {
        const row = await db.query.scans.findFirst({
          where: and(eq(scans.id, scanId), eq(scans.userId, userId)),
          columns: { id: true, trackerSnapshot: true },
        });
        if (!row) {
          throw new Error("NOT_FOUND");
        }
        stored = row.trackerSnapshot ?? null;
      } catch (e) {
        if (!hasMissingTrackerSnapshotColumn(e)) throw e;
        const row = await db.query.scans.findFirst({
          where: and(eq(scans.id, scanId), eq(scans.userId, userId)),
          columns: { id: true },
        });
        if (!row) {
          throw new Error("NOT_FOUND");
        }
        stored = null;
      }

      const value = await loadScanTrackerReport(userId, scanId, stored);
      if (!value) {
        throw new Error("NOT_FOUND");
      }
      return value;
    }
  ).catch((err: unknown) => {
    if (err instanceof Error && err.message === "NOT_FOUND") return null;
    throw err;
  });

  if (!report) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json(report);
}
