import { and, desc, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { questionnaireAnswers, users } from "@/src/db/schema";
import { userHasQuestionnaire } from "@/src/lib/onboardingAccess";

export const QUESTIONNAIRE_COMPLETION_META_ID = "__completion_meta__";

export type QuestionnaireCompletionMeta = {
  fullyComplete: boolean;
  skippedSteps: number[];
};

export async function getQuestionnaireCompletionMeta(
  userId: string
): Promise<QuestionnaireCompletionMeta | null> {
  const [row] = await db
    .select({ answer: questionnaireAnswers.answer })
    .from(questionnaireAnswers)
    .where(
      and(
        eq(questionnaireAnswers.userId, userId),
        eq(questionnaireAnswers.questionId, QUESTIONNAIRE_COMPLETION_META_ID)
      )
    )
    .orderBy(desc(questionnaireAnswers.createdAt))
    .limit(1);

  if (!row?.answer || typeof row.answer !== "object" || Array.isArray(row.answer)) {
    return null;
  }

  const answer = row.answer as Record<string, unknown>;
  const skippedSteps = Array.isArray(answer.skippedSteps)
    ? answer.skippedSteps.filter(
        (n): n is number => typeof n === "number" && Number.isInteger(n)
      )
    : [];

  return {
    fullyComplete: answer.fullyComplete === true,
    skippedSteps,
  };
}

/** Questionnaire milestone = submitted and no steps were skipped. */
export async function isQuestionnaireMilestoneComplete(
  userId: string
): Promise<boolean> {
  const [user] = await db
    .select({ primaryConcern: users.primaryConcern })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!userHasQuestionnaire(user?.primaryConcern)) {
    return false;
  }

  const meta = await getQuestionnaireCompletionMeta(userId);
  if (!meta) {
    // No completion record yet (in progress or submitted before skip tracking).
    return false;
  }

  return meta.fullyComplete;
}

export async function saveQuestionnaireCompletionMeta(
  userId: string,
  skippedSteps: number[]
): Promise<void> {
  const uniqueSkipped = [...new Set(skippedSteps)].sort((a, b) => a - b);
  await db.insert(questionnaireAnswers).values({
    userId,
    questionId: QUESTIONNAIRE_COMPLETION_META_ID,
    answer: {
      fullyComplete: uniqueSkipped.length === 0,
      skippedSteps: uniqueSkipped,
    },
    questionnaireVersion: 1,
  });
}
