import {
  normalizeClinicTreatment,
  type ClinicTreatment,
} from "@/src/lib/clinicTreatmentGuides";

const STORAGE_KEY = "skinfit:doctor-custom-treatments";
const MAX_CUSTOM_TREATMENTS = 30;

function slugifyName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug || "treatment";
}

function readStore(): ClinicTreatment[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: ClinicTreatment[] = [];
    const seen = new Set<string>();
    for (const item of parsed) {
      const treatment = normalizeClinicTreatment(item);
      if (!treatment || treatment.isBuiltIn) continue;
      if (seen.has(treatment.id)) continue;
      seen.add(treatment.id);
      out.push(treatment);
    }
    return out.slice(0, MAX_CUSTOM_TREATMENTS);
  } catch {
    return [];
  }
}

function writeStore(items: ClinicTreatment[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_CUSTOM_TREATMENTS)));
}

export function readDoctorCustomTreatments(): ClinicTreatment[] {
  return readStore();
}

export function addDoctorCustomTreatment(input: {
  name: string;
  preCare: string[];
  postCareDos: string[];
  postCareDonts: string[];
}): ClinicTreatment[] {
  const name = input.name.replace(/\s+/g, " ").trim();
  if (!name) return readStore();

  const treatment: ClinicTreatment = {
    id: `custom-${slugifyName(name)}-${Date.now()}`,
    name,
    preCare: input.preCare.map((s) => s.replace(/\s+/g, " ").trim()).filter(Boolean),
    postCareDos: input.postCareDos.map((s) => s.replace(/\s+/g, " ").trim()).filter(Boolean),
    postCareDonts: input.postCareDonts.map((s) => s.replace(/\s+/g, " ").trim()).filter(Boolean),
  };

  const store = readStore();
  const next = [treatment, ...store].slice(0, MAX_CUSTOM_TREATMENTS);
  writeStore(next);
  return next;
}

export function removeDoctorCustomTreatment(id: string): ClinicTreatment[] {
  const target = id.trim();
  if (!target) return readStore();
  const next = readStore().filter((t) => t.id !== target);
  writeStore(next);
  return next;
}

export function updateDoctorCustomTreatment(
  id: string,
  input: {
    name: string;
    preCare: string[];
    postCareDos: string[];
    postCareDonts: string[];
  }
): ClinicTreatment[] {
  const target = id.trim();
  const name = input.name.replace(/\s+/g, " ").trim();
  if (!target || !name) return readStore();

  const store = readStore();
  const next = store.map((t) =>
    t.id === target
      ? {
          ...t,
          name,
          preCare: input.preCare.map((s) => s.replace(/\s+/g, " ").trim()).filter(Boolean),
          postCareDos: input.postCareDos.map((s) => s.replace(/\s+/g, " ").trim()).filter(Boolean),
          postCareDonts: input.postCareDonts
            .map((s) => s.replace(/\s+/g, " ").trim())
            .filter(Boolean),
        }
      : t
  );
  writeStore(next);
  return next;
}
