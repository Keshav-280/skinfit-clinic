import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { users } from "@/src/db/schema";
import { getDoctorPortalUserId } from "@/src/lib/auth/doctor-access";
import {
  loadDoctorPatientDetailSections,
  loadDoctorPatientRecord,
  parseDoctorPatientDetailSections,
} from "@/src/lib/doctorPatientDetailApi";

export async function GET(
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

  const patient = await loadDoctorPatientRecord(patientId);
  if (!patient) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const url = new URL(req.url);
  const sections = parseDoctorPatientDetailSections(url.searchParams.get("section"));

  try {
    const payload = await loadDoctorPatientDetailSections(
      patientId,
      patient,
      sections
    );
    return NextResponse.json(payload);
  } catch (e) {
    console.error("[doctor/patients GET]", patientId, sections, e);
    return NextResponse.json(
      { success: false, error: "LOAD_FAILED" },
      { status: 500 }
    );
  }
}

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

  let body: { clinicVisited?: boolean };
  try {
    body = (await req.json()) as { clinicVisited?: boolean };
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  if (typeof body.clinicVisited === "boolean") {
    await db
      .update(users)
      .set({ clinicVisitedAt: body.clinicVisited ? new Date() : null })
      .where(and(eq(users.id, patientId), eq(users.role, "patient")));
  }

  return NextResponse.json({ ok: true });
}
