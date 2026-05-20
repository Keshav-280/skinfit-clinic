import { and, count, eq, gt, inArray, isNotNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/src/db";
import { patientScheduleRequests, users } from "@/src/db/schema";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";

function isMissingColumnOrTable(error: unknown, needle: string): boolean {
  const err = error as { code?: string; message?: string };
  if (err?.code === "42703" || err?.code === "42P01") return true;
  return (
    typeof err?.message === "string" &&
    err.message.toLowerCase().includes(needle.toLowerCase())
  );
}

/** Unread schedule updates (confirm/cancel/decline) since last digest. */
export async function GET(req: Request) {
  const userId = await getSessionUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  let digest = new Date(0);
  try {
    const [u] = await db
      .select({ digest: users.scheduleCrmDigestAt })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    digest = u?.digest ?? new Date(0);
  } catch (e) {
    if (!isMissingColumnOrTable(e, "schedule_crm_digest_at")) throw e;
    // Older DB schema: treat as never-digested so count query still works.
    digest = new Date(0);
  }

  try {
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
  } catch (e) {
    if (!isMissingColumnOrTable(e, "patient_schedule_requests")) throw e;
    console.warn("[patient/schedule-bell] missing schedule tables/columns; returning 0");
    return NextResponse.json({ count: 0 });
  }
}
