/** Reusable quick-insert text for the doctor portal (routine, feedback, visit notes). */

export const DOCTOR_SNIPPET_MIME = "application/x-skinfit-doctor-snippet";

export type DoctorSnippetGroup = {
  label: string;
  items: readonly string[];
};

export const DOCTOR_ROUTINE_STEP_SNIPPETS = [
  "Gentle cleanser",
  "Oil cleanser",
  "Double cleanse",
  "Toner",
  "Vitamin C serum",
  "Niacinamide serum",
  "Hyaluronic acid serum",
  "Retinol",
  "Moisturiser",
  "Night cream",
  "SPF 50",
  "Eye cream",
] as const;

export const DOCTOR_ROUTINE_PRODUCT_SNIPPETS = [
  "Cetaphil gentle cleanser",
  "La Roche-Posay Anthelios SPF 50",
  "Minimalist niacinamide 10%",
  "CeraVe moisturising cream",
  "Bioderma Sensibio H2O",
] as const;

export const DOCTOR_ROUTINE_DOSAGE_SNIPPETS = [
  "Once daily",
  "Twice daily",
  "Pea-sized amount",
  "2–3 drops",
  "Apply to damp skin",
  "Wait 1 minute between layers",
] as const;

export const DOCTOR_FEEDBACK_SNIPPETS = [
  "Good progress — keep your AM/PM routine consistent.",
  "Barrier looks stressed — simplify actives for 1–2 weeks.",
  "Increase moisturiser if dryness or tightness persists.",
  "Use SPF every morning, even indoors near windows.",
  "Book a follow-up if redness or burning continues.",
  "Continue current plan; we will reassess at the next scan.",
] as const;

export const DOCTOR_PRE_ADVICE_SNIPPETS = [
  "Avoid retinol and strong acids 3–5 days before treatment.",
  "No waxing or threading 48 hours prior.",
  "Come with clean skin — no makeup on treatment area.",
  "Patch test new products at least 48 hours before procedure.",
  "Stay well hydrated the day before.",
  "Inform clinic of any new medicines or supplements.",
] as const;

export const DOCTOR_POST_ADVICE_SNIPPETS = [
  "Apply SPF 50 daily for 2 weeks.",
  "Avoid active acids and retinol for 5–7 days.",
  "Use gentle cleanser only — no scrubs.",
  "Keep skin moisturised; avoid picking or rubbing.",
  "Skip gym/sauna for 24 hours if advised after procedure.",
  "Contact clinic if unusual swelling, pain, or blistering.",
] as const;

export const DOCTOR_TREATMENT_SNIPPETS = [
  "Chemical peel — superficial",
  "Microneedling",
  "Laser toning",
  "Comedone extraction",
  "Hydrafacial",
  "LED therapy",
] as const;

export function doctorRoutineSnippetGroups(): DoctorSnippetGroup[] {
  return [
    { label: "Common steps", items: DOCTOR_ROUTINE_STEP_SNIPPETS },
    { label: "Products", items: DOCTOR_ROUTINE_PRODUCT_SNIPPETS },
    { label: "Dose / notes", items: DOCTOR_ROUTINE_DOSAGE_SNIPPETS },
  ];
}

export function appendDoctorSnippet(current: string, snippet: string): string {
  const next = snippet.trim();
  if (!next) return current;
  const base = current.trimEnd();
  if (!base) return next;
  return `${base}\n${next}`;
}

export function readDoctorSnippetFromDataTransfer(
  dataTransfer: DataTransfer | null
): string | null {
  if (!dataTransfer) return null;
  const custom = dataTransfer.getData(DOCTOR_SNIPPET_MIME).trim();
  if (custom) return custom;
  const plain = dataTransfer.getData("text/plain").trim();
  return plain || null;
}

export function writeDoctorSnippetToDataTransfer(
  dataTransfer: DataTransfer,
  text: string
): void {
  dataTransfer.setData(DOCTOR_SNIPPET_MIME, text);
  dataTransfer.setData("text/plain", text);
  dataTransfer.effectAllowed = "copy";
}
