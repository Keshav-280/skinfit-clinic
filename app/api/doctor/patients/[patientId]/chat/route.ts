import { and, asc, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/src/db";
import { chatMessages, chatThreads, users } from "@/src/db/schema";
import { getDoctorPortalUserId } from "@/src/lib/auth/doctor-access";
import { isE2eePayload } from "@/src/lib/chatE2ee/format";
import { notifyChatThreadUpdated } from "@/src/lib/chatLive";
import { publishNotification } from "@/src/lib/infra";

const MAX_TEXT_LEN = 4000;
const MAX_ATTACHMENT_LEN = 3_200_000;

function clampText(v: unknown): string {
  if (typeof v !== "string") return "";
  const t = v.trim();
  if (!t) return "";
  return t.length > MAX_TEXT_LEN ? t.slice(0, MAX_TEXT_LEN) : t;
}

function normalizeAttachment(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  if (t.length > MAX_ATTACHMENT_LEN) return null;
  if (!t.startsWith("data:image/") && !t.startsWith("data:audio/")) return null;
  return t;
}

async function ensurePatient(patientId: string): Promise<boolean> {
  const row = await db.query.users.findFirst({
    where: and(eq(users.id, patientId), eq(users.role, "patient")),
    columns: { id: true },
  });
  return Boolean(row?.id);
}

async function latestDoctorThread(patientId: string): Promise<{ id: string } | null> {
  const [thread] = await db
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
  return thread ?? null;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ patientId: string }> }
) {
  const staffId = await getDoctorPortalUserId();
  if (!staffId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { patientId } = await ctx.params;
  if (!patientId) {
    return NextResponse.json({ error: "INVALID_PATIENT_ID" }, { status: 400 });
  }
  if (!(await ensurePatient(patientId))) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  const thread = await latestDoctorThread(patientId);
  if (!thread) {
    return NextResponse.json({ ok: true, messages: [] });
  }

  const rows = await db
    .select({
      id: chatMessages.id,
      sender: chatMessages.sender,
      text: chatMessages.text,
      attachmentUrl: chatMessages.attachmentUrl,
      createdAt: chatMessages.createdAt,
    })
    .from(chatMessages)
    .where(eq(chatMessages.threadId, thread.id))
    .orderBy(asc(chatMessages.createdAt));

  return NextResponse.json({
    ok: true,
    messages: rows.map((m) => ({
      id: m.id,
      sender: m.sender,
      text: m.text,
      attachmentUrl: m.attachmentUrl ?? null,
      createdAt: m.createdAt.toISOString(),
    })),
  });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ patientId: string }> }
) {
  const staffId = await getDoctorPortalUserId();
  if (!staffId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { patientId } = await ctx.params;
  if (!patientId) {
    return NextResponse.json({ error: "INVALID_PATIENT_ID" }, { status: 400 });
  }
  if (!(await ensurePatient(patientId))) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
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

  const payload = body as {
    text?: unknown;
    attachmentUrl?: unknown;
  };
  const text = clampText(payload.text);
  const attachmentUrl = normalizeAttachment(payload.attachmentUrl);

  if (!text && !attachmentUrl) {
    return NextResponse.json({ error: "TEXT_OR_ATTACHMENT_REQUIRED" }, { status: 400 });
  }

  let thread = await latestDoctorThread(patientId);
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

  const messageText =
    text || (attachmentUrl?.startsWith("data:audio/") ? "🎤 Voice note" : "🖼️ Image");

  const [created] = await db
    .insert(chatMessages)
    .values({
      threadId: thread.id,
      sender: "doctor",
      text: messageText,
      attachmentUrl: attachmentUrl ?? null,
    })
    .returning({
      id: chatMessages.id,
      sender: chatMessages.sender,
      text: chatMessages.text,
      attachmentUrl: chatMessages.attachmentUrl,
      createdAt: chatMessages.createdAt,
    });

  if (!created) {
    return NextResponse.json({ error: "MESSAGE_CREATE_FAILED" }, { status: 500 });
  }

  await notifyChatThreadUpdated(thread.id);
  void publishNotification("doctor.reply", patientId, {
    messagePreview: isE2eePayload(messageText)
      ? "New secure message from your clinic"
      : messageText,
    title: "Message from your doctor",
    body: isE2eePayload(messageText)
      ? "New secure message from your clinic"
      : messageText,
  });

  return NextResponse.json({
    ok: true,
    threadId: thread.id,
    message: {
      id: created.id,
      sender: created.sender,
      text: created.text,
      attachmentUrl: created.attachmentUrl ?? null,
      createdAt: created.createdAt.toISOString(),
    },
  });
}

