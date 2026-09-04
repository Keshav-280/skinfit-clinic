/** Browser alerts when a patient submits a new visit request. */

export const CLINIC_REQUEST_ALERTS_ENABLED_KEY =
  "skinfit.clinic.requestAlerts.enabled";
export const CLINIC_REQUEST_ALERTS_SEEN_KEY =
  "skinfit.clinic.requestAlerts.seenIds";
export const CLINIC_REQUEST_INBOX_EVENT = "skinfit-clinic-request-inbox";

export type ClinicRequestAlertItem = {
  id: string;
  patientId: string;
  patientName: string;
  preferredDateYmd: string;
  issue: string;
  status: string;
};

export type ClinicRequestInboxDetail = {
  pendingCount: number;
  newItems: ClinicRequestAlertItem[];
};

export function readRequestAlertsEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(CLINIC_REQUEST_ALERTS_ENABLED_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeRequestAlertsEnabled(on: boolean) {
  try {
    window.localStorage.setItem(
      CLINIC_REQUEST_ALERTS_ENABLED_KEY,
      on ? "1" : "0"
    );
  } catch {
    /* ignore quota */
  }
}

export function readSeenRequestIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(CLINIC_REQUEST_ALERTS_SEEN_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === "string"));
  } catch {
    return new Set();
  }
}

export function writeSeenRequestIds(ids: Set<string>) {
  try {
    const trimmed = [...ids].slice(-200);
    window.localStorage.setItem(
      CLINIC_REQUEST_ALERTS_SEEN_KEY,
      JSON.stringify(trimmed)
    );
  } catch {
    /* ignore quota */
  }
}

export function claimRequestAlert(id: string): boolean {
  const key = `skinfit.clinic.requestAlerts.fired:${id}`;
  try {
    if (window.localStorage.getItem(key)) return false;
    window.localStorage.setItem(key, String(Date.now()));
    return true;
  } catch {
    return true;
  }
}

export function dispatchClinicRequestInbox(detail: ClinicRequestInboxDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<ClinicRequestInboxDetail>(CLINIC_REQUEST_INBOX_EVENT, {
      detail,
    })
  );
}
