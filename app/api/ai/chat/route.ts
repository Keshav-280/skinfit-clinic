import { NextResponse } from "next/server";
import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/src/db";
import {
  appointments,
  priorityReminders,
  scheduleEvents,
  scans,
  users,
  visitNotes,
} from "@/src/db/schema";
import { getSessionUserId } from "@/src/lib/auth/get-session";
import { localCalendarYmd, dateOnlyFromYmd, ymdFromDateOnly } from "@/src/lib/date-only";
import OpenAI from "openai";

type AssistantId = "ai" | "doctor" | "support";

function truncate(s: string, max: number): string {
  const str = s ?? "";
  if (str.length <= max) return str;
  return `${str.slice(0, max - 1)}…`;
}

function addDaysUTCNoon(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function buildPatientContext(params: {
  userName: string;
  latestScan: (typeof scans.$inferSelect) | undefined;
  recentScans: Array<typeof scans.$inferSelect>;
  recentVisitNotes: Array<typeof visitNotes.$inferSelect>;
  upcomingEvents: Array<typeof scheduleEvents.$inferSelect>;
  nextAppointment: (typeof appointments.$inferSelect) | undefined;
  reminders: Array<typeof priorityReminders.$inferSelect>;
}) {
  const {
    userName,
    latestScan,
    recentScans,
    recentVisitNotes,
    upcomingEvents,
    nextAppointment,
    reminders,
  } = params;

  const latestScanLine = latestScan
    ? `Latest scan (${ymdFromDateOnly(latestScan.createdAt)}): overall ${latestScan.overallScore}/100, acne ${latestScan.acne}, pigmentation ${latestScan.pigmentation}, wrinkles ${latestScan.wrinkles}, hydration ${latestScan.hydration}, texture ${latestScan.texture}. AI summary: ${truncate(latestScan.aiSummary ?? "N/A", 220)}`
    : `No scans found yet.`;

  const recentScansLines =
    recentScans.length > 0
      ? recentScans
          .map((s) => {
            const date = ymdFromDateOnly(s.createdAt);
            return `- ${date}: overall ${s.overallScore}/100 (acne ${s.acne}, pigmentation ${s.pigmentation}, wrinkles ${s.wrinkles}, hydration ${s.hydration}, texture ${s.texture})`;
          })
          .join("\n")
      : `- No recent scans.`;

  const visitNotesLines =
    recentVisitNotes.length > 0
      ? recentVisitNotes
          .map((n) => {
            const visitDate = ymdFromDateOnly(n.visitDate);
            return `- ${visitDate} (${n.doctorName}): ${truncate(n.notes, 420)}`;
          })
          .join("\n")
      : `- No visit notes found.`;

  const upcomingEventsLines =
    upcomingEvents.length > 0
      ? upcomingEvents
          .map((e) => {
            const date = ymdFromDateOnly(e.eventDate);
            return `- ${date}${e.eventTimeHm ? ` ${e.eventTimeHm}` : ""}: ${truncate(e.title, 90)}`;
          })
          .join("\n")
      : `- No upcoming schedule events (next 30 days).`;

  const reminderLines =
    reminders.length > 0
      ? reminders.map((r) => `- ${truncate(r.title, 90)} (${r.priority})`).join("\n")
      : `- No active reminders.`;

  const nextAppointmentLine = nextAppointment
    ? `Next appointment: ${ymdFromDateOnly(nextAppointment.dateTime)} ${new Date(nextAppointment.dateTime).toISOString().slice(11, 16)} (type: ${nextAppointment.type}, status: ${nextAppointment.status}).`
    : `No upcoming appointments found.`;

  return [
    `Patient: ${userName}`,
    ``,
    latestScanLine,
    ``,
    `Recent scans (higher score = better skin health):\n${recentScansLines}`,
    ``,
    `Visit / treatment notes:\n${visitNotesLines}`,
    ``,
    `Upcoming schedule events (next 30 days):\n${upcomingEventsLines}`,
    ``,
    `Priority reminders:\n${reminderLines}`,
    ``,
    nextAppointmentLine,
  ].join("\n");
}

const ASSISTANT_SYSTEM: Record<AssistantId, string> = {
  ai: [
    "You are the SkinnFit AI Assistant.",
    "You help a patient understand their skin condition using the patient context provided by the app.",
    "You must not diagnose. Provide general educational guidance and conservative next steps.",
    "You should explain what is normal vs not normal after routines/procedures and when to contact the clinic.",
    "Treat higher scan scores as better skin health.",
    "Keep your answer short (max ~180 words). Always end with a complete sentence. If you are near the output limit, stop early but do not leave an unfinished phrase.",
    "If the user describes severe symptoms (e.g., trouble breathing, rapidly worsening swelling, spreading infection, severe eye pain), instruct them to seek urgent medical care immediately.",
    "When unsure, say so and suggest contacting the clinic.",
    "Use a friendly tone. Prefer short paragraphs and clear bullets.",
    "Output format: (1) Direct answer, (2) What to do now, (3) When to contact the clinic.",
  ].join("\n"),
  doctor: [
    "You are Dr. Ruby Sachdev (dermatology).",
    "You provide cautious, non-definitive medical guidance based only on the patient context provided.",
    "You must not claim you are the user's real doctor or provide a diagnosis. Encourage clinic contact for medical decisions.",
    "Use a conservative approach; focus on after-care and safety.",
    "Keep your answer short (max ~180 words). Always end with a complete sentence. If you are near the output limit, stop early but do not leave an unfinished phrase.",
    "If the user asks to book or discuss appointments, refer to the clinic support flow and suggest what details to share.",
    "Treat higher scan scores as better skin health.",
    "If severe symptoms are described, recommend urgent medical care.",
    "Output format: (1) Assessment (non-diagnostic), (2) Plan, (3) Red flags & contact timing.",
  ].join("\n"),
  support: [
    "You are SkinnFit Clinic Support (AI receptionist).",
    "Your job is to answer FAQs, explain procedures at a high level, guide patients to the right next step, and help with booking/follow-ups using the provided patient context.",
    "You should not provide medical diagnosis. If the user is asking medical questions, you can summarize likely next-care steps and then recommend talking to the SkinnFit AI Assistant or Dr.",
    "Be concise. Ask follow-up questions needed for scheduling (preferred date/time, treatment type).",
    "Use provided upcoming schedule events and next appointment details when possible.",
    "If the user asks for costs or insurance details and you don't have information, say you don't know and suggest contacting the clinic.",
    "Keep your answer short (max ~160 words). Always end with a complete sentence. If you are near the output limit, stop early but do not leave an unfinished phrase.",
    "Output format: (1) Quick answer, (2) Next steps, (3) What I need from you.",
  ].join("\n"),
};

function finalizeReplyText(reply: string): string {
  const trimmed = reply.trim();
  if (!trimmed) return trimmed;

  // If the last character looks like it's in the middle of a sentence (letter/number),
  // trim back to the last sentence-ending punctuation to avoid "Feel free to" style endings.
  const lastChar = trimmed.slice(-1);
  const endsWithPunctuation = /[.!?]/.test(lastChar);
  const endsWithLikelyIncomplete = /[A-Za-z0-9]/.test(lastChar) && !endsWithPunctuation;

  if (!endsWithLikelyIncomplete) return trimmed;

  const lastDot = trimmed.lastIndexOf(".");
  const lastBang = trimmed.lastIndexOf("!");
  const lastQ = trimmed.lastIndexOf("?");
  const lastStop = Math.max(lastDot, lastBang, lastQ);
  if (lastStop === -1) return trimmed;

  return trimmed.slice(0, lastStop + 1).trim();
}

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const openaiKey =
    process.env.OPENROUTER_API_KEY?.trim() ||
    process.env.OPENAI_API_KEY?.trim();
  if (!openaiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY_NOT_CONFIGURED" },
      { status: 500 }
    );
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

  const {
    assistantId,
    message,
    history,
  }: {
    assistantId?: string;
    message?: unknown;
    history?: Array<{ role: "user" | "assistant"; content: string }>;
  } = body as {
    assistantId?: string;
    message?: unknown;
    history?: Array<{ role: "user" | "assistant"; content: string }>;
  };

  const normalizedAssistant: AssistantId =
    assistantId === "doctor" || assistantId === "support" || assistantId === "ai"
      ? (assistantId as AssistantId)
      : "ai";

  if (typeof message !== "string" || !message.trim()) {
    return NextResponse.json(
      { error: "MESSAGE_REQUIRED" },
      { status: 400 }
    );
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const todayYmd = localCalendarYmd();
  const today = dateOnlyFromYmd(todayYmd);
  const upper = addDaysUTCNoon(today, 30);

  const [latestScan] = await db.query.scans.findMany({
    where: eq(scans.userId, userId),
    orderBy: [desc(scans.createdAt)],
    limit: 1,
  });

  const recentScans = await db.query.scans.findMany({
    where: eq(scans.userId, userId),
    orderBy: [desc(scans.createdAt)],
    limit: 3,
    columns: {
      id: true,
      userId: true,
      scanName: true,
      overallScore: true,
      acne: true,
      pigmentation: true,
      wrinkles: true,
      hydration: true,
      texture: true,
      aiSummary: true,
      createdAt: true,
    },
  });

  const recentVisitNotes = await db.query.visitNotes.findMany({
    where: eq(visitNotes.userId, userId),
    orderBy: [desc(visitNotes.visitDate)],
    limit: 3,
    columns: {
      id: true,
      userId: true,
      visitDate: true,
      doctorName: true,
      notes: true,
    },
  });

  const upcomingEvents = await db.query.scheduleEvents.findMany({
    where: and(
      eq(scheduleEvents.userId, userId),
      eq(scheduleEvents.completed, false),
      gte(scheduleEvents.eventDate, today),
      lte(scheduleEvents.eventDate, upper)
    ),
    orderBy: [asc(scheduleEvents.eventDate), asc(scheduleEvents.eventTimeHm)],
    limit: 10,
    columns: {
      id: true,
      userId: true,
      eventDate: true,
      eventTimeHm: true,
      title: true,
      completed: true,
    },
  });

  const [nextAppointment] = await db.query.appointments.findMany({
    where: and(
      eq(appointments.userId, userId),
      eq(appointments.status, "scheduled")
    ),
    orderBy: [asc(appointments.dateTime)],
    limit: 1,
  });

  const reminders = await db.query.priorityReminders.findMany({
    where: and(eq(priorityReminders.userId, userId), eq(priorityReminders.completed, false)),
    orderBy: [asc(priorityReminders.sortOrder)],
    limit: 6,
    columns: {
      id: true,
      userId: true,
      title: true,
      priority: true,
      completed: true,
      sortOrder: true,
    },
  });

  const patientContext = buildPatientContext({
    userName: user?.name ?? "Patient",
    latestScan,
    recentScans,
    recentVisitNotes,
    upcomingEvents,
    nextAppointment,
    reminders,
  });

  const systemPrompt = ASSISTANT_SYSTEM[normalizedAssistant];

  const openRouterBaseUrl =
    process.env.OPENROUTER_BASE_URL?.trim() ||
    "https://openrouter.ai/api/v1";
  const model =
    process.env.OPENROUTER_MODEL?.trim() ||
    process.env.OPENAI_CHAT_MODEL?.trim() ||
    "openai/gpt-4o-mini";

  const openai = new OpenAI({
    apiKey: openaiKey,
    baseURL: openRouterBaseUrl,
  });

  const openaiMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> =
    [
      {
        role: "system",
        content: `${systemPrompt}\n\nPatient context:\n${patientContext}`,
      },
    ];

  if (Array.isArray(history)) {
    const sanitizedHistory = history
      .filter(
        (h) =>
          h &&
          (h.role === "user" || h.role === "assistant") &&
          typeof h.content === "string" &&
          h.content.trim().length > 0
      )
      .slice(-10);

    for (const h of sanitizedHistory) {
      openaiMessages.push({
        role: h.role,
        content: h.content.trim(),
      });
    }
  }

  openaiMessages.push({ role: "user", content: message.trim() });

  const completion = await openai.chat.completions.create({
    model,
    messages: openaiMessages,
    max_tokens: 900,
    temperature: 0.4,
  });

  const replyRaw = completion.choices[0]?.message?.content?.trim() || "";
  const reply = finalizeReplyText(replyRaw);
  if (!reply) {
    return NextResponse.json(
      { error: "EMPTY_OPENAI_RESPONSE" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    reply,
    usage: completion.usage ?? null,
  });
}

