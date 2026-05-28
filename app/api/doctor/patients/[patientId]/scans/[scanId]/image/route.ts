import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { scans } from "@/src/db/schema";
import { getDoctorPortalUserId } from "@/src/lib/auth/doctor-access";
import { scanImageNextResponse } from "@/src/lib/scanImageHttpResponse";

function hasMissingColumn(error: unknown, column: string): boolean {
  const err = error as { code?: string; message?: string };
  if (err?.code === "42703") return true;
  return (
    typeof err?.message === "string" &&
    err.message.toLowerCase().includes(column.toLowerCase())
  );
}

async function loadScanImageRow(
  patientId: string,
  scanId: number
) {
  const scope = and(eq(scans.id, scanId), eq(scans.userId, patientId));
  try {
    return await db.query.scans.findFirst({
      where: scope,
      columns: { imageUrl: true, faceCaptureImages: true },
    });
  } catch (e) {
    if (!hasMissingColumn(e, "face_capture_images")) throw e;
    return await db.query.scans.findFirst({
      where: scope,
      columns: { imageUrl: true },
    });
  }
}

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

  const row = await loadScanImageRow(patientId, scanId);

  if (!row) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const faceCaptureImages =
    "faceCaptureImages" in row
      ? (row.faceCaptureImages as
          | Array<{ label: string; dataUri: string; previewDataUri?: string }>
          | null
          | undefined)
      : undefined;

  return scanImageNextResponse({
    imageUrl: row.imageUrl,
    faceCaptureImages: faceCaptureImages ?? undefined,
    index,
    preview,
    thumbnail,
  });
}
