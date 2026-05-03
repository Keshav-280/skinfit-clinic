import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/src/db";
import { users } from "@/src/db/schema";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";

/** Call when the patient has finished reviewing Schedules (e.g. after navigating away). Clears the schedule bell until new confirmations. */
export async function POST(req: Request) {
  const userId = await getSessionUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const now = new Date();
  await db
    .update(users)
    .set({ scheduleCrmDigestAt: now })
    .where(eq(users.id, userId));

  return NextResponse.json({ success: true, at: now.toISOString() });
}
