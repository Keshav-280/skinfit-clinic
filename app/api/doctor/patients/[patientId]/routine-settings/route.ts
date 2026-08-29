import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/src/db";
import { users } from "@/src/db/schema";
import { getDoctorPortalUserId } from "@/src/lib/auth/doctor-access";
import { sendDoctorPatientChatMessage } from "@/src/lib/clinicSupportChat";
import {
  isValidHm,
  normalizeIanaTimeZone,
} from "@/src/lib/timeZoneWallClock";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ patientId: string }> }
) {
  const staffId = await getDoctorPortalUserId();
  if (!staffId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { patientId } = await ctx.params;
  if (!patientId) {
    return NextResponse.json({ error: "INVALID" }, { status: 400 });
  }

  const existing = await db.query.users.findFirst({
    where: and(eq(users.id, patientId), eq(users.role, "patient")),
    columns: {
      id: true,
      timezone: true,
      routineRemindersEnabled: true,
      routineAmReminderHm: true,
      routinePmReminderHm: true,
      routineAmReminderLastSentYmd: true,
      routinePmReminderLastSentYmd: true,
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const body = (await req.json().catch(() => null)) as Partial<{
    routineRemindersEnabled: boolean;
    routineAmReminderHm: string;
    routinePmReminderHm: string;
    timezone: string;
  }> | null;

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  let nextTz = existing.timezone;
  let nextAm = existing.routineAmReminderHm ?? "08:30";
  let nextPm = existing.routinePmReminderHm ?? "22:00";
  let nextEnabled = existing.routineRemindersEnabled;
  let resetAm = false;
  let resetPm = false;

  if ("timezone" in body && typeof body.timezone === "string") {
    const t = normalizeIanaTimeZone(body.timezone.trim());
    if (t !== nextTz) {
      nextTz = t;
      resetAm = true;
      resetPm = true;
    }
  }

  if ("routineRemindersEnabled" in body) {
    if (typeof body.routineRemindersEnabled !== "boolean") {
      return NextResponse.json({ error: "INVALID_FLAG" }, { status: 400 });
    }
    nextEnabled = body.routineRemindersEnabled;
  }

  if ("routineAmReminderHm" in body) {
    if (
      typeof body.routineAmReminderHm !== "string" ||
      !isValidHm(body.routineAmReminderHm)
    ) {
      return NextResponse.json({ error: "INVALID_AM_HM" }, { status: 400 });
    }
    const v = body.routineAmReminderHm.trim();
    if (v !== nextAm) {
      nextAm = v;
      resetAm = true;
    }
  }

  if ("routinePmReminderHm" in body) {
    if (
      typeof body.routinePmReminderHm !== "string" ||
      !isValidHm(body.routinePmReminderHm)
    ) {
      return NextResponse.json({ error: "INVALID_PM_HM" }, { status: 400 });
    }
    const v = body.routinePmReminderHm.trim();
    if (v !== nextPm) {
      nextPm = v;
      resetPm = true;
    }
  }

  await db
    .update(users)
    .set({
      timezone: nextTz,
      routineRemindersEnabled: nextEnabled,
      routineAmReminderHm: nextAm,
      routinePmReminderHm: nextPm,
      routineAmReminderLastSentYmd: resetAm
        ? null
        : existing.routineAmReminderLastSentYmd,
      routinePmReminderLastSentYmd: resetPm
        ? null
        : existing.routinePmReminderLastSentYmd,
    })
    .where(eq(users.id, patientId));

  try {
    await sendDoctorPatientChatMessage({
      patientId,
      staffId,
      text: `Your clinic updated routine reminders: AM ${nextAm}, PM ${nextPm} (${nextTz}). Reminders are ${nextEnabled ? "on" : "off"}.`,
      pushTitle: "SkinFit — routine reminders updated",
    });
  } catch (e) {
    console.warn("[routine-settings] notify failed", patientId, e);
  }

  return NextResponse.json({ ok: true });
}
