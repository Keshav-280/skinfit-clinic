import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { users } from "@/src/db/schema";
import { getDoctorPortalUserId } from "@/src/lib/auth/doctor-access";
import { sendDoctorRoutineNudge } from "@/src/lib/doctorRoutineNudge";
import type { RoutineKind } from "@/src/lib/routineReminder";

export async function POST(
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

  const row = await db.query.users.findFirst({
    where: and(eq(users.id, patientId), eq(users.role, "patient")),
    columns: { id: true },
  });
  if (!row) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const body = (await req.json().catch(() => null)) as { kind?: string } | null;
  const kind: RoutineKind = body?.kind === "pm" ? "pm" : "am";

  const out = await sendDoctorRoutineNudge(patientId, staffId, kind);
  if (!out.ok) {
    const code = out.error;
    if (code === "NOT_FOUND") {
      return NextResponse.json({ error: code }, { status: 404 });
    }
    if (code === "PATIENT_NOT_ONBOARDED") {
      return NextResponse.json(
        { error: code, message: "Patient has not finished onboarding." },
        { status: 400 }
      );
    }
    if (code === "ROUTINE_PLAN_NOT_SET") {
      return NextResponse.json(
        {
          error: code,
          message: "Save the patient AM/PM checklist first.",
        },
        { status: 400 }
      );
    }
    if (code === "ROUTINE_ALREADY_DONE") {
      return NextResponse.json(
        { error: code, message: "All steps for that routine are already checked today." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: code }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
