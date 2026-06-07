export type ClinicTreatmentPhase = "pre" | "post";

export type ClinicTreatment = {
  id: string;
  name: string;
  preCare: string[];
  postCareDos: string[];
  postCareDonts: string[];
  isBuiltIn?: boolean;
};

export const HYDRAFACIAL_TREATMENT: ClinicTreatment = {
  id: "hydrafacial",
  name: "Hydrafacial",
  isBuiltIn: true,
  preCare: [
    'Stop using retinol, tretinoin, strong exfoliants, glycolic acid, salicylic acid, and other "active" skincare products that may irritate the skin at least 2-3 days before.',
    "Avoid facial scrubs and at-home chemical peels a day before.",
    "Avoid laser treatments, medium/deep chemical peels 1 week before.",
  ],
  postCareDos: [
    "Avoid Active Ingredients. Reintroduce them gradually after 2–3 days.",
    "Keep your skin hydrated with a gentle moisturizer.",
    "Use a broad-spectrum sunscreen (SPF 30 or higher) and reapply if you're outdoors.",
  ],
  postCareDonts: [
    "Avoid Heavy makeup for at least 6–24 hours, if possible.",
    "Avoid Hot showers, steam rooms, saunas, and hot yoga.",
    "Strenuous exercise that causes excessive sweating.",
    "Exfoliating scrubs, cleansing brushes, or harsh skincare products.",
  ],
};

const BUILTIN_BY_ID = new Map<string, ClinicTreatment>([
  [HYDRAFACIAL_TREATMENT.id, HYDRAFACIAL_TREATMENT],
]);

export function listBuiltInClinicTreatments(): ClinicTreatment[] {
  return [HYDRAFACIAL_TREATMENT];
}

export function getBuiltInClinicTreatment(id: string): ClinicTreatment | undefined {
  return BUILTIN_BY_ID.get(id);
}

export function resolveClinicTreatment(
  treatmentId: string,
  customTreatment?: ClinicTreatment | null
): ClinicTreatment | undefined {
  const builtIn = getBuiltInClinicTreatment(treatmentId);
  if (builtIn) return builtIn;
  if (customTreatment && customTreatment.id === treatmentId) {
    return normalizeClinicTreatment(customTreatment) ?? undefined;
  }
  return undefined;
}

function normalizeStringList(items: unknown, max = 30): string[] {
  if (!Array.isArray(items)) return [];
  const out: string[] = [];
  for (const item of items) {
    if (typeof item !== "string") continue;
    const text = item.replace(/\s+/g, " ").trim();
    if (!text) continue;
    out.push(text);
    if (out.length >= max) break;
  }
  return out;
}

export function normalizeClinicTreatment(raw: unknown): ClinicTreatment | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Partial<ClinicTreatment>;
  const id = typeof o.id === "string" ? o.id.trim() : "";
  const name = typeof o.name === "string" ? o.name.trim() : "";
  if (!id || !name) return null;
  return {
    id,
    name,
    preCare: normalizeStringList(o.preCare),
    postCareDos: normalizeStringList(o.postCareDos),
    postCareDonts: normalizeStringList(o.postCareDonts),
    isBuiltIn: o.isBuiltIn === true,
  };
}

function bulletList(items: string[]): string {
  return items.map((item) => `• ${item}`).join("\n");
}

/** Formats a delegated chat message for pre- or post-treatment care. */
export function formatClinicTreatmentCareMessage(
  treatment: ClinicTreatment,
  phase: ClinicTreatmentPhase
): string {
  const title =
    phase === "pre"
      ? `${treatment.name} — Pre-care instructions`
      : `${treatment.name} — Post-care instructions`;

  if (phase === "pre") {
    const lines = [
      title,
      "",
      "Please follow these steps before your in-clinic treatment:",
      "",
      bulletList(treatment.preCare),
    ];
    return lines.join("\n").trim();
  }

  const sections: string[] = [
    title,
    "",
    "After your treatment, please follow this guidance (especially in the first 24 hours):",
  ];

  if (treatment.postCareDos.length > 0) {
    sections.push("", "Do:", bulletList(treatment.postCareDos));
  }
  if (treatment.postCareDonts.length > 0) {
    sections.push("", "Avoid:", bulletList(treatment.postCareDonts));
  }

  return sections.join("\n").trim();
}
