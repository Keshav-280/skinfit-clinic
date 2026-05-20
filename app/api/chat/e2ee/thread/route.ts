import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/src/db";
import { appointments, chatThreads, users } from "@/src/db/schema";
import { getDoctorPortalUserId } from "@/src/lib/auth/doctor-access";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import { DOCTOR_FALLBACK_ID } from "@/src/lib/auth/fallbackDoctorIdentity";
import { ensureFallbackDoctorInDb } from "@/src/lib/auth/ensureFallbackDoctor";
import { CLINIC_DOCTOR_EMAIL } from "@/src/lib/clinicDoctor";
import {
  findDoctorThreadId,
  getUserPublicKeyJwk,
  getWrappedThreadKey,
  listThreadEnvelopeUserIds,
  saveThreadEnvelopes,
  threadHasE2eeEnvelopes,
} from "@/src/lib/chatE2ee/store";

async function resolvePeerDoctorId(
  patientId: string,
  threadId: string
): Promise<string | null> {
  const [appt] = await db
    .select({ doctorId: appointments.doctorId })
    .from(appointments)
    .where(eq(appointments.userId, patientId))
    .orderBy(desc(appointments.dateTime))
    .limit(1);
  if (appt?.doctorId) return appt.doctorId;

  const envelopeUserIds = await listThreadEnvelopeUserIds(threadId);
  for (const uid of envelopeUserIds) {
    if (uid === patientId) continue;
    const [row] = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.id, uid))
      .limit(1);
    if (row?.role === "doctor" || row?.role === "admin") return row.id;
  }

  const [clinicDoc] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, CLINIC_DOCTOR_EMAIL))
    .limit(1);
  if (clinicDoc?.id) return clinicDoc.id;

  try {
    return await ensureFallbackDoctorInDb();
  } catch {
    const [fallback] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, DOCTOR_FALLBACK_ID))
      .limit(1);
    return fallback?.id ?? null;
  }
}

async function ensureDoctorThread(patientId: string): Promise<string> {
  const existing = await findDoctorThreadId(patientId);
  if (existing) return existing;
  const [created] = await db
    .insert(chatThreads)
    .values({ userId: patientId, assistantId: "doctor" })
    .returning({ id: chatThreads.id });
  if (!created) throw new Error("THREAD_CREATE_FAILED");
  return created.id;
}

/** GET — E2EE setup for doctor↔patient thread. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const patientIdParam = url.searchParams.get("patientId")?.trim() ?? "";

  const doctorId = await getDoctorPortalUserId();
  const sessionUserId = await getSessionUserIdFromRequest(req);

  let patientId: string;
  let selfUserId: string;

  if (doctorId && patientIdParam) {
    patientId = patientIdParam;
    selfUserId = doctorId;
  } else if (sessionUserId && !patientIdParam) {
    patientId = sessionUserId;
    selfUserId = sessionUserId;
  } else {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const threadId = await ensureDoctorThread(patientId);
  const peerUserId =
    doctorId && patientIdParam
      ? patientId
      : await resolvePeerDoctorId(patientId, threadId);
  if (!peerUserId) {
    return NextResponse.json({ error: "PEER_UNKNOWN" }, { status: 400 });
  }

  let effectiveSelfUserId = selfUserId;
  if (doctorId && doctorId === DOCTOR_FALLBACK_ID) {
    try {
      effectiveSelfUserId = await ensureFallbackDoctorInDb();
    } catch {
      /* use session id */
    }
  }

  const [selfPub, peerPub, wrappedForSelf, hasThreadKeys] = await Promise.all([
    getUserPublicKeyJwk(effectiveSelfUserId),
    getUserPublicKeyJwk(peerUserId),
    getWrappedThreadKey(threadId, effectiveSelfUserId),
    threadHasE2eeEnvelopes(threadId),
  ]);

  return NextResponse.json({
    ok: true,
    threadId,
    selfUserId: effectiveSelfUserId,
    peerUserId,
    selfHasPublicKey: Boolean(selfPub),
    peerHasPublicKey: Boolean(peerPub),
    peerPublicKeyJwk: peerPub,
    wrappedThreadKeyB64: wrappedForSelf,
    hasThreadKeys,
    ready: Boolean(selfPub && peerPub && wrappedForSelf),
  });
}

/** POST — store wrapped thread keys (client-generated). */
export async function POST(req: Request) {
  const doctorId = await getDoctorPortalUserId();
  const sessionUserId = await getSessionUserIdFromRequest(req);
  const userId = doctorId ?? sessionUserId;
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const b = body as {
    threadId?: string;
    envelopes?: Array<{ userId?: string; wrappedKeyB64?: string }>;
  };

  const threadId = typeof b.threadId === "string" ? b.threadId.trim() : "";
  if (!threadId) {
    return NextResponse.json({ error: "MISSING_THREAD_ID" }, { status: 400 });
  }

  const [thread] = await db
    .select({ userId: chatThreads.userId, assistantId: chatThreads.assistantId })
    .from(chatThreads)
    .where(eq(chatThreads.id, threadId))
    .limit(1);

  if (!thread || thread.assistantId !== "doctor") {
    return NextResponse.json({ error: "THREAD_NOT_FOUND" }, { status: 404 });
  }

  const allowedUserIds = new Set<string>([thread.userId]);
  if (doctorId) allowedUserIds.add(doctorId);
  if (sessionUserId) allowedUserIds.add(sessionUserId);

  const envelopes = (b.envelopes ?? [])
    .map((e) => ({
      userId: typeof e.userId === "string" ? e.userId.trim() : "",
      wrappedKeyB64:
        typeof e.wrappedKeyB64 === "string" ? e.wrappedKeyB64.trim() : "",
    }))
    .filter((e) => e.userId && e.wrappedKeyB64 && allowedUserIds.has(e.userId));

  if (envelopes.length === 0) {
    return NextResponse.json({ error: "NO_ENVELOPES" }, { status: 400 });
  }

  const hasKeys = await threadHasE2eeEnvelopes(threadId);
  if (hasKeys) {
    const existing = await listThreadEnvelopeUserIds(threadId);
    const onlyFillingOwn =
      envelopes.length === 1 &&
      envelopes[0]!.userId === userId &&
      !existing.includes(userId);
    if (!onlyFillingOwn) {
      return NextResponse.json(
        {
          error: "THREAD_KEYS_EXIST",
          message: "Thread encryption keys already exist; cannot replace them.",
        },
        { status: 409 }
      );
    }
  }

  await saveThreadEnvelopes(threadId, envelopes);
  return NextResponse.json({ ok: true });
}
