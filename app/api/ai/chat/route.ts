import { NextResponse } from "next/server";
import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/src/db";
import {
  appointments,
  dailyLogs,
  priorityReminders,
  scheduleEvents,
  scans,
  users,
  visitNotes,
} from "@/src/db/schema";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import { utcInstantToClinicWallYmdHm } from "@/src/lib/clinicSlotUtcInstant";
import { localCalendarYmd, dateOnlyFromYmd, ymdFromDateOnly } from "@/src/lib/date-only";
import { parseClinicalScores } from "@/src/lib/parseClinicalScores";
import { parseScanRegions } from "@/src/lib/parseScanAnnotations";
import OpenAI from "openai";
import { coerceRoutinePlanList } from "@/src/lib/routine";

type AssistantId = "ai" | "doctor" | "support";

type ChatScan = {
  id: number;
  createdAt: Date;
  scanName: string | null;
  userId: string;
  overallScore: number;
  acne: number;
  pigmentation: number;
  wrinkles: number;
  hydration: number;
  texture: number;
  aiSummary: string | null;
  annotations: unknown;
  scores: unknown;
};

type ChatVisitNote = {
  id: string;
  userId: string;
  visitDate: Date;
  doctorName: string;
  notes: string;
};

type ChatScheduleEvent = {
  id: string;
  userId: string;
  eventDate: Date;
  eventTimeHm: string | null;
  title: string;
};

type ChatAppointment = {
  id: string;
  userId: string;
  doctorId: string;
  dateTime: Date;
  status: string;
  type: string;
};

type ChatReminder = {
  id: string;
  userId: string;
  title: string;
  priority: string;
  completed: boolean;
  sortOrder: number;
};

type ChatDailyLog = {
  id: string;
  userId: string;
  date: Date;
  amRoutine: boolean;
  pmRoutine: boolean;
  mood: string;
  sleepHours: number;
  stressLevel: number;
  waterGlasses: number;
  journalEntry: string | null;
  routineAmSteps: boolean[] | null;
  routinePmSteps: boolean[] | null;
};

function truncate(s: string, max: number): string {
  const str = s ?? "";
  if (str.length <= max) return str;
  return `${str.slice(0, max - 1)}…`;
}

/**
 * Scan `createdAt` is a real UTC instant; use clinic wall clock (see CLINIC_SLOT_UTC_OFFSET_MINUTES,
 * default IST) so "today" matches the patient and UTC date lines don't look like the wrong day.
 */
function formatScanCreatedForContext(createdAt: Date): string {
  const { ymd, hm } = utcInstantToClinicWallYmdHm(createdAt);
  return `${ymd} ${hm}`;
}

/** Compact text for chat context; 1-5 clinical = higher is more concern. */
function formatClinicalScoresLine(scoresJson: unknown, maxLen: number): string {
  const c = parseClinicalScores(scoresJson);
  if (!c) return "";
  const parts: string[] = [];
  if (typeof c.active_acne === "number") parts.push(`active_acne ${c.active_acne}`);
  if (typeof c.skin_quality === "number") parts.push(`skin_quality ${c.skin_quality}`);
  if (typeof c.wrinkle_severity === "number") parts.push(`wrinkles_1-5 ${c.wrinkle_severity}`);
  if (typeof c.sagging_volume === "number") parts.push(`sagging_volume ${c.sagging_volume}`);
  if (typeof c.under_eye === "number") parts.push(`under_eye ${c.under_eye}`);
  if (typeof c.hair_health === "number") parts.push(`hair_health ${c.hair_health}`);
  if (c.pigmentation_model === null) parts.push("pigmentation_model n/a");
  else if (typeof c.pigmentation_model === "number")
    parts.push(`pigmentation_model ${c.pigmentation_model}`);
  if (!parts.length) return "";
  const line = `Clinical model (1-5, higher = more concern): ${parts.join(", ")}`;
  return truncate(line, maxLen);
}

/** Region markers from scan (issue + approximate face % position). */
function formatAnnotationsLine(annotationsJson: unknown, maxLen: number): string {
  const regions = parseScanRegions(annotationsJson);
  if (!regions.length) return "";
  const bits = regions.map(
    (r) => `${r.issue}~${Math.round(r.coordinates.x)}%,${Math.round(r.coordinates.y)}%`
  );
  return truncate(`Findings map: ${bits.join("; ")}`, maxLen);
}

function summarizeRoutineSteps(
  steps: boolean[] | null | undefined,
  labels: readonly string[]
): string {
  const s = Array.isArray(steps) ? steps : [];
  const done = labels.filter((_, i) => Boolean(s[i]));
  return done.length ? done.join(", ") : "Not done";
}

