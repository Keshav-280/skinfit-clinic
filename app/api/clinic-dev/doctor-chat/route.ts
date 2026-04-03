import { NextResponse } from "next/server";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/src/db";
import { chatMessages, chatThreads, users } from "@/src/db/schema";
import { notifyPatientNewClinicChat } from "@/src/lib/expoPush";

const ACTIONS = ["listThreads", "messages", "reply"] as const;
type DevAction = (typeof ACTIONS)[number];

function latestDoctorThreadId(patientId: string) {
  return db
    .select({ id: chatThreads.id })
    .from(chatThreads)
    .where(
      and(
        eq(chatThreads.userId, patientId),
        eq(chatThreads.assistantId, "doctor")
      )
    )
    .orderBy(desc(chatThreads.createdAt))
    .limit(1);
}

/**
 * Internal dev API: read Dr. Ruby (doctor assistant) threads for any patient and
 * post replies as `sender: doctor`. Not tied to the patient session.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  const actionRaw = (body as Record<string, unknown>).action;
  const action =
    typeof actionRaw === "string" && ACTIONS.includes(actionRaw as DevAction)
      ? (actionRaw as DevAction)
      : null;
  if (!action) {
    return NextResponse.json({ error: "INVALID_action" }, { status: 400 });
  }

  const input = body as {
    action: DevAction;
    patientId?: string;
    text?: string;
  };

  if (action === "listThreads") {
    const threads = await db
      .select({
        threadId: chatThreads.id,
        patientId: chatThreads.userId,
        patientName: users.name,
        patientEmail: users.email,
      })
      .from(chatThreads)
      .innerJoin(users, eq(chatThreads.userId, users.id))
      .where(eq(chatThreads.assistantId, "doctor"));

    const ids = threads.map((t) => t.threadId);
    const lastMap = new Map<string, string | null>();

    if (ids.length > 0) {
      const lasts = await db
        .select({
          threadId: chatMessages.threadId,
          lastAt: sql<Date | null>`max(${chatMessages.createdAt})`,
        })
        .from(chatMessages)
        .where(inArray(chatMessages.threadId, ids))
        .groupBy(chatMessages.threadId);

      for (const r of lasts) {
        const d = r.lastAt;
        lastMap.set(
          r.threadId,
          d ? (d instanceof Date ? d : new Date(d)).toISOString() : null
        );
      }
    }

    const enriched = threads.map((t) => ({
      threadId: t.threadId,
      patientId: t.patientId,
      patientName: t.patientName ?? "",
      patientEmail: t.patientEmail ?? "",
      lastMessageAt: lastMap.get(t.threadId) ?? null,
    }));

    enriched.sort((a, b) => {
      const ta = a.lastMessageAt ? Date.parse(a.lastMessageAt) : 0;
      const tb = b.lastMessageAt ? Date.parse(b.lastMessageAt) : 0;
      return tb - ta;
    });

    return NextResponse.json({ ok: true, threads: enriched });
  }

  if (action === "messages") {
    const patientId =
      typeof input.patientId === "string" ? input.patientId.trim() : "";
    if (!patientId) {
      return NextResponse.json({ error: "patientId_required" }, { status: 400 });
    }

    const [thread] = await latestDoctorThreadId(patientId);
    if (!thread) {
      return NextResponse.json({
        ok: true,
        patientId,
        threadId: null as string | null,
        messages: [] as Array<{
          id: string;
          sender: string;
          text: string;
          createdAt: string;
        }>,
      });
    }

    const rows = await db
      .select({
        id: chatMessages.id,
        sender: chatMessages.sender,
        text: chatMessages.text,
        createdAt: chatMessages.createdAt,
      })
      .from(chatMessages)
      .where(eq(chatMessages.threadId, thread.id))
      .orderBy(asc(chatMessages.createdAt));

    return NextResponse.json({
      ok: true,
      patientId,
      threadId: thread.id,
      messages: rows.map((m) => ({
        id: m.id,
        sender: m.sender,
        text: m.text,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  }

  if (action === "reply") {
    const patientId =
      typeof input.patientId === "string" ? input.patientId.trim() : "";
    const text =
      typeof input.text === "string" ? input.text.trim().slice(0, 2000) : "";
    if (!patientId) {
      return NextResponse.json({ error: "patientId_required" }, { status: 400 });
    }
    if (!text) {
      return NextResponse.json({ error: "TEXT_REQUIRED" }, { status: 400 });
    }

    let [thread] = await latestDoctorThreadId(patientId);
    if (!thread) {
      const [created] = await db
        .insert(chatThreads)
        .values({ userId: patientId, assistantId: "doctor" })
        .returning({ id: chatThreads.id });
      if (!created) {
        return NextResponse.json({ error: "THREAD_CREATE_FAILED" }, { status: 500 });
      }
      thread = created;
    }

    await db.insert(chatMessages).values({
      threadId: thread.id,
      sender: "doctor",
      text,
    });

    void notifyPatientNewClinicChat(patientId, text);

    return NextResponse.json({ ok: true, patientId, threadId: thread.id });
  }

  return NextResponse.json({ error: "UNSUPPORTED" }, { status: 400 });
}
