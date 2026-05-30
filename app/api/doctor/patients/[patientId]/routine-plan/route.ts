import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/src/db";
import { users } from "@/src/db/schema";
import { getDoctorPortalUserId } from "@/src/lib/auth/doctor-access";
import { invalidateUserHomeCache } from "@/src/lib/infra";
import { parseDoctorRoutinePlanPatch } from "@/src/lib/routine";
import {
  notifyPatientRoutinePlanChanged,
  patientHadRoutinePlan,
} from "@/src/lib/routinePlanNotify";
import {
  ensureInitialRoutineRevision,
  insertRoutinePlanRevision,
  parseEffectiveFromYmd,
} from "@/src/lib/routinePlanRevisions";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ patientId: string }> }
) {
  const staffId = await getDoctorPortalUserId();
  if (!staffId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { patientId } = await ctx.params;
  if (!patientId) {
    return NextResponse.json({ error: "INVALID" }, { status: 400 });
  }

  const patient = await db.query.users.findFirst({
    where: and(eq(users.id, patientId), eq(users.role, "patient")),
    columns: { id: true, onboardingComplete: true },
  });

  if (!patient) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  if (!patient.onboardingComplete) {
    return NextResponse.json(
      {
        error: "PATIENT_STILL_ONBOARDING",
        message: "Finish onboarding before assigning a routine plan.",
      },
      { status: 400 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const parsed = parseDoctorRoutinePlanPatch(body);
  if (parsed.kind === "error") {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const effectiveParsed = parseEffectiveFromYmd(parsed.effectiveFromYmd);
  if (!effectiveParsed.ok) {
    return NextResponse.json({ error: effectiveParsed.error }, { status: 400 });
  }

  await ensureInitialRoutineRevision(db, patientId);
  const priorHadPlan = await patientHadRoutinePlan(patientId);

  if (parsed.kind === "clear") {
    await insertRoutinePlanRevision(db, {
      userId: patientId,
      effectiveFrom: effectiveParsed.date,
      amItems: [],
      pmItems: [],
      createdByStaffId: staffId,
    });
    await invalidateUserHomeCache(patientId);
    void notifyPatientRoutinePlanChanged({
      patientId,
      staffId,
      effectiveFromYmd: effectiveParsed.ymd,
      kind: "clear",
      priorHadPlan,
      amCount: 0,
      pmCount: 0,
    });
    return NextResponse.json({
      ok: true,
      cleared: true,
      effectiveFromYmd: effectiveParsed.ymd,
    });
  }

  await insertRoutinePlanRevision(db, {
    userId: patientId,
    effectiveFrom: effectiveParsed.date,
    amItems: parsed.am,
    pmItems: parsed.pm,
    createdByStaffId: staffId,
  });
  await invalidateUserHomeCache(patientId);
  void notifyPatientRoutinePlanChanged({
    patientId,
    staffId,
    effectiveFromYmd: effectiveParsed.ymd,
    kind: "set",
    priorHadPlan,
    amCount: parsed.am.length,
    pmCount: parsed.pm.length,
  });

  return NextResponse.json({
    ok: true,
    effectiveFromYmd: effectiveParsed.ymd,
  });
}
