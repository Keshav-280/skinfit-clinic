import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/src/db";
import { users } from "@/src/db/schema";
import { getDoctorPortalUserId } from "@/src/lib/auth/doctor-access";
import {
  formatClinicTreatmentCareMessage,
  normalizeClinicTreatment,
  resolveClinicTreatment,
  type ClinicTreatmentPhase,
} from "@/src/lib/clinicTreatmentGuides";
import { sendDoctorPatientChatMessage } from "@/src/lib/clinicSupportChat";

const MAX_MESSAGE_LEN = 6000;

function parsePhase(v: unknown): ClinicTreatmentPhase | null {
  return v === "pre" || v === "post" ? v : null;
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
  if (!patientId) {
    return NextResponse.json({ error: "INVALID" }, { status: 400 });
  }

  const patient = await db.query.users.findFirst({
    where: and(eq(users.id, patientId), eq(users.role, "patient")),
    columns: { id: true },
  });
  if (!patient) {
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

  const payload = body as {
    treatmentId?: unknown;
    phase?: unknown;
    treatment?: unknown;
  };

  const treatmentId =
    typeof payload.treatmentId === "string" ? payload.treatmentId.trim() : "";
  const phase = parsePhase(payload.phase);
  if (!treatmentId || !phase) {
    return NextResponse.json({ error: "INVALID" }, { status: 400 });
  }

  const customTreatment = normalizeClinicTreatment(payload.treatment);
  const treatment = resolveClinicTreatment(treatmentId, customTreatment);
  if (!treatment) {
    return NextResponse.json({ error: "TREATMENT_NOT_FOUND" }, { status: 404 });
  }

  const text = formatClinicTreatmentCareMessage(treatment, phase);
  if (!text.length || text.length > MAX_MESSAGE_LEN) {
    return NextResponse.json({ error: "MESSAGE_TOO_LONG", max: MAX_MESSAGE_LEN }, { status: 400 });
  }

  const pushTitle =
    phase === "pre"
      ? `SkinFit - ${treatment.name} pre-care`
      : `SkinFit - ${treatment.name} post-care`;

  await sendDoctorPatientChatMessage({
    patientId,
    staffId,
    text,
    pushTitle,
  });

  return NextResponse.json({ ok: true });
}
