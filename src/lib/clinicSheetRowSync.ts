import { postGoogleAppsScriptWebAppJson } from "@/src/lib/googleAppsScriptWebAppFetch";

type AppsScriptResponseBody = {
  ok?: unknown;
  error?: unknown;
  message?: unknown;
};

function parseAppsScriptBody(txt: string): AppsScriptResponseBody | null {
  const t = txt.trim();
  if (!t.startsWith("{")) return null;
  try {
    const v = JSON.parse(t) as unknown;
    if (v && typeof v === "object") return v as AppsScriptResponseBody;
    return null;
  } catch {
    return null;
  }
}

export type ClinicSheetMirrorResult = {
  ok: boolean;
  /** True when URL/secret/row ref missing — nothing was sent. */
  skipped: boolean;
  httpStatus?: number;
  detail?: string;
};

/**
 * Optional mirror write-back to Google Sheet after Skinfit processes CRM webhook.
 * Deploy the same Apps Script web app with `kind: "skinfit_row_sync"` handler, then set on Render:
 *   CLINIC_SHEET_SYNC_WEBHOOK_URL=https://script.google.com/macros/s/.../exec?secret=...
 * (same secret as `CLINIC_SHEET_WEBHOOK_SECRET`). Without this URL, column **status** stays `pending`
 * after confirm because only Skinfit DB updates — the sheet never receives the write-back.
 *
 * If `CLINIC_SHEET_SYNC_WEBHOOK_URL` is unset, falls back to `CLINIC_SHEET_REQUEST_WEBHOOK_URL` (same `doPost` handler).
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
}): Promise<ClinicSheetMirrorResult> {
  const urlRaw =
    process.env.CLINIC_SHEET_SYNC_WEBHOOK_URL?.trim() ||
    process.env.CLINIC_SHEET_REQUEST_WEBHOOK_URL?.trim();
  const secret = process.env.CLINIC_SHEET_WEBHOOK_SECRET?.trim();
  const ref = opts.externalRef?.trim();
  const schedId = opts.scheduleRequestId?.trim();
  if (!urlRaw || !secret || (!ref && !schedId)) {
    if (!urlRaw && (ref || schedId)) {
      console.warn(
        "[clinicSheetRowSync] skipped: set CLINIC_SHEET_SYNC_WEBHOOK_URL (or CLINIC_SHEET_REQUEST_WEBHOOK_URL) so the sheet can update after confirm/cancel"
      );
    }
    return {
      ok: false,
      skipped: true,
      detail: !urlRaw
        ? "missing_webhook_url"
        : !secret
          ? "missing_webhook_secret"
          : "missing_external_ref_and_schedule_request_id",
    };
  }

  try {
    const outbound = new URL(urlRaw);
    if (!outbound.searchParams.get("secret")) {
      outbound.searchParams.set("secret", secret);
    }
    const jsonBody = JSON.stringify({
      kind: "skinfit_row_sync",
      externalRef: ref || null,
      scheduleRequestId: schedId || null,
      skinfitStatus: opts.skinfitStatus,
      confirmedIso: opts.confirmedIso ?? null,
      notes: opts.notes ?? null,
      confirmedSlotEndTimeHm: opts.confirmedSlotEndTimeHm ?? null,
      patientClinicNote: opts.patientClinicNote ?? null,
      patientClinicNoteAt: opts.patientClinicNoteAt ?? null,
    });
    const res = await postGoogleAppsScriptWebAppJson(
      outbound.toString(),
      secret,
      jsonBody
    );
    const txt = await res.text().catch(() => "");
    if (!res.ok) {
      console.warn(
        "[clinicSheetRowSync] mirror HTTP",
        res.status,
        txt.slice(0, 500)
      );
      return {
        ok: false,
        skipped: false,
        httpStatus: res.status,
        detail: txt.slice(0, 500),
      };
    }
    /**
     * Apps Script wraps `doPost` in try/catch and answers **HTTP 200** even when the script throws
     * (`{"ok": false, "error": "script_exception", ...}`). Without parsing the body we’d wrongly
     * report `sheetMirrorOk: true` and the patient note silently never lands in the sheet.
     */
    const parsed = parseAppsScriptBody(txt);
    if (parsed && parsed.ok === false) {
      const errMsg =
        (typeof parsed.message === "string" && parsed.message) ||
        (typeof parsed.error === "string" && parsed.error) ||
        "apps_script_returned_ok_false";
      console.warn(
        "[clinicSheetRowSync] mirror body ok:false",
        errMsg,
        txt.slice(0, 300)
      );
      return {
        ok: false,
        skipped: false,
        httpStatus: res.status,
        detail: errMsg,
      };
    }
    if (!parsed) {
      // 200 + HTML usually means we hit Google's UCS error page (e.g. wrong /exec id).
      const looksLikeHtml = /<html|<!doctype/i.test(txt);
      if (looksLikeHtml) {
        console.warn(
          "[clinicSheetRowSync] mirror returned HTML instead of JSON — wrong web-app URL or stale deployment",
          txt.slice(0, 300)
        );
        return {
          ok: false,
          skipped: false,
          httpStatus: res.status,
          detail: "non_json_html_response",
        };
      }
    }
    return {
      ok: true,
      skipped: false,
      httpStatus: res.status,
      detail: txt.slice(0, 200),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[clinicSheetRowSync] mirror failed", e);
    return { ok: false, skipped: false, detail: msg };
  }
}
