import { NextResponse } from "next/server";
import { and, eq, desc, inArray, asc } from "drizzle-orm";
import { db } from "@/src/db";
import {
  users,
  doctorSlots,
  appointmentRequests,
  appointments,
} from "@/src/db/schema";
import { DEMO_LOGIN_EMAIL } from "@/src/lib/auth/demo-login";
import {
  parseYmdToDateOnly,
  ymdFromDateOnly,
  localCalendarYmd,
} from "@/src/lib/date-only";
import {
  clinicCancellationChatMessage,
  clinicCancellationKindFromRequestRow,
} from "@/src/lib/clinicCancellationNotice";
import { formatPatientAppointmentConfirmationMessage } from "@/src/lib/patientGoogleCalendarHelp";
import { notifyPatientAppointmentEmail } from "@/src/lib/email/notifyPatientAppointmentEmail";
import { sendClinicSupportMessage } from "@/src/lib/clinicSupportChat";

const APPOINTMENT_CONFIRM_EMAIL_SUBJECT = "SkinnFit Clinic — Appointment confirmed";
const APPOINTMENT_UPDATE_EMAIL_SUBJECT = "SkinnFit Clinic — Appointment update";
import { CLINIC_DOCTOR_EMAIL } from "@/src/lib/clinicDoctor";
import { slotDateAndHmToUtcInstant } from "@/src/lib/clinicSlotUtcInstant";
import { isValidSlotEndAfterStart } from "@/src/lib/slotTimeHm";

const DEV_DOCTOR_EMAIL = CLINIC_DOCTOR_EMAIL;
const HM = /^([01]\d|2[0-3]):([0-5]\d)$/;
const ACTIONS = [
  "seedPending",
  "upsertSlot",
  "listSlots",
  "deleteSlot",
  "listPending",
  "approveLatest",
  "approveRequest",
  "cancelLatest",
  "cancelRequest",
] as const;
type DevAction = (typeof ACTIONS)[number];

function parseBodySlotEndHm(
  raw: unknown,
  startHm: string
): { ok: true; value: string | null | undefined } | { ok: false; error: string } {
  if (raw === undefined) return { ok: true, value: undefined };
  if (raw === null || raw === "") return { ok: true, value: null };
  if (typeof raw !== "string") return { ok: false, error: "INVALID_slotEndTimeHm" };
  const t = raw.trim();
  if (!t) return { ok: true, value: null };
  if (!HM.test(t)) return { ok: false, error: "INVALID_slotEndTimeHm" };
  if (!isValidSlotEndAfterStart(startHm, t)) {
    return { ok: false, error: "slotEndTimeHm_must_be_after_start" };
  }
  return { ok: true, value: t };
}

