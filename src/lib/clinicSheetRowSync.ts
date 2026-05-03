/**
 * Optional mirror write-back to Google Sheet after Skinfit processes CRM webhook.
 * Deploy the same Apps Script web app with `kind: "skinfit_row_sync"` handler, then set on Render:
 *   CLINIC_SHEET_SYNC_WEBHOOK_URL=https://script.google.com/macros/s/.../exec?secret=...
 * (same secret as `CLINIC_SHEET_WEBHOOK_SECRET`). Without this URL, column **status** stays `pending`
 * after confirm because only Skinfit DB updates — the sheet never receives the write-back.
 */
export async function notifyClinicSheetRowMirrored(opts: {
  externalRef: string | null | undefined;
  /** `patient_schedule_requests.id` (sheet column `requestId`) — Apps Script can find the row if `sheet-row-N` drifted. */
  scheduleRequestId?: string | null;
  skinfitStatus: "pending" | "confirmed" | "cancelled" | "declined";
  confirmedIso?: string | null;
  notes?: string | null;
  /** Same-day end `HH:mm` in clinic wall time (optional). */
  confirmedSlotEndTimeHm?: string | null;
  patientClinicNote?: string | null;
  patientClinicNoteAt?: string | null;
}): Promise<void> {
  const urlRaw = process.env.CLINIC_SHEET_SYNC_WEBHOOK_URL?.trim();
  const secret = process.env.CLINIC_SHEET_WEBHOOK_SECRET?.trim();
  const ref = opts.externalRef?.trim();
  const schedId = opts.scheduleRequestId?.trim();
  if (!urlRaw || !secret || (!ref && !schedId)) {
    if (!urlRaw && (ref || schedId)) {
      console.warn(
        "[clinicSheetRowSync] skipped: set CLINIC_SHEET_SYNC_WEBHOOK_URL so the sheet status column can update after confirm/cancel"
      );
    }
    return;
  }

  try {
    const outbound = new URL(urlRaw);
    if (!outbound.searchParams.get("secret")) {
      outbound.searchParams.set("secret", secret);
    }
    const res = await fetch(outbound.toString(), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-skinfit-sheet-secret": secret,
      },
      body: JSON.stringify({
        kind: "skinfit_row_sync",
        externalRef: ref || null,
        scheduleRequestId: schedId || null,
        skinfitStatus: opts.skinfitStatus,
        confirmedIso: opts.confirmedIso ?? null,
        notes: opts.notes ?? null,
        confirmedSlotEndTimeHm: opts.confirmedSlotEndTimeHm ?? null,
        patientClinicNote: opts.patientClinicNote ?? null,
        patientClinicNoteAt: opts.patientClinicNoteAt ?? null,
      }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.warn(
        "[clinicSheetRowSync] mirror HTTP",
        res.status,
        txt.slice(0, 500)
      );
    }
  } catch (e) {
    console.warn("[clinicSheetRowSync] mirror failed", e);
  }
}
