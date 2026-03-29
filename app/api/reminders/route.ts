import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { priorityReminders } from "@/src/db/schema";
import { getSessionUserId } from "@/src/lib/auth/get-session";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const rows = await db.query.priorityReminders.findMany({
    where: eq(priorityReminders.userId, userId),
    orderBy: [asc(priorityReminders.sortOrder)],
    columns: {
      id: true,
      title: true,
      priority: true,
      completed: true,
      sortOrder: true,
      completedAt: true,
    },
  });

  return NextResponse.json({ reminders: rows });
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

  const now = new Date();
  const [updated] = await db
    .update(priorityReminders)
    .set({
      completed,
      completedAt: completed ? now : null,
      updatedAt: now,
    })
    .where(
      and(eq(priorityReminders.id, id), eq(priorityReminders.userId, userId))
    )
    .returning({
      id: priorityReminders.id,
      title: priorityReminders.title,
      priority: priorityReminders.priority,
      completed: priorityReminders.completed,
      sortOrder: priorityReminders.sortOrder,
      completedAt: priorityReminders.completedAt,
    });

  if (!updated) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({ reminder: updated });
}
