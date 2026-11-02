import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import { createAppointmentRequest } from "@/src/lib/appointmentRequests";
import { ensurePatientPhoneForBooking } from "@/src/lib/ensurePatientPhoneForBooking";
import { users } from "@/src/db/schema";

export async function POST(req: Request) {
  const sessionUserId = await getSessionUserIdFromRequest(req);
  if (!sessionUserId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const doctorId = typeof b.doctorId === "string" ? b.doctorId : null;
  const doctorSlotId = typeof b.doctorSlotId === "string" ? b.doctorSlotId : null;
  const issue = typeof b.issue === "string" ? b.issue.trim() : "";
  const why = typeof b.why === "string" ? b.why.trim() : null;

  const [patientRow] = await db
    .select({
      phone: users.phone,
      phoneCountryCode: users.phoneCountryCode,
    })
    .from(users)
    .where(eq(users.id, sessionUserId))
    .limit(1);

  const phoneResult = await ensurePatientPhoneForBooking({
    userId: sessionUserId,
    existingPhone: patientRow?.phone,
    existingCountryCode: patientRow?.phoneCountryCode,
    bodyPhone: b.phone,
    bodyPhoneCountryCode: b.phoneCountryCode,
  });
  if (!phoneResult.ok) {
    return NextResponse.json(
      { error: phoneResult.error, message: phoneResult.message },
      { status: 400 }
    );
  }

  if (!doctorId || !doctorSlotId || !issue) {
    return NextResponse.json(
      { error: "doctorId_doctorSlotId_issue_required" },
      { status: 400 }
    );
  }

  const result = await createAppointmentRequest({
    patientId: sessionUserId,
    doctorId,
    doctorSlotId,
    issue,
    why,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.body, { status: result.status });
}
