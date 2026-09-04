import { NextResponse } from "next/server";
import { getDoctorPortalUserId } from "@/src/lib/auth/doctor-access";
import {
  createPatientTreatment,
  listPatientTreatments,
  patientExists,
} from "@/src/lib/patientTreatmentStore";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ patientId: string }> }
) {
  const staffId = await getDoctorPortalUserId();
  if (!staffId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { patientId } = await ctx.params;
  if (!patientId || !(await patientExists(patientId))) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  try {
    const items = await listPatientTreatments(patientId);
    return NextResponse.json({ ok: true, items });
  } catch (e) {
    console.error("[doctor/patients/treatments GET]", e);
    return NextResponse.json({ error: "LOAD_FAILED" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ patientId: string }> }
) {
  const staffId = await getDoctorPortalUserId();
  if (!staffId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { patientId } = await ctx.params;
  if (!patientId || !(await patientExists(patientId))) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  const b = body as {
    title?: unknown;
    treatedOnYmd?: unknown;
    notes?: unknown;
    affectedParams?: unknown;
  };

  const result = await createPatientTreatment({
    patientId,
    doctorId: staffId,
    title: typeof b.title === "string" ? b.title : "",
    treatedOnYmd: typeof b.treatedOnYmd === "string" ? b.treatedOnYmd : null,
    notes: typeof b.notes === "string" ? b.notes : null,
    affectedParams: b.affectedParams,
  });

  if (!result.ok) {
    const status = result.error === "INSERT_FAILED" ? 500 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ ok: true, treatment: result.treatment });
}
