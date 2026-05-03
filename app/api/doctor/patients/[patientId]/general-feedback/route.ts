import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/src/db";
import { users } from "@/src/db/schema";
import { getDoctorPortalUserId } from "@/src/lib/auth/doctor-access";
import { sendClinicSupportMessage } from "@/src/lib/clinicSupportChat";

const MAX_LEN = 6000;

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
  const raw =
    typeof body === "object" &&
    body &&
    typeof (body as { text?: unknown }).text === "string"
      ? (body as { text: string }).text
      : "";
  const text = raw.trim();
  if (text.length > MAX_LEN) {
    return NextResponse.json({ error: "TEXT_TOO_LONG", max: MAX_LEN }, { status: 400 });
  }

  const now = new Date();
  await db
    .update(users)
    .set({
      doctorFeedbackNote: text.length ? text : null,
      doctorFeedbackUpdatedAt: text.length ? now : null,
      doctorFeedbackViewedAt: null,
    })
    .where(eq(users.id, patientId));

  if (text.length) {
    const preview = text.replace(/\s+/g, " ").slice(0, 220);
    void sendClinicSupportMessage({
      patientId,
      text: `Your doctor updated your general feedback note.\n\n${preview}${text.length > preview.length ? "…" : ""}`,
    }).catch((err) =>
      console.warn("[doctorGeneralFeedback] failed to send chat notification", err)
    );
  }

  return NextResponse.json({
    ok: true,
    feedback: text.length ? text : null,
    updatedAt: text.length ? now.toISOString() : null,
  });
}
