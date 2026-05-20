import { NextResponse } from "next/server";
import { and, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { subDays } from "date-fns";
import { db } from "@/src/db";
import { users } from "@/src/db/schema";
import { getDoctorPortalUserId } from "@/src/lib/auth/doctor-access";
import {
  loadAckedSosMessageIdsForStaff,
  loadLatestUrgentSosPerPatientSince,
} from "@/src/lib/doctorSosInbox";

export async function GET(req: Request) {
  try {
  const staffId = await getDoctorPortalUserId();
  if (!staffId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const concern = url.searchParams.get("concern")?.trim() ?? "";
  const sosOnly = url.searchParams.get("sos") === "1";
  const since = subDays(new Date(), 14);

  let restrictIds: string[] | null = null;
  if (sosOnly) {
    const latest = await loadLatestUrgentSosPerPatientSince(since);
    restrictIds = latest.map((r) => r.patientId);
    if (restrictIds.length === 0) {
      return NextResponse.json({ success: true, patients: [] });
    }
  }

  const conditions = [eq(users.role, "patient")];
  if (restrictIds) {
    conditions.push(inArray(users.id, restrictIds));
  }
  if (concern) {
    conditions.push(eq(users.primaryConcern, concern));
  }
  if (q.length > 0) {
    const pattern = `%${q}%`;
    conditions.push(or(ilike(users.name, pattern), ilike(users.email, pattern))!);
  }

  const [latestForFlag, ackedIds] = await Promise.all([
    loadLatestUrgentSosPerPatientSince(since),
    loadAckedSosMessageIdsForStaff(staffId),
  ]);
  const latestSosByPatient = new Map(
    latestForFlag.map((x) => [
      x.patientId,
      { createdAt: x.createdAt, messageId: x.messageId } as const,
    ])
  );

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      primaryConcern: users.primaryConcern,
      onboardingComplete: users.onboardingComplete,
      clinicVisitedAt: users.clinicVisitedAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(and(...conditions))
    .orderBy(desc(users.createdAt))
    .limit(200);

  return NextResponse.json({
    success: true,
    patients: rows.map((r) => {
      const latest = latestSosByPatient.get(r.id);
      const sosRowTint =
        latest == null
          ? null
          : ackedIds.has(latest.messageId)
            ? ("seen" as const)
            : ("urgent" as const);
      return {
        id: r.id,
        name: r.name,
        email: r.email,
        primaryConcern: r.primaryConcern,
        onboardingComplete: r.onboardingComplete,
        clinicVisited: r.clinicVisitedAt != null,
        createdAt: r.createdAt.toISOString(),
        sosRowTint,
        lastSosAt: latest?.createdAt.toISOString() ?? null,
      };
    }),
  });
  } catch (e) {
    console.error("[doctor/patients]", e);
    return NextResponse.json(
      { success: false, error: "Could not load patients." },
      { status: 500 }
    );
  }
}
