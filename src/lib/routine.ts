/**
 * Reference AM/PM labels for seeds, tests, and doctor UI placeholders only.
 * Patient apps do not auto-apply this list — the clinic saves plans per patient.
 */
export const AM_ROUTINE_ITEMS = [
  "Gentle Cleanser",
  "Toner",
  "Serum",
  "Moisturiser",
  "Spf",
] as const;

export const PM_ROUTINE_ITEMS = [
  "Oil Cleanser",
  "Toner",
  "Retinol",
  "Serum",
  "Night Cream",
] as const;

export const AM_ROUTINE_LEN = AM_ROUTINE_ITEMS.length;
export const PM_ROUTINE_LEN = PM_ROUTINE_ITEMS.length;

/** Snapshot for seeds / tooling — not applied to live patients automatically. */
export function defaultRoutinePlanSnapshot(): { am: string[]; pm: string[] } {
  return {
    am: [...AM_ROUTINE_ITEMS],
    pm: [...PM_ROUTINE_ITEMS],
  };
}

const MAX_ROUTINE_STEPS = 15;
const MAX_STEP_LABEL_LEN = 200;

/** Normalize JSON/array from DB or API into trimmed step labels. */
export function coerceRoutinePlanList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x !== "string") continue;
    const t = x.trim().slice(0, MAX_STEP_LABEL_LEN);
    if (t) out.push(t);
    if (out.length >= MAX_ROUTINE_STEPS) break;
  }
  return out;
}

export type DoctorRoutinePlanPatchParsed =
  | { kind: "set"; am: string[]; pm: string[] }
  | { kind: "clear" }
  | { kind: "error"; error: string };

/**
 * PATCH `/api/doctor/patients/.../routine-plan`: `{ clear: true }` removes the plan;
 * otherwise `amItems` / `pmItems` must each have at least one step.
 */
export function parseDoctorRoutinePlanPatch(body: unknown): DoctorRoutinePlanPatchParsed {
  if (!body || typeof body !== "object") {
    return { kind: "error", error: "Invalid body." };
  }
  const o = body as { clear?: unknown; amItems?: unknown; pmItems?: unknown };
  if (o.clear === true) {
    return { kind: "clear" };
  }
  const am = coerceRoutinePlanList(o.amItems);
  const pm = coerceRoutinePlanList(o.pmItems);
  if (am.length < 1 || pm.length < 1) {
    return {
      kind: "error",
      error: "Add at least one AM step and one PM step.",
    };
  }
  return { kind: "set", am, pm };
}

/** Lists exposed on patient home / dashboard; ready only after onboarding + clinician plan. */
export function patientRoutineListsForApi(u: {
  routinePlanAmItems: unknown;
  routinePlanPmItems: unknown;
  onboardingComplete: boolean;
}): { amItems: string[]; pmItems: string[]; routinePlanReady: boolean } {
  const am = coerceRoutinePlanList(u.routinePlanAmItems);
  const pm = coerceRoutinePlanList(u.routinePlanPmItems);
  const ready = Boolean(
    u.onboardingComplete && am.length > 0 && pm.length > 0
  );
  return { amItems: am, pmItems: pm, routinePlanReady: ready };
}

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

/** Fraction of AM + PM routine steps checked (0–1). */
export function routineStepsProgress(am: boolean[], pm: boolean[]): number {
  const n = am.length + pm.length;
  if (n === 0) return 0;
  const done =
    am.filter(Boolean).length + pm.filter(Boolean).length;
  return Math.min(1, Math.max(0, done / n));
}
