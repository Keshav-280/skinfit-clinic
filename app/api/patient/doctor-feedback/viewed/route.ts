import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import { users } from "@/src/db/schema";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";

/** Mark doctor feedback (incl. voice notes) as seen — clears “new” badge on dashboard. */
export async function POST(request: Request) {
  const userId = await getSessionUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  await db
    .update(users)
    .set({ doctorFeedbackViewedAt: new Date() })
    .where(eq(users.id, userId));

  return NextResponse.json({ ok: true });
}
