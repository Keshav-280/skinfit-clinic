/** Matches web `src/lib/routine.ts` `normalizeRoutineSteps` for AM/PM checklist length. */

export function normalizeRoutineSteps(
  incoming: unknown,
  len: number,
  previous: boolean[] | null | undefined
): boolean[] {
  const raw = Array.isArray(incoming)
    ? incoming.map(Boolean)
    : previous && Array.isArray(previous)
      ? previous.map(Boolean)
      : [];
  return Array.from({ length: len }, (_, i) => Boolean(raw[i]));
}
