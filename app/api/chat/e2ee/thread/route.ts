import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/src/db";
import { appointments, chatThreads, users } from "@/src/db/schema";
import { getDoctorPortalUserId } from "@/src/lib/auth/doctor-access";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import {
  findDoctorThreadId,
  getUserPublicKeyJwk,
  getWrappedThreadKey,
  saveThreadEnvelopes,
} from "@/src/lib/chatE2ee/store";

async function resolvePeerDoctorId(patientId: string): Promise<string | null> {
  const [appt] = await db
    .select({ doctorId: appointments.doctorId })
    .from(appointments)
    .where(eq(appointments.userId, patientId))
    .orderBy(desc(appointments.dateTime))
    .limit(1);
  if (appt?.doctorId) return appt.doctorId;
  const [doc] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "doctor"))
    .limit(1);
  return doc?.id ?? null;
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
    doctorId && patientIdParam ? patientId : await resolvePeerDoctorId(patientId);
  if (!peerUserId) {
    return NextResponse.json({ error: "PEER_UNKNOWN" }, { status: 400 });
  }

  const [selfPub, peerPub, wrappedForSelf] = await Promise.all([
    getUserPublicKeyJwk(selfUserId),
    getUserPublicKeyJwk(peerUserId),
    getWrappedThreadKey(threadId, selfUserId),
  ]);

  return NextResponse.json({
    ok: true,
    threadId,
    selfUserId,
    peerUserId,
    selfHasPublicKey: Boolean(selfPub),
    peerHasPublicKey: Boolean(peerPub),
    peerPublicKeyJwk: peerPub,
    wrappedThreadKeyB64: wrappedForSelf,
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

  await saveThreadEnvelopes(threadId, envelopes);
  return NextResponse.json({ ok: true });
}
