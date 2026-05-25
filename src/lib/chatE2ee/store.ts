import { and, desc, eq, like } from "drizzle-orm";
import { db } from "@/src/db/client";
import {
  chatMessages,
  chatThreadE2eeEnvelopes,
  chatThreads,
  chatUserE2eeKeys,
} from "@/src/db/schema";
import { E2EE_PREFIX } from "@/src/lib/chatE2ee/format";

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

export async function findDoctorThreadId(
  patientId: string,
  doctorId?: string | null
): Promise<string | null> {
  const conditions = [
    eq(chatThreads.userId, patientId),
    eq(chatThreads.assistantId, "doctor"),
  ];
  if (doctorId) {
    conditions.push(eq(chatThreads.doctorId, doctorId));
  }
  const [row] = await db
    .select({ id: chatThreads.id })
    .from(chatThreads)
    .where(and(...conditions))
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

export type ClearAllE2eeResult = {
  envelopesDeleted: number;
  userKeysDeleted: number;
  encryptedMessagesDeleted: number;
};

/**
 * Wipe all server-side E2EE state so doctor + patient can bootstrap fresh keys.
 * Optionally deletes chat rows whose body is e2ee:v1 (undecryptable after reset).
 */
export async function clearAllServerE2eeState(opts?: {
  deleteEncryptedMessages?: boolean;
}): Promise<ClearAllE2eeResult> {
  const deleteEncryptedMessages = opts?.deleteEncryptedMessages ?? true;

  const envelopeRows = await db
    .delete(chatThreadE2eeEnvelopes)
    .returning({ threadId: chatThreadE2eeEnvelopes.threadId });

  const keyRows = await db
    .delete(chatUserE2eeKeys)
    .returning({ userId: chatUserE2eeKeys.userId });

  let encryptedMessagesDeleted = 0;
  if (deleteEncryptedMessages) {
    const msgRows = await db
      .delete(chatMessages)
      .where(like(chatMessages.text, `${E2EE_PREFIX}%`))
      .returning({ id: chatMessages.id });
    encryptedMessagesDeleted = msgRows.length;
  }

  return {
    envelopesDeleted: envelopeRows.length,
    userKeysDeleted: keyRows.length,
    encryptedMessagesDeleted,
  };
}
