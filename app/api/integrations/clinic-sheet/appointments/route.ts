import { NextResponse } from "next/server";
import {
  applyClinicSheetAppointmentUpdates,
  type ClinicSheetAppointmentUpdate,
} from "@/src/lib/clinicSheetAppointmentWebhook";

/**
 * Webhook for Google Apps Script / automation when the clinic CRM updates
 * the Google Sheet (confirm time, cancel, etc.).
 *
 * Set header: `x-skinfit-sheet-secret: <CLINIC_SHEET_WEBHOOK_SECRET>`
 *
 * Body: `{ "updates": [ { "action": "confirm", "patientId": "uuid", "scheduleRequestId": "<uuid column B>",
 *   "externalRef": "sheet-row-12",
 *   "confirmedDateTimeIso": "2026-05-10T14:30:00+05:30", "confirmedSlotEndTimeHm": "11:00",
 *   "appointmentType": "consultation", "patientMessage": "Apply cream X before you come." } ] }`
 * Re-confirm same `externalRef` after booking → reschedules the visit (patient notified).
 * Cancel / decline: use `cancelledReason` and/or `patientMessage` (both go to patient notification + DB).
 */
export async function POST(req: Request) {
  const secret = process.env.CLINIC_SHEET_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: "WEBHOOK_NOT_CONFIGURED" },
      { status: 503 }
    );
  }
  const hdr = req.headers.get("x-skinfit-sheet-secret")?.trim();
  if (hdr !== secret) {
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

  const raw = (body as { updates?: unknown }).updates;
  if (!Array.isArray(raw)) {
    return NextResponse.json({ error: "UPDATES_ARRAY_REQUIRED" }, { status: 400 });
  }

  const updates: ClinicSheetAppointmentUpdate[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const action = o.action;
    if (action !== "confirm" && action !== "cancel" && action !== "decline") {
      continue;
    }
    const appointmentType = o.appointmentType;
    const patientMessageRaw =
      typeof o.patientMessage === "string" ? o.patientMessage.trim() : "";
    const slotEndRaw =
      typeof o.confirmedSlotEndTimeHm === "string"
        ? o.confirmedSlotEndTimeHm.trim()
        : "";
    const schedIdRaw =
      typeof o.scheduleRequestId === "string" ? o.scheduleRequestId.trim() : "";
    const uuidOk =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        schedIdRaw
      );
    updates.push({
      action,
      scheduleRequestId: uuidOk ? schedIdRaw : null,
      externalRef:
        typeof o.externalRef === "string" ? o.externalRef : null,
      patientEmail:
        typeof o.patientEmail === "string" ? o.patientEmail : null,
      patientId: typeof o.patientId === "string" ? o.patientId : null,
      confirmedDateTimeIso:
        typeof o.confirmedDateTimeIso === "string"
          ? o.confirmedDateTimeIso
          : null,
      confirmedSlotEndTimeHm:
        slotEndRaw.length > 0 ? slotEndRaw.slice(0, 8) : null,
      appointmentType:
        appointmentType === "consultation" ||
        appointmentType === "follow-up" ||
        appointmentType === "scan-review"
          ? appointmentType
          : null,
      cancelledReason:
        typeof o.cancelledReason === "string" ? o.cancelledReason : null,
      patientMessage:
        patientMessageRaw.length > 0
          ? patientMessageRaw.slice(0, 4000)
          : null,
    });
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: "NO_VALID_UPDATES" }, { status: 400 });
  }

  const { applied, errors } = await applyClinicSheetAppointmentUpdates(updates);
  return NextResponse.json({ success: true, applied, errors });
}
