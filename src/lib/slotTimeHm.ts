const HM = /^([01]\d|2[0-3]):([0-5]\d)$/;
const HM_LOOSE = /^([01]?\d|2[0-3]):([0-5]\d)$/;

/** Accepts `9:05` or `09:05`; returns canonical `HH:mm` or null. */
export function normalizeSlotHm(hm: string): string | null {
  const t = hm.trim();
  const m = HM_LOOSE.exec(t);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  if (h < 0 || h > 23) return null;
  return `${String(h).padStart(2, "0")}:${m[2]}`;
}

/** Minutes from midnight [0, 1440). */
export function hmToMinutes(hm: string): number | null {
  const n = normalizeSlotHm(hm);
  if (!n) return null;
  const m = HM.exec(n);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function minutesToHm(total: number): string {
  const t = ((total % 1440) + 1440) % 1440;
  const hh = Math.floor(t / 60);
  const mm = t % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export function addMinutesToHm(hm: string, deltaMinutes: number): string | null {
  const base = hmToMinutes(hm);
  if (base === null) return null;
  return minutesToHm(base + deltaMinutes);
}

/** When DB end is null, use start + 30 minutes (legacy slots). */
export const DEFAULT_SLOT_DURATION_MINUTES = 30;

export function effectiveSlotEndHm(
  slotStartHm: string,
  slotEndTimeHm: string | null | undefined
): string {
  const startNorm = normalizeSlotHm(slotStartHm);
  if (!startNorm) return slotStartHm.trim();
  if (slotEndTimeHm) {
    const endNorm = normalizeSlotHm(slotEndTimeHm);
    if (endNorm && isValidSlotEndAfterStart(startNorm, endNorm)) {
      return endNorm;
    }
  }
  return addMinutesToHm(startNorm, DEFAULT_SLOT_DURATION_MINUTES) ?? startNorm;
}

/** True if end is strictly after start (same day). */
export function isValidSlotEndAfterStart(startHm: string, endHm: string): boolean {
  const a = hmToMinutes(startHm);
  const b = hmToMinutes(endHm);
  if (a === null || b === null) return false;
  return b > a;
}

/** "10:30" + optional end → "10:30 - 11:00" or "10:30". */
export function formatSlotTimeRange(
  slotStartHm: string,
  slotEndTimeHm: string | null | undefined
): string {
  const startNorm = normalizeSlotHm(slotStartHm) ?? slotStartHm.trim();
  const end = effectiveSlotEndHm(slotStartHm, slotEndTimeHm);
  if (end === startNorm) return startNorm;
  return `${startNorm} - ${end}`;
}
