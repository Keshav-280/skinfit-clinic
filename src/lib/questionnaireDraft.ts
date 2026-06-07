import { and, desc, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { questionnaireAnswers } from "@/src/db/schema";
import {
  ONBOARDING_QUESTIONNAIRE_DRAFT_SCHEMA,
  type OnboardingQuestionnaireDraftV2,
  parseOnboardingQuestionnaireDraft,
} from "@/src/lib/onboardingQuestionnaireDraft";

export const QUESTIONNAIRE_DRAFT_META_ID = "__draft__";

export async function getQuestionnaireDraft(
  userId: string
): Promise<OnboardingQuestionnaireDraftV2 | null> {
  const [row] = await db
    .select({ answer: questionnaireAnswers.answer })
    .from(questionnaireAnswers)
    .where(
      and(
        eq(questionnaireAnswers.userId, userId),
        eq(questionnaireAnswers.questionId, QUESTIONNAIRE_DRAFT_META_ID)
      )
    )
    .orderBy(desc(questionnaireAnswers.createdAt))
    .limit(1);

  if (!row?.answer) return null;
  return parseOnboardingQuestionnaireDraft(row.answer);
}

export async function saveQuestionnaireDraft(
  userId: string,
  draft: OnboardingQuestionnaireDraftV2
): Promise<void> {
  await clearQuestionnaireDraft(userId);
  await db.insert(questionnaireAnswers).values({
    userId,
    questionId: QUESTIONNAIRE_DRAFT_META_ID,
    answer: draft as unknown as Record<string, unknown>,
    questionnaireVersion: ONBOARDING_QUESTIONNAIRE_DRAFT_SCHEMA,
  });
}

export async function clearQuestionnaireDraft(userId: string): Promise<void> {
  await db
    .delete(questionnaireAnswers)
    .where(
      and(
        eq(questionnaireAnswers.userId, userId),
        eq(questionnaireAnswers.questionId, QUESTIONNAIRE_DRAFT_META_ID)
      )
    );
}
