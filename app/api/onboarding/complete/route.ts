import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { scans, skinDnaCards, users } from "@/src/db/schema";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";

export async function POST(req: Request) {
  const userId = await getSessionUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  let body: { baselineScanId?: number };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const baselineScanId =
    typeof body.baselineScanId === "number" && Number.isFinite(body.baselineScanId)
      ? body.baselineScanId
      : null;

  if (baselineScanId != null) {
    const [owned] = await db
      .select({ id: scans.id })
      .from(scans)
      .where(and(eq(scans.id, baselineScanId), eq(scans.userId, userId)))
      .limit(1);
    if (!owned) {
      return NextResponse.json(
        { error: "SCAN_NOT_FOUND" },
        { status: 404 }
      );
    }
  }

  const [u] = await db
    .select({
      skinType: users.skinType,
      skinSensitivity: users.skinSensitivity,
      baselineSunExposure: users.baselineSunExposure,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  await db
    .update(users)
    .set({
      onboardingComplete: true,
      onboardingCompletedAt: new Date(),
    })
    .where(eq(users.id, userId));

  if (u) {
    const [dna] = await db
      .select()
      .from(skinDnaCards)
      .where(eq(skinDnaCards.userId, userId))
      .limit(1);
    const uvHigh =
      u.baselineSunExposure === "high" || u.baselineSunExposure === "moderate";
    const sensIdx =
      u.skinSensitivity === "high" ? 8 : u.skinSensitivity === "moderate" ? 5 : 3;
    if (dna) {
      await db
        .update(skinDnaCards)
        .set({
          skinType: u.skinType ?? dna.skinType,
          sensitivityIndex: sensIdx,
          uvSensitivity: uvHigh ? "High" : "Moderate",
          updatedAt: new Date(),
          revision: dna.revision + 1,
        })
        .where(eq(skinDnaCards.userId, userId));
    }
  }

  return NextResponse.json({ ok: true });
}