function addDaysUTCNoon(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function buildPatientContext(params: {
  userName: string;
  routineAmLabels: readonly string[];
  routinePmLabels: readonly string[];
  latestScan: ChatScan | undefined;
  recentScans: Array<ChatScan>;
  recentVisitNotes: Array<ChatVisitNote>;
  recentDailyLogs: Array<ChatDailyLog>;
  upcomingEvents: Array<ChatScheduleEvent>;
  nextAppointment: ChatAppointment | undefined;
  reminders: Array<ChatReminder>;
}) {
  const {
    userName,
    routineAmLabels,
    routinePmLabels,
    latestScan,
    recentScans,
    recentVisitNotes,
    recentDailyLogs,
    upcomingEvents,
    nextAppointment,
    reminders,
  } = params;

  const latestExtra = latestScan
    ? [
        formatClinicalScoresLine(latestScan.scores, 280),
        formatAnnotationsLine(latestScan.annotations, 260),
      ]
        .filter(Boolean)
        .join(" ")
    : "";

  const latestScanLine = latestScan
    ? `Latest scan (${formatScanCreatedForContext(latestScan.createdAt)} clinic local, id ${latestScan.id}${latestScan.scanName ? ` "${truncate(latestScan.scanName, 40)}"` : ""}): summary scores 0-100 (higher = better) - overall ${latestScan.overallScore}, acne ${latestScan.acne}, pigmentation ${latestScan.pigmentation}, wrinkles ${latestScan.wrinkles}, hydration ${latestScan.hydration}, texture ${latestScan.texture}. AI summary: ${truncate(latestScan.aiSummary ?? "N/A", 220)}${latestExtra ? ` ${latestExtra}` : ""}`
    : `No scans found yet.`;

  const recentScansLines =
    recentScans.length > 0
      ? recentScans
          .map((s) => {
            const when = formatScanCreatedForContext(s.createdAt);
            const clin = formatClinicalScoresLine(s.scores, 120);
            const ann = formatAnnotationsLine(s.annotations, 100);
            const tail = [clin, ann].filter(Boolean).join(" ");
            return `- ${when} (id ${s.id}): overall ${s.overallScore}/100 (acne ${s.acne}, pigmentation ${s.pigmentation}, wrinkles ${s.wrinkles}, hydration ${s.hydration}, texture ${s.texture})${tail ? ` | ${tail}` : ""}`;
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

  const dailyJournalLines =
    recentDailyLogs.length > 0
      ? recentDailyLogs
          .slice()
          .sort((a, b) => b.date.getTime() - a.date.getTime())
          .map((d) => {
            const date = ymdFromDateOnly(d.date);
            const amSteps = summarizeRoutineSteps(
              d.routineAmSteps,
              routineAmLabels
            );
            const pmSteps = summarizeRoutineSteps(
              d.routinePmSteps,
              routinePmLabels
            );
            const journal = d.journalEntry ? truncate(d.journalEntry, 220) : "N/A";
            return [
              `- ${date}: mood "${truncate(d.mood, 40)}", sleep ${d.sleepHours}h, stress ${d.stressLevel}/10, water ${d.waterGlasses} glasses`,
              `  AM routine: ${d.amRoutine ? "done" : "not done"} (${amSteps})`,
              `  PM routine: ${d.pmRoutine ? "done" : "not done"} (${pmSteps})`,
              `  Journal: ${journal}`,
            ].join("\n");
          })
          .join("\n")
      : `- No daily journal entries found.`;

  const nextAppointmentLine = nextAppointment
    ? (() => {
        const { ymd, hm } = utcInstantToClinicWallYmdHm(nextAppointment.dateTime);
        return `Next appointment: ${ymd} ${hm} (type: ${nextAppointment.type}, status: ${nextAppointment.status}).`;
      })()
    : `No upcoming appointments found.`;

  return [
    `Patient: ${userName}`,
    ``,
    latestScanLine,
    ``,
    `Recent scans: 0-100 summary metrics below mean better skin; separate "Clinical model (1-5)" means higher = more concern. Lines may include findings map (approximate face positions).\n${recentScansLines}`,
    ``,
    `Visit / treatment notes:\n${visitNotesLines}`,
    ``,
    `Daily journal (last entries):\n${dailyJournalLines}`,
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
    "You are the SkinFit AI Assistant.",
    "You help a patient understand their skin condition using the patient context provided by the app.",
    "You must not diagnose. Provide general educational guidance and conservative next steps.",
    "You should explain what is normal vs not normal after routines/procedures and when to contact the clinic.",
    "Use the patient's daily journal (AM/PM routines, mood, sleep, stress, water, journal text) to make your guidance context-aware.",
    "Treat higher 0-100 scan summary scores as better skin health.",
    "When clinical model scores (1-5) appear in context, higher = more severe; do not confuse with 0-100 metrics.",
    "Findings map lines (e.g. Acne~45%,52%) describe where the last scan flagged issues on the face image.",
    "Scan timestamps in patient context are clinic local date and time (24h, e.g. India IST unless the deployment sets CLINIC_SLOT_UTC_OFFSET_MINUTES). Use them verbatim when the user asks when a scan was taken.",
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
    "Use the patient's daily journal (AM/PM routines, mood, sleep, stress, water, journal text) to provide safer, personalized after-care suggestions.",
    "Keep your answer short (max ~180 words). Always end with a complete sentence. If you are near the output limit, stop early but do not leave an unfinished phrase.",
    "If the user asks to book or discuss appointments, refer to the clinic support flow and suggest what details to share.",
    "Treat higher 0-100 scan summary scores as better skin health.",
    "When clinical model scores (1-5) appear, higher = more severe; findings map lines show approximate face locations flagged on scans.",
    "Scan timestamps in context are clinic local (24h); use them when the patient asks when a scan was taken.",
    "If severe symptoms are described, recommend urgent medical care.",
    "Output format: (1) Assessment (non-diagnostic), (2) Plan, (3) Red flags & contact timing.",
  ].join("\n"),
  support: [
    "You are SkinFit Wellness Support (AI receptionist).",
    "Your job is to answer FAQs, explain procedures at a high level, guide patients to the right next step, and help with booking/follow-ups using the provided patient context.",
    "You should not provide medical diagnosis. If the user is asking medical questions, you can summarize likely next-care steps and then recommend talking to the SkinFit AI Assistant or Dr.",
    "Be concise. Ask follow-up questions needed for scheduling (preferred date/time, treatment type).",
    "Use the patient's daily journal to tailor follow-up questions and routine reminders.",
    "Use provided upcoming schedule events and next appointment details when possible.",
    "Patient context may include recent AI face scans (0-100 summaries, optional 1-5 clinical scores, and findings map). Use them only to guide scheduling or general encouragement, not diagnosis.",
    "Scan timestamps in context are clinic local (24h).",
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
  const userId = await getSessionUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const openaiKey = process.env.OPENAI_API_KEY?.trim();
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
    columns: {
      id: true,
      createdAt: true,
      scanName: true,
      userId: true,
      overallScore: true,
      acne: true,
      pigmentation: true,
      wrinkles: true,
      hydration: true,
      texture: true,
      aiSummary: true,
      annotations: true,
      scores: true,
    },
  });

  const recentScans = await db.query.scans.findMany({
    where: eq(scans.userId, userId),
    orderBy: [desc(scans.createdAt)],
    limit: 5,
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
      annotations: true,
      scores: true,
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

  const recentDailyLogs = await db.query.dailyLogs.findMany({
    where: eq(dailyLogs.userId, userId),
    orderBy: [desc(dailyLogs.date)],
    limit: 5,
    columns: {
      id: true,
      userId: true,
      date: true,
      amRoutine: true,
      pmRoutine: true,
      mood: true,
      sleepHours: true,
      stressLevel: true,
      waterGlasses: true,
      journalEntry: true,
      routineAmSteps: true,
      routinePmSteps: true,
    },
  });

  const routineAmLabels = coerceRoutinePlanList(user?.routinePlanAmItems);
  const routinePmLabels = coerceRoutinePlanList(user?.routinePlanPmItems);

  const patientContext = buildPatientContext({
    userName: user?.name ?? "Patient",
    routineAmLabels,
    routinePmLabels,
    latestScan,
    recentScans,
    recentVisitNotes,
    recentDailyLogs,
    upcomingEvents,
    nextAppointment,
    reminders,
  });

  const systemPrompt = ASSISTANT_SYSTEM[normalizedAssistant];

  const model =
    process.env.OPENAI_CHAT_MODEL?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    "gpt-4o-mini";

  const openaiBaseUrl = process.env.OPENAI_BASE_URL?.trim();

  const openai = new OpenAI(
    openaiBaseUrl
      ? {
          apiKey: openaiKey,
          baseURL: openaiBaseUrl,
        }
      : { apiKey: openaiKey }
  );

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

