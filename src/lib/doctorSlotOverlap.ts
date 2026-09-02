import { and, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { doctorSlots } from "@/src/db/schema";
import {
  effectiveSlotEndHm,
  hmToMinutes,
  normalizeSlotHm,
} from "@/src/lib/slotTimeHm";

/** Half-open intervals [start, end) in minutes from midnight. */
export function minuteRangesOverlap(
  startA: number,
  endA: number,
  startB: number,
  endB: number
): boolean {
  return startA < endB && startB < endA;
}

function slotToHalfOpenMinutes(
  slotTimeHm: string,
  slotEndTimeHm: string | null | undefined
): { start: number; end: number } | null {
  const startNorm = normalizeSlotHm(slotTimeHm) ?? slotTimeHm.trim();
  const endHm = effectiveSlotEndHm(startNorm, slotEndTimeHm);
  const s = hmToMinutes(startNorm);
  const e = hmToMinutes(endHm);
  if (s === null || e === null || e <= s) return null;
  return { start: s, end: e };
}

/**
 * True if the proposed slot overlaps any existing row for the same doctor+day.
 * @param ignoreSlotStartHm - same as proposed start: skip that row (upsert same slot).
 */
export async function doctorSlotOverlapsExisting(params: {
  doctorId: string;
  slotDate: Date;
  slotTimeHm: string;
  slotEndTimeHm: string | null | undefined;
  ignoreSlotStartHm?: string;
}): Promise<boolean> {
  const proposed = slotToHalfOpenMinutes(
    params.slotTimeHm,
    params.slotEndTimeHm
  );
  if (!proposed) return true;

  const rows = await db.query.doctorSlots.findMany({
    where: and(
      eq(doctorSlots.doctorId, params.doctorId),
      eq(doctorSlots.slotDate, params.slotDate)
    ),
    columns: {
      slotTimeHm: true,
      slotEndTimeHm: true,
    },
  });

  for (const row of rows) {
    if (
      params.ignoreSlotStartHm &&
      row.slotTimeHm === params.ignoreSlotStartHm
    ) {
      continue;
    }
    const existing = slotToHalfOpenMinutes(
      row.slotTimeHm,
      row.slotEndTimeHm ?? null
    );
    if (!existing) continue;
    if (
      minuteRangesOverlap(
        proposed.start,
        proposed.end,
        existing.start,
        existing.end
      )
    ) {
      return true;
    }
  }
  return false;
}
