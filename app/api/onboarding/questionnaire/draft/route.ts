import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import { users } from "@/src/db/schema";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import { parseOnboardingQuestionnaireDraft } from "@/src/lib/onboardingQuestionnaireDraft";
import {
  clearQuestionnaireDraft,
  getQuestionnaireDraft,
  saveQuestionnaireDraft,
} from "@/src/lib/questionnaireDraft";

async function requirePatientUserId(req: Request): Promise<string | NextResponse> {
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

  return userId;
}

export async function GET(req: Request) {
  const userId = await requirePatientUserId(req);
  if (userId instanceof NextResponse) return userId;

  const draft = await getQuestionnaireDraft(userId);
  return NextResponse.json({ draft });
}

export async function PUT(req: Request) {
  const userId = await requirePatientUserId(req);
  if (userId instanceof NextResponse) return userId;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const parsed = parseOnboardingQuestionnaireDraft(body.draft ?? body);
  if (!parsed) {
    return NextResponse.json(
      { error: "INVALID_DRAFT", message: "Could not save questionnaire progress." },
      { status: 400 }
    );
  }

  await saveQuestionnaireDraft(userId, parsed);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const userId = await requirePatientUserId(req);
  if (userId instanceof NextResponse) return userId;

  await clearQuestionnaireDraft(userId);
  return NextResponse.json({ ok: true });
}
