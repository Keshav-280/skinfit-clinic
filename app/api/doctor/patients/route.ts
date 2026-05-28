import { NextResponse } from "next/server";
import { and, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { subDays } from "date-fns";
import { db } from "@/src/db";
import { users } from "@/src/db/schema";
import { getDoctorPortalUserId } from "@/src/lib/auth/doctor-access";
import {
  DOCTOR_SOS_WINDOW_DAYS,
  filterUnackedSosRows,
  loadAckedSosMessageIdsForStaff,
  loadLatestUrgentSosPerPatientSince,
} from "@/src/lib/doctorSosInbox";
import { patientHasOnboardingClinicalAlert } from "@/src/lib/patientOnboardingClinicalAlert";

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
  const since = subDays(new Date(), DOCTOR_SOS_WINDOW_DAYS);

  const [latestForFlag, ackedIds] = await Promise.all([
    loadLatestUrgentSosPerPatientSince(since),
    loadAckedSosMessageIdsForStaff(staffId),
  ]);
  const unackedSos = filterUnackedSosRows(latestForFlag, ackedIds);

  const conditions = [eq(users.role, "patient")];
  if (sosOnly) {
    const sosFilter = or(
      ...(unackedSos.length > 0
        ? [inArray(users.id, unackedSos.map((r) => r.patientId))]
        : []),
      eq(users.concernDuration, "chronic"),
      eq(users.skinSensitivity, "high")
    );
    if (sosFilter) conditions.push(sosFilter);
  }
  if (concern) {
    conditions.push(eq(users.primaryConcern, concern));
  }
  if (q.length > 0) {
    const pattern = `%${q}%`;
    conditions.push(or(ilike(users.name, pattern), ilike(users.email, pattern))!);
  }

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
      concernDuration: users.concernDuration,
      skinSensitivity: users.skinSensitivity,
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
      const chatSosTint =
        latest == null
          ? null
          : ackedIds.has(latest.messageId)
            ? ("seen" as const)
            : ("urgent" as const);
      const onboardingClinicalAlert = patientHasOnboardingClinicalAlert(r);
      const sosRowTint =
        chatSosTint === "urgent" || onboardingClinicalAlert
          ? ("urgent" as const)
          : chatSosTint;
      return {
        id: r.id,
        name: r.name,
        email: r.email,
        primaryConcern: r.primaryConcern,
        onboardingComplete: r.onboardingComplete,
        clinicVisited: r.clinicVisitedAt != null,
        createdAt: r.createdAt.toISOString(),
        sosRowTint,
        onboardingClinicalAlert,
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
