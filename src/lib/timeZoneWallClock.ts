/** Safe IANA zone; fall back if invalid. */
export function normalizeIanaTimeZone(tz: string | null | undefined): string {
  const t = (tz ?? "").trim() || "Asia/Kolkata";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: t }).format(new Date());
    return t;
  } catch {
    return "Asia/Kolkata";
  }
}

/** Calendar YYYY-MM-DD and HH:mm (24h) in the given IANA timezone. */
export function localYmdAndHm(d: Date, timeZone: string): { ymd: string; hm: string } {
  const tz = normalizeIanaTimeZone(timeZone);
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  const hmParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const hh = hmParts.find((p) => p.type === "hour")?.value ?? "00";
  const mm = hmParts.find((p) => p.type === "minute")?.value ?? "00";
  const hm = `${hh.padStart(2, "0")}:${mm.padStart(2, "0")}`;
  return { ymd, hm };
}

export function hmToMinutes(hm: string): number {
  const [h, m] = hm.split(":").map((x) => Number.parseInt(x, 10));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

/** True if `nowHm` is in [targetHm, targetHm + windowMinutes). */
export function inReminderMinuteWindow(
  nowHm: string,
  targetHm: string,
  windowMinutes: number
): boolean {
  const now = hmToMinutes(nowHm);
  const t = hmToMinutes(targetHm);
  return now >= t && now < t + windowMinutes;
}

/**
 * Hourly cron fires at H:00 — match targets from (H-1):00 through H:00 inclusive.
 * Example: cron at 09:00 catches an 08:30 AM reminder (narrow 8-minute windows miss this).
 */
export function inHourlyCronReminderWindow(
  nowHm: string,
  targetHm: string
): boolean {
  const nowTotal = hmToMinutes(nowHm);
  const targetTotal = hmToMinutes(targetHm);
  const nowHour = Math.floor(nowTotal / 60);
  const windowEnd = nowHour * 60;

  if (windowEnd === 0) {
    return targetTotal >= 23 * 60 && targetTotal <= 23 * 60 + 59;
  }

  const windowStart = windowEnd - 60;
  return targetTotal >= windowStart && targetTotal <= windowEnd;
}

export const VALID_HM = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidHm(s: string): boolean {
  return VALID_HM.test(s.trim());
}
