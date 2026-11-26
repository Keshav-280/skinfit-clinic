import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import { scanJobs } from "@/src/db/schema";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import { getJobStatus } from "@/src/lib/infra";
import { isJobUnderReview } from "@/src/lib/scanReview/review";
import { scanJobStaleMessage } from "@/src/lib/scanJobStale";

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ jobId: string }> }
) {
  const userId = await getSessionUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { jobId } = await ctx.params;
  const row = await db.query.scanJobs.findFirst({
    where: eq(scanJobs.id, jobId),
  });

  if (!row || row.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const cached = await getJobStatus(jobId);
  const staleError = scanJobStaleMessage(
    row.status,
    row.updatedAt,
    row.createdAt
  );
  if (staleError && (row.status === "pending" || row.status === "processing")) {
    return NextResponse.json({
      jobId,
      status: "failed",
      scanId: row.resultScanId ?? cached?.scanId,
      error: staleError,
      updatedAt: row.updatedAt?.toISOString(),
      stale: true,
    });
  }

  const scanId = row.resultScanId ?? cached?.scanId;
  const underReview =
    row.status === "completed" && !scanId && (await isJobUnderReview(jobId));

  return NextResponse.json({
    jobId,
    status: row.status,
    scanId,
    underReview,
    error: row.errorText ?? cached?.error,
    updatedAt: row.updatedAt?.toISOString(),
  });
}
