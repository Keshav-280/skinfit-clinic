import { and, desc, eq } from "drizzle-orm";
import { db } from "@/src/db";
import {
  chatThreadE2eeEnvelopes,
  chatThreads,
  chatUserE2eeKeys,
} from "@/src/db/schema";

export async function upsertUserPublicKey(
  userId: string,
  publicKeyJwk: JsonWebKey
): Promise<void> {
  const jwk = JSON.stringify(publicKeyJwk);
  await db
    .insert(chatUserE2eeKeys)
    .values({ userId, publicKeyJwk: jwk })
    .onConflictDoUpdate({
      target: chatUserE2eeKeys.userId,
      set: { publicKeyJwk: jwk, updatedAt: new Date() },
    });
}

export async function getUserPublicKeyJwk(
  userId: string
): Promise<JsonWebKey | null> {
  const row = await db.query.chatUserE2eeKeys.findFirst({
    where: eq(chatUserE2eeKeys.userId, userId),
    columns: { publicKeyJwk: true },
  });
  if (!row?.publicKeyJwk) return null;
  try {
    return JSON.parse(row.publicKeyJwk) as JsonWebKey;
  } catch {
    return null;
  }
}

export async function getWrappedThreadKey(
  threadId: string,
  userId: string
): Promise<string | null> {
  const row = await db.query.chatThreadE2eeEnvelopes.findFirst({
    where: and(
      eq(chatThreadE2eeEnvelopes.threadId, threadId),
      eq(chatThreadE2eeEnvelopes.userId, userId)
    ),
    columns: { wrappedKeyB64: true },
  });
  return row?.wrappedKeyB64 ?? null;
}

export async function saveThreadEnvelopes(
  threadId: string,
  envelopes: Array<{ userId: string; wrappedKeyB64: string }>
): Promise<void> {
  for (const e of envelopes) {
    await db
      .insert(chatThreadE2eeEnvelopes)
      .values({
        threadId,
        userId: e.userId,
        wrappedKeyB64: e.wrappedKeyB64,
      })
      .onConflictDoUpdate({
        target: [chatThreadE2eeEnvelopes.threadId, chatThreadE2eeEnvelopes.userId],
        set: { wrappedKeyB64: e.wrappedKeyB64 },
      });
  }
}

export async function findDoctorThreadId(patientId: string): Promise<string | null> {
  const [row] = await db
    .select({ id: chatThreads.id })
    .from(chatThreads)
    .where(
      and(eq(chatThreads.userId, patientId), eq(chatThreads.assistantId, "doctor"))
    )
    .orderBy(desc(chatThreads.createdAt))
    .limit(1);
  return row?.id ?? null;
}

export async function threadHasE2eeEnvelopes(threadId: string): Promise<boolean> {
  const row = await db.query.chatThreadE2eeEnvelopes.findFirst({
    where: eq(chatThreadE2eeEnvelopes.threadId, threadId),
    columns: { threadId: true },
  });
  return Boolean(row);
}

/** Doctor user ids that already have wrapped keys on this thread. */
export async function listThreadEnvelopeUserIds(threadId: string): Promise<string[]> {
  const rows = await db
    .select({ userId: chatThreadE2eeEnvelopes.userId })
    .from(chatThreadE2eeEnvelopes)
    .where(eq(chatThreadE2eeEnvelopes.threadId, threadId));
  return rows.map((r) => r.userId);
}

/** Removes wrapped thread keys so both parties can re-bootstrap E2EE. */
export async function clearThreadE2eeEnvelopes(threadId: string): Promise<number> {
  const deleted = await db
    .delete(chatThreadE2eeEnvelopes)
    .where(eq(chatThreadE2eeEnvelopes.threadId, threadId))
    .returning({ userId: chatThreadE2eeEnvelopes.userId });
  return deleted.length;
}
