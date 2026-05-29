import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import { chatThreads } from "@/src/db/schema";
import { publishChatThreadUpdated } from "../../services/shared/src/chat/pubsub";

/** Redis pub/sub ping for doctor/support chat SSE clients. */
export async function notifyChatThreadUpdated(threadId: string): Promise<void> {
  const [row] = await db
    .select({ userId: chatThreads.userId })
    .from(chatThreads)
    .where(eq(chatThreads.id, threadId))
    .limit(1);
  await publishChatThreadUpdated(threadId, row?.userId ?? null);
}
