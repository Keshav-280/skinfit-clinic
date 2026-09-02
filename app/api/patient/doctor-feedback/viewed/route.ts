import { NextResponse } from "next/server";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/src/db";
import { doctorFeedbackVoiceNotes } from "@/src/db/schema";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import { invalidateUserHistoryCache, invalidateUserHomeCache } from "@/src/lib/infra";

type Scope = "dashboard" | "report" | "all";

/** Mark voice notes as listened (bulk) - e.g. from Notifications shortcuts. */
export async function POST(request: Request) {
  const userId = await getSessionUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  let scope: Scope = "all";
  try {
    const ct = request.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      const body = (await request.json()) as { scope?: string };
      if (
        body.scope === "dashboard" ||
        body.scope === "report" ||
        body.scope === "all"
      ) {
        scope = body.scope;
      }
    }
  } catch {
    scope = "all";
  }

  const now = new Date();
  const listenedWhere = [
    eq(doctorFeedbackVoiceNotes.userId, userId),
    isNull(doctorFeedbackVoiceNotes.patientArchivedAt),
    isNull(doctorFeedbackVoiceNotes.patientListenedAt),
  ] as const;

  if (scope === "dashboard" || scope === "all") {
    await db
      .update(doctorFeedbackVoiceNotes)
      .set({ patientListenedAt: now })
      .where(
        and(...listenedWhere, isNull(doctorFeedbackVoiceNotes.scanId))
      );
  }
  if (scope === "report" || scope === "all") {
    await db
      .update(doctorFeedbackVoiceNotes)
      .set({ patientListenedAt: now })
      .where(
        and(...listenedWhere, isNotNull(doctorFeedbackVoiceNotes.scanId))
      );
  }

  await invalidateUserHistoryCache(userId);
  await invalidateUserHomeCache(userId);

  return NextResponse.json({ ok: true });
}
