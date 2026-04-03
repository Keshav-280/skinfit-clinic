import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { scans, users, visitNotes } from "@/src/db/schema";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import { displayUserPhone } from "@/src/lib/auth/phone";
import { ymdFromDateOnly } from "@/src/lib/date-only";
import { patientScanImagePath } from "@/src/lib/patientScanImagePath";

export async function GET(request: Request) {
  const userId = await getSessionUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      id: true,
      name: true,
      email: true,
      phoneCountryCode: true,
      phone: true,
      age: true,
      skinType: true,
      primaryGoal: true,
    },
  });
  if (!user) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const patient = {
    name: user.name,
    email: user.email,
    phone: displayUserPhone(user.phoneCountryCode, user.phone),
    age: user.age,
    skinType: user.skinType,
    primaryGoal: user.primaryGoal,
  };

  const [scansList, visitsList] = await Promise.all([
    db.query.scans.findMany({
      where: eq(scans.userId, user.id),
      columns: {
        id: true,
        scanName: true,
        overallScore: true,
        acne: true,
        pigmentation: true,
        wrinkles: true,
        hydration: true,
        texture: true,
        createdAt: true,
        aiSummary: true,
      },
      orderBy: [desc(scans.createdAt)],
    }),
    db.query.visitNotes.findMany({
      where: eq(visitNotes.userId, user.id),
      columns: {
        id: true,
        visitDate: true,
        doctorName: true,
        notes: true,
      },
      orderBy: [desc(visitNotes.visitDate)],
    }),
  ]);

  const scanRecords = scansList.map((s) => {
    const eczema = Math.min(
      100,
      Math.max(0, Math.round((s.hydration + s.acne + s.texture) / 3))
    );
    return {
      id: s.id,
      scanName: s.scanName,
      imageUrl: patientScanImagePath(s.id),
      overallScore: s.overallScore,
      acne: s.acne,
      pigmentation: s.pigmentation,
      wrinkles: s.wrinkles,
      hydration: s.hydration,
      texture: s.texture,
      eczema,
      createdAt: s.createdAt.toISOString(),
      aiSummary: s.aiSummary ?? null,
    };
  });

  const visitRecords = visitsList.map((v) => ({
    id: v.id,
    visitDateYmd: ymdFromDateOnly(v.visitDate),
    doctorName: v.doctorName,
    notes: v.notes,
  }));

  return NextResponse.json({ patient, scans: scanRecords, visitNotes: visitRecords });
}