async function slotYmdHmForDoctorSlotId(doctorSlotId: string) {
  const [slot] = await db
    .select({
      slotDate: doctorSlots.slotDate,
      slotTimeHm: doctorSlots.slotTimeHm,
      slotEndTimeHm: doctorSlots.slotEndTimeHm,
    })
    .from(doctorSlots)
    .where(eq(doctorSlots.id, doctorSlotId))
    .limit(1);
  if (!slot) {
    return {
      slotYmd: null as string | null,
      slotTimeHm: null as string | null,
      slotEndTimeHm: null as string | null,
    };
  }
  return {
    slotYmd: ymdFromDateOnly(slot.slotDate),
    slotTimeHm: slot.slotTimeHm,
    slotEndTimeHm: slot.slotEndTimeHm ?? null,
  };
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  const action: DevAction | null =
    (() => {
      const maybeAction = (body as Record<string, unknown>).action;
      if (typeof maybeAction !== "string") return null;
      if (!ACTIONS.includes(maybeAction as DevAction)) return null;
      return maybeAction as DevAction;
    })();
  if (!action) return NextResponse.json({ error: "INVALID_action" }, { status: 400 });

  const input = body as {
    action: DevAction;
    doctorId?: string;
    patientId?: string;
    slotDate?: string;
    slotTimeHm?: string;
    slotEndTimeHm?: string | null;
    title?: string;
    issue?: string;
    why?: string;
    reason?: string;
    requestId?: string;
    doctorSlotId?: string;
  };

  const [demoPatient] = await db
    .select()
    .from(users)
    .where(eq(users.email, DEMO_LOGIN_EMAIL))
    .limit(1);

  const [demoDoctor] = await db
    .select()
    .from(users)
    .where(eq(users.email, DEV_DOCTOR_EMAIL))
    .limit(1);

  if (!demoPatient || !demoDoctor) {
    return NextResponse.json(
      { error: "DEMO_USERS_MISSING" },
      { status: 500 }
    );
  }

  const doctorId = input.doctorId ?? demoDoctor.id;
  const patientId = input.patientId ?? demoPatient.id;

  if (input.action === "seedPending") {
    const slotDateStr = input.slotDate ?? localCalendarYmd();
    const slotDate = parseYmdToDateOnly(slotDateStr);
    if (!slotDate) {
      return NextResponse.json({ error: "INVALID_slotDate" }, { status: 400 });
    }

    const slotTimeHm = input.slotTimeHm ?? "10:30";
    if (!slotDateAndHmToUtcInstant(slotDate, slotTimeHm)) {
      return NextResponse.json({ error: "INVALID_slotTimeHm" }, { status: 400 });
    }

    const parsedEnd = parseBodySlotEndHm(input.slotEndTimeHm, slotTimeHm);
    if (!parsedEnd.ok) {
      return NextResponse.json({ error: parsedEnd.error }, { status: 400 });
    }

    const title = input.title ?? "Consultation";
    const issue = input.issue ?? "Acne on cheeks";
    const why = input.why ?? "Been 2 weeks";

    const seedConflictSet: { title: string; updatedAt: Date; slotEndTimeHm?: string | null } = {
      title,
      updatedAt: new Date(),
    };
    if (parsedEnd.value !== undefined) {
      seedConflictSet.slotEndTimeHm = parsedEnd.value;
    }

    // Upsert the slot
    const [slot] = await db
      .insert(doctorSlots)
      .values({
        doctorId,
        slotDate,
        slotTimeHm,
        slotEndTimeHm: parsedEnd.value === undefined ? null : parsedEnd.value,
        title,
      })
      .onConflictDoUpdate({
        target: [doctorSlots.doctorId, doctorSlots.slotDate, doctorSlots.slotTimeHm],
        set: seedConflictSet,
      })
      .returning({ id: doctorSlots.id });

    // Prevent duplicates: if the patient already has a pending/approved request for this slot, return it.
    const [existing] = await db
      .select()
      .from(appointmentRequests)
      .where(
        and(
          eq(appointmentRequests.patientId, patientId),
          eq(appointmentRequests.doctorId, doctorId),
          eq(appointmentRequests.doctorSlotId, slot.id),
          inArray(appointmentRequests.status, ["pending", "approved"])
        )
      )
      .limit(1);

    if (existing) {
      return NextResponse.json({
        ok: true,
        duplicated: true,
        doctorId,
        patientId,
        doctorSlotId: slot.id,
        requestId: existing.id,
        status: existing.status,
      });
    }

    const [reqRow] = await db
      .insert(appointmentRequests)
      .values({
        patientId,
        doctorId,
        doctorSlotId: slot.id,
        issue,
        why,
        status: "pending",
      })
      .returning({
        id: appointmentRequests.id,
        status: appointmentRequests.status,
      });

    return NextResponse.json({
      ok: true,
      action: "seedPending",
      doctorId,
      patientId,
      doctorSlotId: slot.id,
      requestId: reqRow.id,
      status: reqRow.status,
    });
  }

  if (input.action === "upsertSlot") {
    const slotDateStr = input.slotDate ?? localCalendarYmd();
    const slotDate = parseYmdToDateOnly(slotDateStr);
    if (!slotDate) return NextResponse.json({ error: "INVALID_slotDate" }, { status: 400 });

    const slotTimeHm = input.slotTimeHm ?? "10:30";
    if (!slotDateAndHmToUtcInstant(slotDate, slotTimeHm)) {
      return NextResponse.json({ error: "INVALID_slotTimeHm" }, { status: 400 });
    }

    const parsedEndUpsert = parseBodySlotEndHm(input.slotEndTimeHm, slotTimeHm);
    if (!parsedEndUpsert.ok) {
      return NextResponse.json({ error: parsedEndUpsert.error }, { status: 400 });
    }

    const title = input.title ?? "Consultation";

    const upsertConflictSet: { title: string; updatedAt: Date; slotEndTimeHm?: string | null } = {
      title,
      updatedAt: new Date(),
    };
    if (parsedEndUpsert.value !== undefined) {
      upsertConflictSet.slotEndTimeHm = parsedEndUpsert.value;
    }

    const [slot] = await db
      .insert(doctorSlots)
      .values({
        doctorId,
        slotDate,
        slotTimeHm,
        slotEndTimeHm: parsedEndUpsert.value === undefined ? null : parsedEndUpsert.value,
        title,
      })
      .onConflictDoUpdate({
        target: [doctorSlots.doctorId, doctorSlots.slotDate, doctorSlots.slotTimeHm],
        set: upsertConflictSet,
      })
      .returning({ id: doctorSlots.id });

    return NextResponse.json({
      ok: true,
      action: "upsertSlot",
      doctorId,
      doctorSlotId: slot?.id ?? null,
    });
  }

  if (input.action === "listSlots") {
    const rows = await db
      .select({
        id: doctorSlots.id,
        slotDate: doctorSlots.slotDate,
        slotTimeHm: doctorSlots.slotTimeHm,
        slotEndTimeHm: doctorSlots.slotEndTimeHm,
        title: doctorSlots.title,
      })
      .from(doctorSlots)
      .where(eq(doctorSlots.doctorId, doctorId))
      .orderBy(desc(doctorSlots.slotDate), asc(doctorSlots.slotTimeHm))
      .limit(400);

    return NextResponse.json({
      ok: true,
      action: "listSlots",
      doctorId,
      slots: rows.map((r) => ({
        id: r.id,
        slotDate: ymdFromDateOnly(r.slotDate),
        slotTimeHm: r.slotTimeHm,
        slotEndTimeHm: r.slotEndTimeHm ?? null,
        title: r.title,
      })),
    });
  }

  if (input.action === "deleteSlot") {
    const doctorSlotId =
      typeof input.doctorSlotId === "string" ? input.doctorSlotId : null;
    if (!doctorSlotId) {
      return NextResponse.json({ error: "doctorSlotId_required" }, { status: 400 });
    }

    const [slotRow] = await db
      .select({
        id: doctorSlots.id,
        slotDate: doctorSlots.slotDate,
        slotTimeHm: doctorSlots.slotTimeHm,
        slotEndTimeHm: doctorSlots.slotEndTimeHm,
      })
      .from(doctorSlots)
      .where(and(eq(doctorSlots.id, doctorSlotId), eq(doctorSlots.doctorId, doctorId)))
      .limit(1);

    if (!slotRow) {
      return NextResponse.json({ error: "SLOT_NOT_FOUND" }, { status: 404 });
    }

    const slotYmd = ymdFromDateOnly(slotRow.slotDate);
    const slotTimeHm = slotRow.slotTimeHm;
    const slotEndTimeHm = slotRow.slotEndTimeHm ?? null;
    const slotRemovalReason = (
      typeof input.reason === "string" ? input.reason : ""
    ).trim();
    const reason =
      slotRemovalReason ||
      "This time slot was removed from the clinic schedule.";

    // Note: `db.transaction()` is unreliable with Drizzle + Neon HTTP driver
    // (`neon()`); use ordered single statements instead.
    try {
      const reqs = await db
        .select({
          id: appointmentRequests.id,
          patientId: appointmentRequests.patientId,
          appointmentId: appointmentRequests.appointmentId,
          status: appointmentRequests.status,
        })
        .from(appointmentRequests)
        .where(eq(appointmentRequests.doctorSlotId, doctorSlotId));

      const slotDt = slotDateAndHmToUtcInstant(slotRow.slotDate, slotRow.slotTimeHm);

      const matchingAppts =
        slotDt ?
          await db
            .select({
              id: appointments.id,
              userId: appointments.userId,
            })
            .from(appointments)
            .where(
              and(
                eq(appointments.doctorId, doctorId),
                eq(appointments.dateTime, slotDt),
                inArray(appointments.status, ["scheduled", "completed"])
              )
            )
        : [];

      const linkedApptIds = new Set(
        reqs
          .map((r) => r.appointmentId)
          .filter((id): id is string => typeof id === "string" && id.length > 0)
      );

      const notifiedUserIds = new Set<string>();

      for (const r of reqs) {
        if (r.status === "cancelled") continue;
        const slotCancelMd = clinicCancellationChatMessage({
          kind: clinicCancellationKindFromRequestRow(r),
          slotYmd,
          slotTimeHm,
          slotEndTimeHm,
          reason,
        });
        try {
          await sendClinicSupportMessage({
            patientId: r.patientId,
            text: slotCancelMd,
          });
          notifiedUserIds.add(r.patientId);
        } catch (notifyErr) {
          console.error("clinic-dev deleteSlot notify (request):", notifyErr);
        }
        void notifyPatientAppointmentEmail({
          patientId: r.patientId,
          subject: APPOINTMENT_UPDATE_EMAIL_SUBJECT,
          markdownBody: slotCancelMd,
        });
      }

      for (const appt of matchingAppts) {
        if (linkedApptIds.has(appt.id)) continue;
        if (notifiedUserIds.has(appt.userId)) continue;
        const orphanCancelMd = clinicCancellationChatMessage({
          kind: "confirmed_visit",
          slotYmd,
          slotTimeHm,
          slotEndTimeHm,
          reason,
        });
        try {
          await sendClinicSupportMessage({
            patientId: appt.userId,
            text: orphanCancelMd,
          });
          notifiedUserIds.add(appt.userId);
        } catch (notifyErr) {
          console.error("clinic-dev deleteSlot notify (orphan appt):", notifyErr);
        }
        void notifyPatientAppointmentEmail({
          patientId: appt.userId,
          subject: APPOINTMENT_UPDATE_EMAIL_SUBJECT,
          markdownBody: orphanCancelMd,
        });
      }

      const apptIds = [
        ...new Set(
          reqs
            .map((r) => r.appointmentId)
            .filter((id): id is string => typeof id === "string" && id.length > 0)
        ),
      ];

      if (apptIds.length > 0) {
        await db.delete(appointments).where(inArray(appointments.id, apptIds));
      }

      if (slotDt) {
        await db
          .delete(appointments)
          .where(
            and(eq(appointments.doctorId, doctorId), eq(appointments.dateTime, slotDt))
          );
      }

      await db
        .delete(appointmentRequests)
        .where(eq(appointmentRequests.doctorSlotId, doctorSlotId));

      await db
        .delete(doctorSlots)
        .where(and(eq(doctorSlots.id, doctorSlotId), eq(doctorSlots.doctorId, doctorId)));
    } catch (err) {
      console.error("clinic-dev deleteSlot:", err);
      const message = err instanceof Error ? err.message : "DELETE_FAILED";
      return NextResponse.json({ ok: false, error: message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      action: "deleteSlot",
      doctorId,
      doctorSlotId,
    });
  }

  if (input.action === "listPending") {
    const rows = await db
      .select({
        requestId: appointmentRequests.id,
        patientId: appointmentRequests.patientId,
        issue: appointmentRequests.issue,
        why: appointmentRequests.why,
        status: appointmentRequests.status,
        cancelledReason: appointmentRequests.cancelledReason,
        slotId: doctorSlots.id,
        slotDate: doctorSlots.slotDate,
        slotTimeHm: doctorSlots.slotTimeHm,
        slotEndTimeHm: doctorSlots.slotEndTimeHm,
        slotTitle: doctorSlots.title,
        patientName: users.name,
        patientEmail: users.email,
      })
      .from(appointmentRequests)
      .innerJoin(doctorSlots, eq(appointmentRequests.doctorSlotId, doctorSlots.id))
      .innerJoin(users, eq(appointmentRequests.patientId, users.id))
      .where(
        and(
          eq(appointmentRequests.doctorId, doctorId),
          eq(appointmentRequests.status, "pending")
        )
      )
      .orderBy(desc(appointmentRequests.createdAt))
      .limit(200);

    return NextResponse.json({
      ok: true,
      action: "listPending",
      doctorId,
      requests: rows.map((r) => ({
        requestId: r.requestId,
        patientId: r.patientId,
        patient: { name: r.patientName, email: r.patientEmail },
        issue: r.issue,
        why: r.why,
        slot: {
          id: r.slotId,
          slotDate: ymdFromDateOnly(r.slotDate),
          slotTimeHm: r.slotTimeHm,
          slotEndTimeHm: r.slotEndTimeHm ?? null,
          title: r.slotTitle,
        },
        status: r.status,
        cancelledReason: r.cancelledReason,
      })),
    });
  }

  if (input.action === "approveLatest") {
    // Latest pending request for this doctor.
    const [reqRow] = await db
      .select({
        id: appointmentRequests.id,
        patientId: appointmentRequests.patientId,
        doctorId: appointmentRequests.doctorId,
        doctorSlotId: appointmentRequests.doctorSlotId,
        status: appointmentRequests.status,
      })
      .from(appointmentRequests)
      .where(
        and(eq(appointmentRequests.doctorId, doctorId), eq(appointmentRequests.status, "pending"))
      )
      .orderBy(desc(appointmentRequests.createdAt))
      .limit(1);

    if (!reqRow) {
      return NextResponse.json({ ok: true, action: "approveLatest", message: "No pending request found." });
    }

    const [slot] = await db
      .select({
        id: doctorSlots.id,
        slotDate: doctorSlots.slotDate,
        slotTimeHm: doctorSlots.slotTimeHm,
        slotEndTimeHm: doctorSlots.slotEndTimeHm,
      })
      .from(doctorSlots)
      .where(eq(doctorSlots.id, reqRow.doctorSlotId))
      .limit(1);

    if (!slot) {
      return NextResponse.json({ error: "SLOT_NOT_FOUND" }, { status: 404 });
    }

    const dateTime = slotDateAndHmToUtcInstant(slot.slotDate, slot.slotTimeHm);
    if (!dateTime) {
      return NextResponse.json({ error: "INVALID_SLOT_TIME" }, { status: 400 });
    }

    const [existing] = await db
      .select({ id: appointments.id })
      .from(appointments)
      .where(
        and(
          eq(appointments.doctorId, reqRow.doctorId),
          eq(appointments.dateTime, dateTime),
          eq(appointments.status, "scheduled")
        )
      )
      .limit(1);

    let appointmentId: string | null = null;
    let duplicated = false;
    if (existing) {
      duplicated = true;
    } else {
      const [appt] = await db
        .insert(appointments)
        .values({
          userId: reqRow.patientId,
          doctorId: reqRow.doctorId,
          dateTime,
          status: "scheduled",
          type: "consultation",
        })
        .returning({ id: appointments.id });

      await db
        .update(appointmentRequests)
        .set({
          status: "approved",
          approvedAt: new Date(),
          appointmentId: appt.id,
          updatedAt: new Date(),
        })
        .where(eq(appointmentRequests.id, reqRow.id));

      appointmentId = appt.id;
      const slotYmd = ymdFromDateOnly(slot.slotDate);
      const [docUser] = await db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, reqRow.doctorId))
        .limit(1);
      const confirmMd = formatPatientAppointmentConfirmationMessage({
        dateTimeUtc: dateTime,
        slotYmd,
        slotTimeHm: slot.slotTimeHm,
        slotEndTimeHm: slot.slotEndTimeHm ?? null,
        doctorNameRaw: docUser?.name,
      });
      await sendClinicSupportMessage({
        patientId: reqRow.patientId,
        text: confirmMd,
      });
      void notifyPatientAppointmentEmail({
        patientId: reqRow.patientId,
        subject: APPOINTMENT_CONFIRM_EMAIL_SUBJECT,
        markdownBody: confirmMd,
      });
    }

    return NextResponse.json({
      ok: true,
      action: "approveLatest",
      doctorId,
      patientId: reqRow.patientId,
      requestId: reqRow.id,
      appointmentId,
      duplicated,
    });
  }

  if (input.action === "approveRequest") {
    const requestId = input.requestId;
    if (!requestId) return NextResponse.json({ error: "requestId_required" }, { status: 400 });

    const [reqRow] = await db
      .select({
        id: appointmentRequests.id,
        patientId: appointmentRequests.patientId,
        doctorId: appointmentRequests.doctorId,
        doctorSlotId: appointmentRequests.doctorSlotId,
        status: appointmentRequests.status,
      })
      .from(appointmentRequests)
      .where(and(eq(appointmentRequests.id, requestId), eq(appointmentRequests.doctorId, doctorId)))
      .limit(1);

    if (!reqRow) return NextResponse.json({ ok: true, action: "approveRequest", message: "Request not found." });
    if (reqRow.status !== "pending") {
      return NextResponse.json({ ok: true, action: "approveRequest", message: "Request is not pending." });
    }

    const [slot] = await db
      .select({
        id: doctorSlots.id,
        slotDate: doctorSlots.slotDate,
        slotTimeHm: doctorSlots.slotTimeHm,
        slotEndTimeHm: doctorSlots.slotEndTimeHm,
      })
      .from(doctorSlots)
      .where(eq(doctorSlots.id, reqRow.doctorSlotId))
      .limit(1);

    if (!slot) return NextResponse.json({ error: "SLOT_NOT_FOUND" }, { status: 404 });

    const dateTime = slotDateAndHmToUtcInstant(slot.slotDate, slot.slotTimeHm);
    if (!dateTime) return NextResponse.json({ error: "INVALID_SLOT_TIME" }, { status: 400 });

    const [existing] = await db
      .select({ id: appointments.id })
      .from(appointments)
      .where(
        and(
          eq(appointments.doctorId, reqRow.doctorId),
          eq(appointments.dateTime, dateTime),
          eq(appointments.status, "scheduled")
        )
      )
      .limit(1);

    let appointmentId: string | null = null;
    let duplicated = false;
    if (existing) {
      duplicated = true;
    } else {
      const [appt] = await db
        .insert(appointments)
        .values({
          userId: reqRow.patientId,
          doctorId: reqRow.doctorId,
          dateTime,
          status: "scheduled",
          type: "consultation",
        })
        .returning({ id: appointments.id });

      await db
        .update(appointmentRequests)
        .set({
          status: "approved",
          approvedAt: new Date(),
          appointmentId: appt.id,
          updatedAt: new Date(),
        })
        .where(eq(appointmentRequests.id, reqRow.id));

      appointmentId = appt.id;
      const slotYmd = ymdFromDateOnly(slot.slotDate);
      const [docUser] = await db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, reqRow.doctorId))
        .limit(1);
      const confirmMdReq = formatPatientAppointmentConfirmationMessage({
        dateTimeUtc: dateTime,
        slotYmd,
        slotTimeHm: slot.slotTimeHm,
        slotEndTimeHm: slot.slotEndTimeHm ?? null,
        doctorNameRaw: docUser?.name,
      });
      await sendClinicSupportMessage({
        patientId: reqRow.patientId,
        text: confirmMdReq,
      });
      void notifyPatientAppointmentEmail({
        patientId: reqRow.patientId,
        subject: APPOINTMENT_CONFIRM_EMAIL_SUBJECT,
        markdownBody: confirmMdReq,
      });
    }

    return NextResponse.json({
      ok: true,
      action: "approveRequest",
      requestId: reqRow.id,
      appointmentId,
      duplicated,
    });
  }

  // cancelLatest
  if (input.action === "cancelLatest") {
    const [reqRow] = await db
      .select({
        id: appointmentRequests.id,
        patientId: appointmentRequests.patientId,
        doctorId: appointmentRequests.doctorId,
        doctorSlotId: appointmentRequests.doctorSlotId,
        appointmentId: appointmentRequests.appointmentId,
        status: appointmentRequests.status,
      })
      .from(appointmentRequests)
      .where(
        and(eq(appointmentRequests.doctorId, doctorId), eq(appointmentRequests.status, "pending"))
      )
      .orderBy(desc(appointmentRequests.createdAt))
      .limit(1);

    if (!reqRow) {
      return NextResponse.json({ ok: true, action: "cancelLatest", message: "No pending request found." });
    }

    const reason = (input.reason ?? "Clinic cancelled this appointment.").trim();

    await db
      .update(appointmentRequests)
      .set({
        status: "cancelled",
        cancelledAt: new Date(),
        cancelledReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(appointmentRequests.id, reqRow.id));

    if (reqRow.appointmentId) {
      await db
        .update(appointments)
        .set({ status: "cancelled" })
        .where(eq(appointments.id, reqRow.appointmentId));
    }

    const { slotYmd, slotTimeHm, slotEndTimeHm } = await slotYmdHmForDoctorSlotId(
      reqRow.doctorSlotId
    );
    const cancelLatestMd = clinicCancellationChatMessage({
      kind: clinicCancellationKindFromRequestRow(reqRow),
      slotYmd,
      slotTimeHm,
      slotEndTimeHm,
      reason,
    });
    await sendClinicSupportMessage({
      patientId: reqRow.patientId,
      text: cancelLatestMd,
    });
    void notifyPatientAppointmentEmail({
      patientId: reqRow.patientId,
      subject: APPOINTMENT_UPDATE_EMAIL_SUBJECT,
      markdownBody: cancelLatestMd,
    });

    return NextResponse.json({
      ok: true,
      action: "cancelLatest",
      doctorId,
      patientId: reqRow.patientId,
      requestId: reqRow.id,
      cancelledReason: reason,
    });
  }

  if (input.action === "cancelRequest") {
    const requestId = input.requestId;
    if (!requestId) return NextResponse.json({ error: "requestId_required" }, { status: 400 });

    const [reqRow] = await db
      .select({
        id: appointmentRequests.id,
        patientId: appointmentRequests.patientId,
        doctorId: appointmentRequests.doctorId,
        doctorSlotId: appointmentRequests.doctorSlotId,
        appointmentId: appointmentRequests.appointmentId,
        status: appointmentRequests.status,
      })
      .from(appointmentRequests)
      .where(and(eq(appointmentRequests.id, requestId), eq(appointmentRequests.doctorId, doctorId)))
      .limit(1);

    if (!reqRow) return NextResponse.json({ ok: true, action: "cancelRequest", message: "Request not found." });
    if (reqRow.status === "cancelled") return NextResponse.json({ ok: true, action: "cancelRequest", message: "Already cancelled." });

    const reason = (input.reason ?? "Clinic cancelled this appointment.").trim();

    await db
      .update(appointmentRequests)
      .set({
        status: "cancelled",
        cancelledAt: new Date(),
        cancelledReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(appointmentRequests.id, reqRow.id));

    if (reqRow.appointmentId) {
      await db
        .update(appointments)
        .set({ status: "cancelled" })
        .where(eq(appointments.id, reqRow.appointmentId));
    }

    const { slotYmd, slotTimeHm, slotEndTimeHm } = await slotYmdHmForDoctorSlotId(
      reqRow.doctorSlotId
    );
    const cancelReqMd = clinicCancellationChatMessage({
      kind: clinicCancellationKindFromRequestRow(reqRow),
      slotYmd,
      slotTimeHm,
      slotEndTimeHm,
      reason,
    });
    await sendClinicSupportMessage({
      patientId: reqRow.patientId,
      text: cancelReqMd,
    });
    void notifyPatientAppointmentEmail({
      patientId: reqRow.patientId,
      subject: APPOINTMENT_UPDATE_EMAIL_SUBJECT,
      markdownBody: cancelReqMd,
    });

    return NextResponse.json({
      ok: true,
      action: "cancelRequest",
      requestId: reqRow.id,
      cancelledReason: reason,
    });
  }

  return NextResponse.json({ error: "UNSUPPORTED_ACTION" }, { status: 400 });
}

