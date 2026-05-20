import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { subDays } from "date-fns";
import { db } from "@/src/db";
import { doctorSosAcknowledgements } from "@/src/db/schema";
import { getDoctorPortalUserId } from "@/src/lib/auth/doctor-access";
import { resolveStaffUserIdInDb } from "@/src/lib/auth/ensureFallbackDoctor";
import {
  DOCTOR_SOS_WINDOW_DAYS,
  isMissingDoctorSosAckTable,
  postgresErrorCode,
  resolveSosAckMessageId,
} from "@/src/lib/doctorSosInbox";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const staffId = await getDoctorPortalUserId();
  if (!staffId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const chatMessageId =
    body &&
    typeof body === "object" &&
    typeof (body as { chatMessageId?: unknown }).chatMessageId === "string"
      ? (body as { chatMessageId: string }).chatMessageId.trim()
      : "";
  const patientId =
    body &&
    typeof body === "object" &&
    typeof (body as { patientId?: unknown }).patientId === "string"
      ? (body as { patientId: string }).patientId.trim()
      : "";

  if (!chatMessageId && !patientId) {
    return NextResponse.json(
      { error: "CHAT_MESSAGE_OR_PATIENT_ID_REQUIRED" },
      { status: 400 }
    );
  }

  const since = subDays(new Date(), DOCTOR_SOS_WINDOW_DAYS);
  const target = await resolveSosAckMessageId(since, {
    chatMessageId: chatMessageId || undefined,
    patientId: patientId || undefined,
  });

  if (!target) {
    return NextResponse.json({ error: "ALERT_NOT_FOUND" }, { status: 404 });
  }

  const persistedStaffId = await resolveStaffUserIdInDb(staffId);
  if (!persistedStaffId) {
    return NextResponse.json(
      {
        error: "STAFF_USER_NOT_IN_DB",
        message:
          "Could not link your doctor session to the database. Sign out, run db:seed, and sign in with iamdalves@gmail.com or ajaydey1946@gmail.com.",
      },
      { status: 403 }
    );
  }

  try {
    await db.insert(doctorSosAcknowledgements).values({
      staffUserId: persistedStaffId,
      chatMessageId: target.chatMessageId,
    });
  } catch (e) {
    if (postgresErrorCode(e) === "23505") {
      return NextResponse.json(
        {
          success: true,
          alreadyAcknowledged: true,
          patientId: target.patientId,
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }
    if (isMissingDoctorSosAckTable(e)) {
      console.error(
        "[doctor/sos-summary/ack] doctor_sos_acknowledgements missing — run drizzle/0015_doctor_sos_acknowledgements.sql"
      );
      return NextResponse.json(
        { error: "ACK_TABLE_MISSING" },
        { status: 503 }
      );
    }
    console.error("[doctor/sos-summary/ack]", e);
    return NextResponse.json({ error: "ACK_FAILED" }, { status: 500 });
  }

  return NextResponse.json(
    { success: true, patientId: target.patientId },
    { headers: { "Cache-Control": "no-store" } }
  );
}
