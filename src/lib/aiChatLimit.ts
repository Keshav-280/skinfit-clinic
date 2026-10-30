import "server-only";

import { and, eq, sql } from "drizzle-orm";
import { db } from "@/src/db";
import { chatMessages, chatThreads } from "@/src/db/schema";
import { isPatientClinicVisited } from "@/src/lib/patientClinicVisit";

import { FREE_AI_MESSAGE_LIMIT } from "@/src/lib/aiChatLimitShared";

export { FREE_AI_MESSAGE_LIMIT };

export const AI_MESSAGE_LIMIT_ERROR = "AI_MESSAGE_LIMIT_REACHED";

export const AI_MESSAGE_LIMIT_MESSAGE = `You have used your ${FREE_AI_MESSAGE_LIMIT} free messages with kAI. Visit the SkinFit clinic to unlock unlimited messages, or reach out to Clinic Support.`;

export type AiChatUsage = {
  used: number;
  limit: number;
  unlimited: boolean;
  /** Messages left on the free plan; null when unlimited. */
  remaining: number | null;
};

export async function getAiChatUsage(userId: string): Promise<AiChatUsage> {
  const [unlimited, rows] = await Promise.all([
    isPatientClinicVisited(userId),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(chatMessages)
      .innerJoin(chatThreads, eq(chatMessages.threadId, chatThreads.id))
      .where(
        and(
          eq(chatThreads.userId, userId),
          eq(chatThreads.assistantId, "ai"),
          eq(chatMessages.sender, "patient")
        )
      ),
  ]);
  const used = Number(rows[0]?.n ?? 0);
  return {
    used,
    limit: FREE_AI_MESSAGE_LIMIT,
    unlimited,
    remaining: unlimited ? null : Math.max(0, FREE_AI_MESSAGE_LIMIT - used),
  };
}
