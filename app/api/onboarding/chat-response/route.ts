import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import { users } from "@/src/db/schema";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import {
  ONBOARDING_CHAT_QUESTION_ORDER,
  generateOnboardingChatResponse,
  onboardingChatFallbackMessage,
  onboardingChatNextQuestionText,
  onboardingChatQuestionAfter,
  type OnboardingChatQuestionId,
} from "@/src/lib/onboardingChatKai";

export async function POST(req: Request) {
  const userId = await getSessionUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const [u] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!u || u.role !== "patient") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const questionId =
    typeof body.questionId === "string" ? body.questionId.trim() : "";
  if (
    !ONBOARDING_CHAT_QUESTION_ORDER.includes(
      questionId as OnboardingChatQuestionId
    )
  ) {
    return NextResponse.json(
      { error: "INVALID_QUESTION_ID", message: "Unknown questionId." },
      { status: 400 }
    );
  }

  if (!("answer" in body)) {
    return NextResponse.json(
      { error: "ANSWER_REQUIRED", message: "answer is required." },
      { status: 400 }
    );
  }

  const previousAnswers =
    body.previousAnswers &&
    typeof body.previousAnswers === "object" &&
    !Array.isArray(body.previousAnswers)
      ? (body.previousAnswers as Record<string, unknown>)
      : {};

  const nextId = onboardingChatQuestionAfter(questionId);
  const mergedPrevious = {
    ...previousAnswers,
    ...(questionId === "CONCERN_01" ? { concerns: body.answer } : {}),
  };
  const nextQuestionText =
    typeof body.nextQuestionText === "string" && body.nextQuestionText.trim()
      ? body.nextQuestionText.trim()
      : onboardingChatNextQuestionText(nextId, mergedPrevious);

  try {
    const { message } = await generateOnboardingChatResponse({
      questionId,
      answer: body.answer,
      previousAnswers,
      nextQuestionText,
    });
    return NextResponse.json({ message });
  } catch {
    return NextResponse.json({
      message: onboardingChatFallbackMessage(
        questionId,
        body.answer,
        previousAnswers,
        nextQuestionText
      ),
    });
  }
}
