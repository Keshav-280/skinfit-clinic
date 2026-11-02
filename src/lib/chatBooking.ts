import "server-only";

import { and, asc, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/src/db";
import {
  appointmentRequests,
  appointments,
  chatMessages,
  chatThreads,
  doctorSlots,
  users,
} from "@/src/db/schema";
import { notifyChatThreadUpdated } from "@/src/lib/chatLive";
import { createAppointmentRequest } from "@/src/lib/appointmentRequests";
import { slotDateAndHmToUtcInstant } from "@/src/lib/clinicSlotUtcInstant";
import { dateOnlyFromYmd, localCalendarYmd, ymdFromDateOnly } from "@/src/lib/date-only";
import { patientDoctorLabel } from "@/src/lib/doctorDisplayName";
import {
  getAssignedDoctorIdForPatient,
  listRegisteredClinicDoctors,
} from "@/src/lib/doctorPatientCare";
import { ensurePatientPhoneForBooking } from "@/src/lib/ensurePatientPhoneForBooking";
import { formatSlotTimeRange } from "@/src/lib/slotTimeHm";

/** How far ahead kAI looks for open slots, and how many it offers at once. */
const LOOKAHEAD_DAYS = 30;
const MAX_SLOTS_OFFERED = 6;

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function dayLabel(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dow = new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
  return `${WEEKDAYS[dow]} ${d} ${MONTHS[m! - 1]}`;
}

function twelveHour(hm: string): string {
  const [h, m] = hm.split(":").map(Number);
  const suffix = h! >= 12 ? "PM" : "AM";
  const h12 = h! % 12 === 0 ? 12 : h! % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export type OfferedSlot = {
  slot_id: string;
  doctor_id: string;
  doctor: string;
  /** e.g. "Tue 4 Nov" */
  day: string;
  date: string;
  /** e.g. "11:00 AM - 11:30 AM" */
  time: string;
};

/**
 * Open slots the patient could ask for: in the future, with any clinic doctor (the patient's
 * own doctor first), not already booked and not already requested by
 * someone else. Same visibility rules as the Schedules page.
 */
async function doctorsForPatient(userId: string) {
  const [assignedId, registered] = await Promise.all([
    getAssignedDoctorIdForPatient(userId),
    listRegisteredClinicDoctors(),
  ]);
  // Same as the Schedules page: any clinic doctor can be booked. The patient's own doctor
  // comes first so their slots are offered first.
  return [...registered].sort(
    (a, b) => Number(b.id === assignedId) - Number(a.id === assignedId)
  );
}

/** Re-checks one slot from scratch: right doctor for this patient, in the future, still free. */
async function findOfferableSlot(userId: string, slotId: string): Promise<OfferedSlot | null> {
  const doctors = await doctorsForPatient(userId);
  const row = await db.query.doctorSlots.findFirst({
    where: eq(doctorSlots.id, slotId),
    columns: { id: true, doctorId: true, slotDate: true, slotTimeHm: true, slotEndTimeHm: true },
  });
  if (!row) return null;
  const doctor = doctors.find((d) => d.id === row.doctorId);
  if (!doctor) return null;
  const start = slotDateAndHmToUtcInstant(row.slotDate, row.slotTimeHm);
  if (!start || start.getTime() <= Date.now()) return null;
  return toOffered(row, patientDoctorLabel(doctor.name));
}

function toOffered(
  r: { id: string; doctorId: string; slotDate: Date; slotTimeHm: string; slotEndTimeHm: string | null },
  doctorLabel: string
): OfferedSlot {
  const ymd = ymdFromDateOnly(r.slotDate);
  return {
    slot_id: r.id,
    doctor_id: r.doctorId,
    doctor: doctorLabel,
    day: dayLabel(ymd),
    date: ymd,
    time: formatSlotTimeRange(r.slotTimeHm, r.slotEndTimeHm ?? null)
      .split(/\s*[-–]\s*/)
      .map((t) => (/^\d{1,2}:\d{2}$/.test(t.trim()) ? twelveHour(t.trim()) : t.trim()))
      .join(" - "),
  };
}

export async function listOpenSlotsForPatient(
  userId: string,
  opts: { fromYmd?: string; toYmd?: string; partOfDay?: "morning" | "afternoon" | "evening" } = {}
): Promise<OfferedSlot[]> {
  const doctorList = await doctorsForPatient(userId);
  if (doctorList.length === 0) return [];
  const nameById = new Map(doctorList.map((d) => [d.id, patientDoctorLabel(d.name)]));
  const ids = doctorList.map((d) => d.id);

  const todayYmd = localCalendarYmd();
  const fromYmd = opts.fromYmd && opts.fromYmd > todayYmd ? opts.fromYmd : todayYmd;
  const limitDate = new Date(dateOnlyFromYmd(todayYmd).getTime() + LOOKAHEAD_DAYS * 86_400_000);
  const toDate = opts.toYmd ? dateOnlyFromYmd(opts.toYmd) : limitDate;

  const rows = await db.query.doctorSlots.findMany({
    where: and(
      inArray(doctorSlots.doctorId, ids),
      gte(doctorSlots.slotDate, dateOnlyFromYmd(fromYmd)),
      lte(doctorSlots.slotDate, toDate < limitDate ? toDate : limitDate)
    ),
    orderBy: [asc(doctorSlots.slotDate), asc(doctorSlots.slotTimeHm)],
    columns: { id: true, doctorId: true, slotDate: true, slotTimeHm: true, slotEndTimeHm: true },
  });
  console.info(
    `[kai] slot lookup: ${ids.length} doctor(s), ${rows.length} slot(s) between ${fromYmd} and ${ymdFromDateOnly(toDate < limitDate ? toDate : limitDate)}`
  );
  if (rows.length === 0) return [];

  const [booked, pending] = await Promise.all([
    db.query.appointments.findMany({
      where: and(inArray(appointments.doctorId, ids), eq(appointments.status, "scheduled")),
      columns: { doctorId: true, dateTime: true },
    }),
    db.query.appointmentRequests.findMany({
      where: and(
        inArray(appointmentRequests.doctorSlotId, rows.map((r) => r.id)),
        eq(appointmentRequests.status, "pending")
      ),
      columns: { doctorSlotId: true },
    }),
  ]);
  const bookedKeys = new Set(booked.map((b) => `${b.doctorId}|${b.dateTime.getTime()}`));
  const pendingSlotIds = new Set(pending.map((p) => p.doctorSlotId));

  const now = Date.now();
  const out: OfferedSlot[] = [];
  const seenTimes = new Set<string>();
  for (const r of rows) {
    const start = slotDateAndHmToUtcInstant(r.slotDate, r.slotTimeHm);
    if (!start || start.getTime() <= now) continue;
    if (bookedKeys.has(`${r.doctorId}|${start.getTime()}`) || pendingSlotIds.has(r.id)) continue;
    const hour = Number(r.slotTimeHm.split(":")[0]);
    if (opts.partOfDay === "morning" && hour >= 12) continue;
    if (opts.partOfDay === "afternoon" && (hour < 12 || hour >= 17)) continue;
    if (opts.partOfDay === "evening" && hour < 17) continue;
    // A clinic visit, not a doctor: if several doctors are free at the same time, offer it once.
    const timeKey = `${ymdFromDateOnly(r.slotDate)}|${r.slotTimeHm}`;
    if (seenTimes.has(timeKey)) continue;
    seenTimes.add(timeKey);
    out.push(toOffered(r, nameById.get(r.doctorId) ?? "the clinic"));
    if (out.length >= MAX_SLOTS_OFFERED) break;
  }
  console.info(`[kai] slot lookup: ${out.length} open after removing past, booked and held slots`);
  return out;
}

const YES =
  /\b(yes|yeah|yep|yup|sure|ok|okay|confirm|confirmed|book|book it|go ahead|please do|do it|send it|proceed|haan|ha|theek hai|thik hai|done|correct|right)\b/i;
const NO = /\b(no|nope|nahi|don'?t|do not|cancel|stop|wait|not yet|change|different)\b/i;

/**
 * The patient's own last message must be a clear yes before a request is sent. The model is
 * told to ask first, but this makes it impossible for it to skip that step.
 */
export function isClearConfirmation(message: string): boolean {
  const t = message.trim();
  if (!t || t.split(/\s+/).length > 14) return false;
  return YES.test(t) && !NO.test(t);
}

/** Tools offered to kAI (OpenAI function-calling format). */
export const KAI_BOOKING_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "get_open_visit_times",
      description:
        "Look up the clinic's real open visit times. Call this when the patient wants to book a clinic visit, after you know what it is for. Never offer a time that this tool did not return.",
      parameters: {
        type: "object",
        properties: {
          from_date: { type: "string", description: "Earliest day, YYYY-MM-DD. Optional." },
          to_date: { type: "string", description: "Latest day, YYYY-MM-DD. Optional." },
          part_of_day: { type: "string", enum: ["morning", "afternoon", "evening"], description: "Optional." },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "request_clinic_visit",
      description:
        "Send a clinic visit request for ONE time returned by get_open_visit_times. Only call this after you have told the patient the exact day and time and they have clearly said yes in their latest message. The clinic confirms the request afterwards; it is not a confirmed booking.",
      parameters: {
        type: "object",
        properties: {
          slot_id: { type: "string", description: "slot_id exactly as returned by the lookup." },
          issue: { type: "string", description: "What the visit is for, a few words, e.g. 'Acne on cheeks'." },
          why: { type: "string", description: "Short extra detail, e.g. 'Been 2 weeks'. Optional." },
          phone: { type: "string", description: "Patient's mobile number, only if the tool asked for it and they gave it." },
          phone_country_code: { type: "string", description: "e.g. +91. Optional." },
        },
        required: ["slot_id", "issue"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "send_visit_request_to_clinic_team",
      description:
        "Fallback for when there are no open times (or none suit the patient): pass the patient's preferred day and time to the clinic team in Clinic Support so staff can call back and fix a time. Only call after the patient clearly said yes in their latest message to you sending it.",
      parameters: {
        type: "object",
        properties: {
          preferred_day: { type: "string", description: "In the patient's words, e.g. 'this Saturday' or '8 Nov'." },
          preferred_time: { type: "string", description: "In the patient's words, e.g. 'after 5 pm' or 'morning'." },
          issue: { type: "string", description: "What the visit is for, a few words." },
          why: { type: "string", description: "Short extra detail. Optional." },
          phone: { type: "string", description: "Patient's mobile number, only if they gave it. Optional." },
        },
        required: ["preferred_day", "preferred_time", "issue"],
      },
    },
  },
];

type ToolResult = Record<string, unknown>;

const clip = (v: unknown, max: number): string =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

/** Posts the visit request into the patient's Clinic Support thread, where staff already look. */
async function postVisitRequestToClinicSupport(userId: string, text: string): Promise<void> {
  const [thread] = await db
    .select({ id: chatThreads.id })
    .from(chatThreads)
    .where(and(eq(chatThreads.userId, userId), eq(chatThreads.assistantId, "support")))
    .orderBy(desc(chatThreads.createdAt))
    .limit(1);
  const threadId =
    thread?.id ??
    (await db.insert(chatThreads).values({ userId, assistantId: "support" }).returning({ id: chatThreads.id }))[0]?.id;
  if (!threadId) throw new Error("THREAD_CREATE_FAILED");
  await db.insert(chatMessages).values({ threadId, sender: "patient", text, isUrgent: false });
  await notifyChatThreadUpdated(threadId);
}

/** Phone number as the Schedules form handles it: use the one on file, or take one given in chat. */
async function resolvePhone(userId: string, given: { phone?: unknown; phoneCountryCode?: unknown }) {
  const [patient] = await db
    .select({ phone: users.phone, phoneCountryCode: users.phoneCountryCode })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return ensurePatientPhoneForBooking({
    userId,
    existingPhone: patient?.phone,
    existingCountryCode: patient?.phoneCountryCode,
    bodyPhone: given.phone,
    bodyPhoneCountryCode: given.phoneCountryCode,
  });
}

const NOT_CONFIRMED = {
  error: "NOT_CONFIRMED",
  instruction:
    "The patient has not clearly said yes yet. Repeat what you will send (day and time, or their preferred day and time) and ask: shall I send this?",
};

/** Runs one tool call for the signed-in patient. Never throws; errors come back as data. */
export async function runKaiBookingTool(
  name: string,
  rawArgs: string,
  ctx: { userId: string; latestUserMessage: string }
): Promise<ToolResult> {
  let args: Record<string, unknown> = {};
  try {
    args = rawArgs ? (JSON.parse(rawArgs) as Record<string, unknown>) : {};
  } catch {
    return { error: "BAD_ARGUMENTS" };
  }

  try {
    if (name === "get_open_visit_times") {
      const ymd = /^\d{4}-\d{2}-\d{2}$/;
      const slots = await listOpenSlotsForPatient(ctx.userId, {
        fromYmd: typeof args.from_date === "string" && ymd.test(args.from_date) ? args.from_date : undefined,
        toYmd: typeof args.to_date === "string" && ymd.test(args.to_date) ? args.to_date : undefined,
        partOfDay:
          args.part_of_day === "morning" || args.part_of_day === "afternoon" || args.part_of_day === "evening"
            ? args.part_of_day
            : undefined,
      });
      // The patient books a clinic visit, so no doctor is named.
      return slots.length > 0
        ? { times: slots.map((s) => ({ slot_id: s.slot_id, day: s.day, date: s.date, time: s.time })) }
        : {
            times: [],
            instruction:
              "No open times in this window. Offer to pass their preferred day and time to the clinic team (ask for both, then ask if you should send it), using send_visit_request_to_clinic_team.",
          };
    }

    if (name === "request_clinic_visit") {
      if (!isClearConfirmation(ctx.latestUserMessage)) return NOT_CONFIRMED;
      const slotId = clip(args.slot_id, 80);
      const slot = slotId ? await findOfferableSlot(ctx.userId, slotId) : null;
      if (!slot) {
        return { error: "UNKNOWN_SLOT", instruction: "Look up the open times again and offer one of those." };
      }
      const issue = clip(args.issue, 200);
      if (!issue) {
        return { error: "ISSUE_REQUIRED", instruction: "Ask what the visit is for (a few words, e.g. Acne on cheeks)." };
      }

      const phone = await resolvePhone(ctx.userId, {
        phone: args.phone,
        phoneCountryCode: args.phone_country_code,
      });
      if (!phone.ok) {
        return {
          error: phone.error,
          instruction:
            phone.error === "INVALID_PHONE"
              ? "That number does not look valid. Ask for a 10-digit mobile number again."
              : "Ask for their 10-digit mobile number so the clinic can reach them, then try again with it.",
        };
      }

      const result = await createAppointmentRequest({
        patientId: ctx.userId,
        doctorId: slot.doctor_id,
        doctorSlotId: slot.slot_id,
        issue,
        why: clip(args.why, 300) || "Requested through kAI chat",
      });
      if (!result.ok) {
        const taken = result.error === "SLOT_ALREADY_BOOKED" || result.error === "SLOT_REQUEST_PENDING";
        return {
          error: result.error,
          instruction: taken
            ? "That time was just taken. Look up the open times again and offer another."
            : "Something went wrong. Apologise briefly and point them to Clinic Support (headset icon).",
        };
      }
      return {
        ok: true,
        status: "REQUEST_SENT_AWAITING_CLINIC_CONFIRMATION",
        day: slot.day,
        time: slot.time,
        instruction:
          "Say the visit request is sent for that day and time and the clinic will confirm shortly (they will also see a message in Clinic Support). Do NOT say it is booked or confirmed.",
      };
    }

    if (name === "send_visit_request_to_clinic_team") {
      if (!isClearConfirmation(ctx.latestUserMessage)) return NOT_CONFIRMED;
      const day = clip(args.preferred_day, 80);
      const time = clip(args.preferred_time, 80);
      const issue = clip(args.issue, 200);
      if (!day || !time || !issue) {
        return {
          error: "DETAILS_MISSING",
          instruction: "Ask for whatever is missing: preferred day, preferred time of day, and what the visit is for.",
        };
      }
      const why = clip(args.why, 300);
      const phone = await resolvePhone(ctx.userId, { phone: args.phone });
      const text = [
        "Clinic visit request from kAI chat (no open times were available).",
        `Preferred day: ${day}`,
        `Preferred time: ${time}`,
        `Reason: ${issue}${why ? ` (${why})` : ""}`,
        phone.ok ? `Phone: ${phone.phoneCountryCode} ${phone.phone}` : "Phone: not on file",
        "Please call or message to confirm a time.",
      ].join("\n");
      await postVisitRequestToClinicSupport(ctx.userId, text);
      return {
        ok: true,
        status: "PASSED_TO_CLINIC_TEAM",
        instruction:
          "Say you have passed their preferred day and time to the clinic team, who will get back to them to confirm. Do NOT say a time is booked.",
      };
    }
  } catch (err) {
    console.warn("[kai] booking tool failed", name, err instanceof Error ? err.message : err);
    return {
      error: "TOOL_FAILED",
      instruction: "Apologise briefly and point them to Clinic Support (headset icon) to book.",
    };
  }
  return { error: "UNKNOWN_TOOL" };
}
