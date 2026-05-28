import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import { scanJobs } from "@/src/db/schema";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import { getJobStatus } from "@/src/lib/infra";

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
  return NextResponse.json({
    jobId,
    status: row.status,
    scanId: row.resultScanId ?? cached?.scanId,
    error: row.errorText ?? cached?.error,
    updatedAt: row.updatedAt?.toISOString(),
  });
}
