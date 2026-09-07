import { localYmdAndHm } from "@/src/lib/timeZoneWallClock";

/** Clinic / website calendar day for Ops. */
export const OPS_TIME_ZONE = "Asia/Kolkata";

export function parseOpsInstant(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw) return null;
  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function opsIso(value: unknown): string | null {
  const d = parseOpsInstant(value);
  return d ? d.toISOString() : null;
}

export function opsYmd(value: unknown): string | null {
  const d = parseOpsInstant(value);
  if (!d) return null;
  return localYmdAndHm(d, OPS_TIME_ZONE).ymd;
}

export function opsTodayYmd(): string {
  return localYmdAndHm(new Date(), OPS_TIME_ZONE).ymd;
}

export function opsYesterdayYmd(): string {
  const today = opsTodayYmd();
  const [y, m, day] = today.split("-").map((p) => Number(p));
  const noonIstApprox = Date.UTC(y, m - 1, day, 6, 30, 0);
  return opsYmd(new Date(noonIstApprox - 24 * 60 * 60 * 1000)) ?? today;
}

export function formatOpsDate(value: unknown): string {
  const d = parseOpsInstant(value);
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: OPS_TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function formatOpsDateTime(value: unknown): string {
  const d = parseOpsInstant(value);
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: OPS_TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

export function formatOpsDayLabel(ymd: string): string {
  const [y, m, d] = ymd.split("-").map((p) => Number(p));
  if (!y || !m || !d) return ymd;
  const noonUtc = Date.UTC(y, m - 1, d, 6, 30, 0);
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: OPS_TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(noonUtc));
}

export function formatOpsDayLong(ymd: string): string {
  const [y, m, d] = ymd.split("-").map((p) => Number(p));
  if (!y || !m || !d) return ymd;
  const noonUtc = Date.UTC(y, m - 1, d, 6, 30, 0);
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: OPS_TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(noonUtc));
}
