import { and, count, eq, gt, inArray, isNotNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/src/db";
import { patientScheduleRequests, users } from "@/src/db/schema";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";

/** Unread schedule updates (confirm/cancel/decline) since last digest. */
export async function GET(req: Request) {
  const userId = await getSessionUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const [u] = await db
    .select({ digest: users.scheduleCrmDigestAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const digest = u?.digest ?? new Date(0);

  const [row] = await db
    .select({ n: count() })
    .from(patientScheduleRequests)
    .where(
      and(
        eq(patientScheduleRequests.patientId, userId),
        inArray(patientScheduleRequests.status, [
          "confirmed",
          "cancelled",
          "declined",
        ]),
        isNotNull(patientScheduleRequests.updatedAt),
        gt(patientScheduleRequests.updatedAt, digest)
      )
    );

  return NextResponse.json({ count: Number(row?.n ?? 0) });
}
