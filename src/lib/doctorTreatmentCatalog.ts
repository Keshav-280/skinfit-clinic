import {
  listBuiltInClinicTreatments,
  normalizeClinicTreatment,
  type ClinicTreatment,
} from "@/src/lib/clinicTreatmentGuides";
import {
  readDoctorCustomTreatments,
  removeDoctorCustomTreatment,
  updateDoctorCustomTreatment,
} from "@/src/lib/doctorCustomTreatments";

const OVERRIDES_KEY = "skinfit:doctor-treatment-overrides";
const HIDDEN_KEY = "skinfit:doctor-treatment-hidden";

export type ClinicTreatmentInput = {
  name: string;
  preCare: string[];
  postCareDos: string[];
  postCareDonts: string[];
};

type TreatmentOverride = {
  name?: string;
  preCare?: string[];
  postCareDos?: string[];
  postCareDonts?: string[];
};

function readOverrides(): Record<string, TreatmentOverride> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(OVERRIDES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, TreatmentOverride> = {};
    for (const [id, value] of Object.entries(parsed)) {
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      const v = value as TreatmentOverride;
      out[id] = {
        name: typeof v.name === "string" ? v.name.trim() : undefined,
        preCare: Array.isArray(v.preCare)
          ? v.preCare.filter((s): s is string => typeof s === "string")
          : undefined,
        postCareDos: Array.isArray(v.postCareDos)
          ? v.postCareDos.filter((s): s is string => typeof s === "string")
          : undefined,
        postCareDonts: Array.isArray(v.postCareDonts)
          ? v.postCareDonts.filter((s): s is string => typeof s === "string")
          : undefined,
      };
    }
    return out;
  } catch {
    return {};
  }
}

function writeOverrides(overrides: Record<string, TreatmentOverride>): void {
  if (typeof window === "undefined") return;
  if (Object.keys(overrides).length === 0) {
    window.localStorage.removeItem(OVERRIDES_KEY);
    return;
  }
  window.localStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides));
}

function readHiddenIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(HIDDEN_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === "string"));
  } catch {
    return new Set();
  }
}

function writeHiddenIds(ids: Set<string>): void {
  if (typeof window === "undefined") return;
  if (ids.size === 0) {
    window.localStorage.removeItem(HIDDEN_KEY);
    return;
  }
  window.localStorage.setItem(HIDDEN_KEY, JSON.stringify([...ids]));
}

function applyOverride(base: ClinicTreatment, override?: TreatmentOverride): ClinicTreatment {
  if (!override) return base;
  return {
    ...base,
    name: override.name?.trim() || base.name,
    preCare: override.preCare?.length ? override.preCare : base.preCare,
    postCareDos: override.postCareDos?.length ? override.postCareDos : base.postCareDos,
    postCareDonts: override.postCareDonts?.length ? override.postCareDonts : base.postCareDonts,
  };
}

export function readDoctorClinicTreatments(): ClinicTreatment[] {
  const hidden = readHiddenIds();
  const overrides = readOverrides();
  const custom = readDoctorCustomTreatments();

  const builtIn = listBuiltInClinicTreatments()
    .filter((t) => !hidden.has(t.id))
    .map((t) => applyOverride(t, overrides[t.id]));

  return [...builtIn, ...custom];
}

export function readHiddenBuiltInTreatments(): ClinicTreatment[] {
  const hidden = readHiddenIds();
  return listBuiltInClinicTreatments().filter((t) => hidden.has(t.id));
}

export function saveBuiltInTreatmentOverride(id: string, input: ClinicTreatmentInput): void {
  const builtIn = listBuiltInClinicTreatments().find((t) => t.id === id);
  if (!builtIn) return;

  const overrides = readOverrides();
  overrides[id] = {
    name: input.name.trim() || builtIn.name,
    preCare: input.preCare,
    postCareDos: input.postCareDos,
    postCareDonts: input.postCareDonts,
  };
  writeOverrides(overrides);
}

export function resetBuiltInTreatment(id: string): void {
  const overrides = readOverrides();
  delete overrides[id];
  writeOverrides(overrides);

  const hidden = readHiddenIds();
  hidden.delete(id);
  writeHiddenIds(hidden);
}

export function hideBuiltInTreatment(id: string): void {
  const builtIn = listBuiltInClinicTreatments().find((t) => t.id === id);
  if (!builtIn) return;
  const hidden = readHiddenIds();
  hidden.add(id);
  writeHiddenIds(hidden);
}

export function restoreHiddenBuiltInTreatment(id: string): void {
  const hidden = readHiddenIds();
  hidden.delete(id);
  writeHiddenIds(hidden);
}

export function updateDoctorClinicTreatment(
  id: string,
  input: ClinicTreatmentInput,
  isBuiltIn: boolean
): ClinicTreatment[] {
  if (isBuiltIn) {
    saveBuiltInTreatmentOverride(id, input);
    return readDoctorClinicTreatments();
  }
  updateDoctorCustomTreatment(id, input);
  return readDoctorClinicTreatments();
}

export function deleteDoctorClinicTreatment(id: string, isBuiltIn: boolean): ClinicTreatment[] {
  if (isBuiltIn) {
    hideBuiltInTreatment(id);
    resetBuiltInTreatment(id);
    return readDoctorClinicTreatments();
  }
  removeDoctorCustomTreatment(id);
  return readDoctorClinicTreatments();
}

export function treatmentToInput(treatment: ClinicTreatment): ClinicTreatmentInput {
  return {
    name: treatment.name,
    preCare: [...treatment.preCare],
    postCareDos: [...treatment.postCareDos],
    postCareDonts: [...treatment.postCareDonts],
  };
}

export function parseTreatmentLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);
}

export function linesToText(items: string[]): string {
  return items.join("\n");
}

export function normalizeTreatmentPayload(raw: unknown): ClinicTreatment | null {
  return normalizeClinicTreatment(raw);
}
