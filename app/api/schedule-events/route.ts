import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { scheduleEvents } from "@/src/db/schema";
import { getSessionUserId } from "@/src/lib/auth/get-session";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const rows = await db.query.scheduleEvents.findMany({
    where: eq(scheduleEvents.userId, userId),
    orderBy: [
      asc(scheduleEvents.eventDate),
      asc(scheduleEvents.eventTimeHm),
      asc(scheduleEvents.title),
    ],
    columns: {
      id: true,
      eventDate: true,
      eventTimeHm: true,
      title: true,
      completed: true,
    },
  });

  return NextResponse.json({ events: rows });
}

export async function PATCH(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  const { id, completed } = body as Record<string, unknown>;
  if (typeof id !== "string" || id.length === 0) {
    return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
  }
  if (typeof completed !== "boolean") {
    return NextResponse.json({ error: "INVALID_COMPLETED" }, { status: 400 });
  }

  const [updated] = await db
    .update(scheduleEvents)
    .set({ completed, updatedAt: new Date() })
    .where(
      and(eq(scheduleEvents.id, id), eq(scheduleEvents.userId, userId))
    )
    .returning({
      id: scheduleEvents.id,
      eventDate: scheduleEvents.eventDate,
      eventTimeHm: scheduleEvents.eventTimeHm,
      title: scheduleEvents.title,
      completed: scheduleEvents.completed,
    });

  if (!updated) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({ event: updated });
}
