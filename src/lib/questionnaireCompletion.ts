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

/** Questionnaire milestone = at least one successful submit (profile has primary concern). */
export async function isQuestionnaireMilestoneComplete(
  userId: string
): Promise<boolean> {
  const [user] = await db
    .select({ primaryConcern: users.primaryConcern })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return userHasQuestionnaire(user?.primaryConcern);
}

export type QuestionnaireCompletionState = {
  /** At least one successful submit — unlocks features and dashboard. */
  submitted: boolean;
  /** Submitted with every question answered (no skips). Legacy submits count as full. */
  fullyComplete: boolean;
  skippedSteps: number[];
};

/** Submission + skip detail in one read (legacy submits without meta count as full). */
export async function getQuestionnaireCompletionState(
  userId: string
): Promise<QuestionnaireCompletionState> {
  const [submitted, meta] = await Promise.all([
    isQuestionnaireMilestoneComplete(userId),
    getQuestionnaireCompletionMeta(userId),
  ]);
  if (!submitted) {
    return { submitted: false, fullyComplete: false, skippedSteps: [] };
  }
  if (!meta) {
    return { submitted: true, fullyComplete: true, skippedSteps: [] };
  }
  return {
    submitted: true,
    fullyComplete: meta.fullyComplete,
    skippedSteps: meta.skippedSteps,
  };
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
