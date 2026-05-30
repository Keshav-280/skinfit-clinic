import { and, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/src/db";
import { chatMessages, chatThreads } from "@/src/db/schema";

const CLINIC_SENDERS = ["support", "doctor"] as const;

function parseSinceQuery(raw: string | null): Date {
  if (raw && !Number.isNaN(Date.parse(raw))) return new Date(raw);
  return new Date(0);
}

/**
 * Count clinic-originated messages strictly after the read cursor.
 * Cursor is advanced by +1s in SQL so timestamptz microsecond drift cannot
 * leave a single row stuck as "unread" forever.
 */
export async function countUnreadClinicMessagesForAssistant(params: {
  userId: string;
  assistantId: "support" | "doctor";
  since: Date;
}): Promise<number> {
  const since = params.since;

  // Doctor chat uses one thread per doctor; count unread across all matching threads.
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(chatMessages)
    .innerJoin(chatThreads, eq(chatMessages.threadId, chatThreads.id))
    .where(
      and(
        eq(chatThreads.userId, params.userId),
        eq(chatThreads.assistantId, params.assistantId),
        inArray(chatMessages.sender, [...CLINIC_SENDERS]),
        sql`${chatMessages.createdAt} > (${since}::timestamptz + interval '1 second')`,
        or(
          isNull(chatThreads.patientClearedChatAt),
          gt(chatMessages.createdAt, chatThreads.patientClearedChatAt)
        )
      )
    );

  return Number(row?.n ?? 0);
}

export function parseInboxSinceParams(url: URL): {
  supportSince: Date;
  doctorSince: Date;
} {
  return {
    supportSince: parseSinceQuery(url.searchParams.get("supportSince")),
    doctorSince: parseSinceQuery(url.searchParams.get("doctorSince")),
  };
}
