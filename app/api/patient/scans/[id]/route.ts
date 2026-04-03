import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { scans, users } from "@/src/db/schema";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import { parseScanRegions } from "@/src/lib/parseScanAnnotations";
import { patientScanImagePath } from "@/src/lib/patientScanImagePath";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getSessionUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { id: idParam } = await params;
  const id = Number.parseInt(idParam, 10);
  if (!Number.isFinite(id) || id < 1) {
    return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
  }

  const [user, row] = await Promise.all([
    db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { name: true, email: true, age: true, skinType: true },
    }),
    db.query.scans.findFirst({
      where: and(eq(scans.id, id), eq(scans.userId, userId)),
      columns: {
        id: true,
        scanName: true,
        overallScore: true,
        acne: true,
        wrinkles: true,
        hydration: true,
        pigmentation: true,
        texture: true,
        aiSummary: true,
        annotations: true,
        createdAt: true,
      },
    }),
  ]);

  if (!user || !row) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const regions = parseScanRegions(row.annotations);

  return NextResponse.json({
    scanId: row.id,
    userName: user.name?.trim() || "there",
    userEmail: user.email?.trim() ?? null,
    userAge: user.age ?? 18,
    userSkinType: user.skinType?.trim() || "—",
    scanTitle: row.scanName,
    imageUrl: patientScanImagePath(row.id),
    regions,
    metrics: {
      acne: row.acne,
      hydration: row.hydration,
      wrinkles: row.wrinkles,
      overall_score: row.overallScore,
      pigmentation: row.pigmentation,
      texture: row.texture,
    },
    aiSummary: row.aiSummary,
    scanDateIso: row.createdAt.toISOString(),
  });
}
