import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { scans } from "@/src/db/schema";
import { getDoctorPortalUserId } from "@/src/lib/auth/doctor-access";
import { scanImageNextResponse } from "@/src/lib/scanImageHttpResponse";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ patientId: string; scanId: string }> }
) {
  const staffId = await getDoctorPortalUserId();
  if (!staffId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { patientId, scanId: scanIdParam } = await ctx.params;
  const scanId = Number.parseInt(scanIdParam, 10);
  if (!patientId || !Number.isFinite(scanId) || scanId < 1) {
    return NextResponse.json({ error: "INVALID" }, { status: 400 });
  }

  const urlObj = new URL(req.url);
  const iRaw = urlObj.searchParams.get("i");
  const index =
    iRaw === null || iRaw === "" ? 0 : Number.parseInt(iRaw, 10);
  if (!Number.isFinite(index) || index < 0) {
    return NextResponse.json({ error: "INVALID_INDEX" }, { status: 400 });
  }

  const preview =
    urlObj.searchParams.get("preview") === "1" ||
    urlObj.searchParams.get("preview") === "true";
  const thumbnail =
    preview &&
    (urlObj.searchParams.get("thumb") === "1" ||
      urlObj.searchParams.get("thumb") === "true");

  const row = await db.query.scans.findFirst({
    where: and(eq(scans.id, scanId), eq(scans.userId, patientId)),
    columns: { imageUrl: true, faceCaptureImages: true },
  });

  if (!row) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  return scanImageNextResponse({
    imageUrl: row.imageUrl,
    faceCaptureImages: row.faceCaptureImages ?? undefined,
    index,
    preview,
    thumbnail,
  });
}
