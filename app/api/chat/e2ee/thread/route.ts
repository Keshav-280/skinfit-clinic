import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/src/db";
import { chatThreads } from "@/src/db/schema";
import { getDoctorPortalUserIdFromRequest } from "@/src/lib/auth/doctor-access";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import { DOCTOR_FALLBACK_ID } from "@/src/lib/auth/fallbackDoctorIdentity";
import { ensureFallbackDoctorInDb } from "@/src/lib/auth/ensureFallbackDoctor";
import {
  assertDoctorPatientAccess,
  ensureDoctorPatientChatThread,
  resolveDoctorIdForPatientChat,
} from "@/src/lib/doctorPatientCare";
import {
  clearThreadE2eeEnvelopes,
  findDoctorThreadId,
  getUserPublicKeyJwk,
  getWrappedThreadKey,
  listThreadEnvelopeUserIds,
  saveThreadEnvelopes,
  threadHasE2eeEnvelopes,
} from "@/src/lib/chatE2ee/store";

/** GET — E2EE setup for doctor↔patient thread (scoped per doctor–patient pair). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const patientIdParam = url.searchParams.get("patientId")?.trim() ?? "";

  const doctorId = await getDoctorPortalUserIdFromRequest(req);
  const sessionUserId = await getSessionUserIdFromRequest(req);

  let patientId: string;
  let selfUserId: string;
  let peerUserId: string;

  if (doctorId && patientIdParam) {
    try {
      await assertDoctorPatientAccess(doctorId, patientIdParam);
    } catch {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
    patientId = patientIdParam;
    selfUserId = doctorId;
    peerUserId = patientId;
  } else if (sessionUserId && !patientIdParam) {
    patientId = sessionUserId;
    selfUserId = sessionUserId;
    const doctorIdParam = url.searchParams.get("doctorId");
    const peer = await resolveDoctorIdForPatientChat(patientId, doctorIdParam);
    if (!peer) {
      return NextResponse.json(
        {
          error: "NO_DOCTOR",
          message: "No clinic doctor registered for secure chat yet.",
        },
        { status: 400 }
      );
    }
    peerUserId = peer;
  } else {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  let effectiveDoctorId = doctorId ?? peerUserId;
  if (doctorId && doctorId === DOCTOR_FALLBACK_ID) {
    try {
      effectiveDoctorId = await ensureFallbackDoctorInDb();
    } catch {
      /* use session id */
    }
  }

  const threadId = await ensureDoctorPatientChatThread(patientId, effectiveDoctorId);

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
    doctorId: effectiveDoctorId,
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
  const doctorId = await getDoctorPortalUserIdFromRequest(req);
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
    .select({
      userId: chatThreads.userId,
      assistantId: chatThreads.assistantId,
      doctorId: chatThreads.doctorId,
    })
    .from(chatThreads)
    .where(eq(chatThreads.id, threadId))
    .limit(1);

  if (!thread || thread.assistantId !== "doctor") {
    return NextResponse.json({ error: "THREAD_NOT_FOUND" }, { status: 404 });
  }

  if (doctorId) {
    if (thread.doctorId && thread.doctorId !== doctorId) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
    try {
      await assertDoctorPatientAccess(doctorId, thread.userId);
    } catch {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
    if (!thread.doctorId) {
      await db
        .update(chatThreads)
        .set({ doctorId })
        .where(eq(chatThreads.id, threadId));
    }
  } else if (sessionUserId === thread.userId) {
    /* Patient may use any registered doctor thread they own. */
  } else {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const allowedUserIds = new Set<string>([thread.userId]);
  if (doctorId) allowedUserIds.add(doctorId);
  if (sessionUserId) allowedUserIds.add(sessionUserId);
  if (thread.doctorId) allowedUserIds.add(thread.doctorId);

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

/** DELETE — clear stale thread envelopes (device key mismatch recovery). */
export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const patientIdParam = url.searchParams.get("patientId")?.trim() ?? "";

  const doctorId = await getDoctorPortalUserIdFromRequest(req);
  const sessionUserId = await getSessionUserIdFromRequest(req);

  let patientId: string;
  let scopeDoctorId: string | null = null;

  if (doctorId && patientIdParam) {
    try {
      await assertDoctorPatientAccess(doctorId, patientIdParam);
    } catch {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
    patientId = patientIdParam;
    scopeDoctorId = doctorId;
  } else if (sessionUserId && !patientIdParam) {
    patientId = sessionUserId;
    const doctorIdParam = url.searchParams.get("doctorId");
    scopeDoctorId = await resolveDoctorIdForPatientChat(
      patientId,
      doctorIdParam
    );
  } else {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const threadId = scopeDoctorId
    ? await findDoctorThreadId(patientId, scopeDoctorId)
    : await findDoctorThreadId(patientId);
  if (!threadId) {
    return NextResponse.json({ ok: true, deleted: 0, threadId: null });
  }

  const deleted = await clearThreadE2eeEnvelopes(threadId);
  return NextResponse.json({ ok: true, deleted, threadId });
}
