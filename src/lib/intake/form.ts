/**
 * The clinic's paper "Patient Profile & Consultation Form" as data: one list of questions used
 * by the web form, the server check and the clinic portal view, so they cannot drift apart.
 * Pure module (safe in the browser).
 */

export const INTAKE_FORM_VERSION = 1;

export const GENDERS = ["Male", "Female", "Other"] as const;
export const CONCERNS = [
  "Acne", "Acne Scars", "Pigmentation", "Melasma", "Freckles", "Dark Circles",
  "Fine Lines & Wrinkles", "Skin Laxity", "Enlarged Pores", "Uneven Skin Tone", "Facial Hair",
  "Excess Body Hair", "Hair Loss", "Dull Skin", "Stretch Marks", "Cellulite", "Double Chin",
  "Body Contouring", "Tattoo Removal", "Other",
] as const;
export const PROCEDURES = [
  "Chemical Peel", "Laser Hair Reduction", "Carbon Laser", "Microneedling", "PRP", "Botox",
  "Dermal Fillers", "HIFU", "Thread Lift", "Skin Boosters", "HydraFacial", "Other",
] as const;
export const SKIN_TYPES = ["Normal", "Dry", "Oily", "Combination", "Sensitive"] as const;
export const SKIN_EXPERIENCES = [
  "Acne Breakouts", "Rosacea", "Hyperpigmentation", "Sun Damage", "Excessive Sweating",
  "Easy Bruising",
] as const;
export const HAIR_CONCERNS = [
  "Hair Fall", "Thinning", "Bald Patches", "Dandruff", "Itchy Scalp", "Other",
] as const;
export const MEDICAL_CONDITIONS = [
  "Diabetes", "Hypertension", "Thyroid Disorder", "PCOS", "Autoimmune Disease", "Heart Disease",
  "Epilepsy", "Asthma", "Keloid Tendency", "Bleeding Disorder", "Vitiligo", "Psoriasis",
  "Eczema", "Active Skin Infection", "Cold Sores (Herpes)", "Cancer", "None",
] as const;
export const PREGNANCY = ["Pregnant", "Breastfeeding", "Planning Pregnancy", "None of the Above"] as const;
export const FREQUENCY = ["Never", "Occasionally", "Regularly"] as const;
export const SUN_EXPOSURE = ["Minimal", "Moderate", "High"] as const;
export const YES_NO = ["Yes", "No"] as const;

export const PHOTO_CONSENT_TEXT =
  "I agree to clinical photographs being taken for medical documentation.";
export const DECLARATION_TEXT =
  "I confirm that the information provided by me is true and complete to the best of my knowledge. I understand that withholding medical information may affect the safety and outcome of my treatment.";

export type IntakeAnswers = {
  name: string;
  dateOfBirth: string;
  gender: string;
  phoneCountryCode: string;
  phone: string;
  email: string;
  address: string;
  occupation: string;
  emergencyContactName: string;
  emergencyContactRelationship: string;
  concerns: string[];
  concernOther: string;
  hadProcedures: string;
  procedures: string[];
  procedureOther: string;
  procedureClinic: string;
  procedureDate: string;
  procedureComplications: string;
  skinType: string;
  skinExperiences: string[];
  hairConcerns: string[];
  hairOther: string;
  hairDuration: string;
  medicalConditions: string[];
  otherConditions: string;
  medications: string;
  drugAllergies: string;
  pregnancy: string[];
  smoking: string;
  alcohol: string;
  waterLitres: string;
  sunExposure: string;
  usesSunscreen: string;
  cleanser: string;
  moisturiser: string;
  sunscreen: string;
  nightCream: string;
  photoConsent: string;
  declarationAccepted: boolean;
  signatureName: string;
};

export function emptyIntake(): IntakeAnswers {
  return {
    name: "", dateOfBirth: "", gender: "", phoneCountryCode: "+91", phone: "", email: "",
    address: "", occupation: "", emergencyContactName: "", emergencyContactRelationship: "",
    concerns: [], concernOther: "", hadProcedures: "", procedures: [], procedureOther: "",
    procedureClinic: "", procedureDate: "", procedureComplications: "", skinType: "",
    skinExperiences: [], hairConcerns: [], hairOther: "", hairDuration: "", medicalConditions: [],
    otherConditions: "", medications: "", drugAllergies: "", pregnancy: [], smoking: "",
    alcohol: "", waterLitres: "", sunExposure: "", usesSunscreen: "", cleanser: "",
    moisturiser: "", sunscreen: "", nightCream: "", photoConsent: "", declarationAccepted: false,
    signatureName: "",
  };
}

export const INTAKE_STEPS = ["Your details", "Concerns", "Skin and hair", "Health", "Lifestyle and consent"] as const;

export type IntakeError = { step: number; field: keyof IntakeAnswers; message: string };

/** Whole years between a YYYY-MM-DD birth date and `now`; null when the date is not usable. */
export function ageFromDob(dob: string, now = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  if (date > now) return null;
  let age = now.getFullYear() - y;
  if (now.getMonth() < mo - 1 || (now.getMonth() === mo - 1 && now.getDate() < d)) age -= 1;
  return age >= 1 && age <= 120 ? age : null;
}

/** National digits as stored on `users.phone`. Indian numbers drop a typed 91 or leading 0. */
export function cleanPhone(countryCode: string, raw: string): string | null {
  let digits = raw.replace(/\D/g, "");
  if (countryCode === "+91") {
    if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
    if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
    return /^[6-9]\d{9}$/.test(digits) ? digits : null;
  }
  return digits.length >= 10 && digits.length <= 15 ? digits : null;
}

const text = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const oneOf = (v: unknown, options: readonly string[]) =>
  typeof v === "string" && options.includes(v) ? v : "";
const manyOf = (v: unknown, options: readonly string[]) =>
  Array.isArray(v) ? options.filter((o) => v.includes(o)) : [];

/** Rebuilds the answers from untrusted input: unknown fields and options are dropped. */
export function sanitizeIntake(raw: unknown): IntakeAnswers {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const cc = /^\+[1-9]\d{0,3}$/.test(text(r.phoneCountryCode, 8)) ? text(r.phoneCountryCode, 8) : "+91";
  const gender = oneOf(r.gender, GENDERS);
  const concerns = manyOf(r.concerns, CONCERNS);
  const hadProcedures = oneOf(r.hadProcedures, YES_NO);
  const procedures = hadProcedures === "Yes" ? manyOf(r.procedures, PROCEDURES) : [];
  const hairConcerns = manyOf(r.hairConcerns, HAIR_CONCERNS);
  const conditions = manyOf(r.medicalConditions, MEDICAL_CONDITIONS);
  const pregnancy = gender === "Female" ? manyOf(r.pregnancy, PREGNANCY) : [];
  const after = (cond: boolean, v: unknown, max = 200) => (cond ? text(v, max) : "");
  return {
    name: text(r.name, 120),
    dateOfBirth: text(r.dateOfBirth, 10),
    gender,
    phoneCountryCode: cc,
    phone: text(r.phone, 24),
    email: text(r.email, 200).toLowerCase(),
    address: text(r.address, 400),
    occupation: text(r.occupation, 120),
    emergencyContactName: text(r.emergencyContactName, 120),
    emergencyContactRelationship: text(r.emergencyContactRelationship, 60),
    concerns,
    concernOther: after(concerns.includes("Other"), r.concernOther),
    hadProcedures,
    procedures,
    procedureOther: after(procedures.includes("Other"), r.procedureOther),
    procedureClinic: after(hadProcedures === "Yes", r.procedureClinic, 120),
    procedureDate: after(hadProcedures === "Yes", r.procedureDate, 60),
    procedureComplications: after(hadProcedures === "Yes", r.procedureComplications, 400),
    skinType: oneOf(r.skinType, SKIN_TYPES),
    skinExperiences: manyOf(r.skinExperiences, SKIN_EXPERIENCES),
    hairConcerns,
    hairOther: after(hairConcerns.includes("Other"), r.hairOther),
    hairDuration: after(hairConcerns.length > 0, r.hairDuration, 60),
    // "None" cannot sit beside a real condition: the real condition wins.
    medicalConditions: conditions.length > 1 ? conditions.filter((c) => c !== "None") : conditions,
    otherConditions: text(r.otherConditions, 400),
    medications: text(r.medications, 400),
    drugAllergies: text(r.drugAllergies, 400),
    pregnancy: pregnancy.length > 1 ? pregnancy.filter((p) => p !== "None of the Above") : pregnancy,
    smoking: oneOf(r.smoking, FREQUENCY),
    alcohol: oneOf(r.alcohol, FREQUENCY),
    waterLitres: text(r.waterLitres, 5),
    sunExposure: oneOf(r.sunExposure, SUN_EXPOSURE),
    usesSunscreen: oneOf(r.usesSunscreen, YES_NO),
    cleanser: text(r.cleanser, 120),
    moisturiser: text(r.moisturiser, 120),
    sunscreen: text(r.sunscreen, 120),
    nightCream: text(r.nightCream, 120),
    photoConsent: oneOf(r.photoConsent, YES_NO),
    declarationAccepted: r.declarationAccepted === true,
    signatureName: text(r.signatureName, 120),
  };
}

/** Everything wrong with already-sanitised answers, in form order. Empty means it can be saved. */
export function intakeErrors(a: IntakeAnswers, now = new Date()): IntakeError[] {
  const out: IntakeError[] = [];
  const need = (ok: boolean, step: number, field: keyof IntakeAnswers, message: string) => {
    if (!ok) out.push({ step, field, message });
  };
  need(a.name.length >= 2, 0, "name", "Please enter your name.");
  need(ageFromDob(a.dateOfBirth, now) != null, 0, "dateOfBirth", "Please enter your date of birth.");
  need(a.gender !== "", 0, "gender", "Please select your gender.");
  need(cleanPhone(a.phoneCountryCode, a.phone) != null, 0, "phone", "Please enter a valid mobile number.");
  need(a.email === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email), 0, "email", "This email address does not look right.");
  need(a.medicalConditions.length > 0, 3, "medicalConditions", "Tick your conditions, or tick None.");
  need(a.gender !== "Female" || a.pregnancy.length > 0, 3, "pregnancy", "Please answer the question for female patients.");
  need(a.waterLitres === "" || (Number(a.waterLitres) >= 0 && Number(a.waterLitres) <= 15), 4, "waterLitres", "Enter water intake in litres per day.");
  need(a.photoConsent !== "", 4, "photoConsent", "Please answer the photography question.");
  need(a.declarationAccepted, 4, "declarationAccepted", "Please accept the declaration.");
  need(a.signatureName.length >= 2, 4, "signatureName", "Type your full name as your signature.");
  return out;
}

/** The parts of the form the rest of the app already understands (columns on `users`). */
export function profileFromIntake(a: IntakeAnswers, now = new Date()) {
  const has = (...c: string[]) => c.some((x) => a.concerns.includes(x));
  const mapped: string[] = [];
  for (const c of a.concerns) {
    if (c === "Acne" || c === "Acne Scars") mapped.push("acne");
    else if (["Pigmentation", "Melasma", "Freckles", "Uneven Skin Tone"].includes(c)) mapped.push("pigmentation");
    else if (c === "Fine Lines & Wrinkles" || c === "Skin Laxity") mapped.push("ageing");
  }
  if (has("Hair Loss") || a.hairConcerns.length > 0) mapped.push("hair");
  const concerns = [...new Set(mapped)];
  if (concerns.length === 0) concerns.push("general");

  const water = a.waterLitres === "" ? null : Number(a.waterLitres);
  const history = [
    a.procedures.filter((p) => p !== "Other").join(", "),
    a.procedureOther,
    a.procedureClinic ? `Clinic: ${a.procedureClinic}` : "",
    a.procedureDate ? `When: ${a.procedureDate}` : "",
    a.procedureComplications ? `Complications: ${a.procedureComplications}` : "",
  ].filter(Boolean).join(". ");

  return {
    age: ageFromDob(a.dateOfBirth, now),
    gender: a.gender.toLowerCase(),
    skinType: a.skinType || null,
    primaryConcern: concerns[0]!,
    concerns,
    priorTreatment: a.hadProcedures === "" ? null : a.hadProcedures.toLowerCase(),
    treatmentHistoryText: history || null,
    baselineSunExposure: a.sunExposure ? a.sunExposure.toLowerCase() : null,
    baselineHydration:
      water == null ? null : water < 1 ? "under1l" : water < 1.5 ? "1to1_5l" : water < 2 ? "1_5to2l" : "2lplus",
  };
}

export type IntakeViewRow = { label: string; value: string };

/** Safety-relevant answers a clinician should see first. */
export function intakeAlerts(a: IntakeAnswers): string[] {
  const alerts: string[] = [];
  const conditions = a.medicalConditions.filter((c) => c !== "None");
  if (conditions.length) alerts.push(`Conditions: ${conditions.join(", ")}`);
  if (a.otherConditions) alerts.push(`Other conditions: ${a.otherConditions}`);
  const preg = a.pregnancy.filter((p) => p !== "None of the Above");
  if (preg.length) alerts.push(preg.join(", "));
  if (a.drugAllergies) alerts.push(`Drug allergies: ${a.drugAllergies}`);
  if (a.medications) alerts.push(`Medications: ${a.medications}`);
  if (a.procedureComplications) alerts.push(`Past complications: ${a.procedureComplications}`);
  if (a.photoConsent === "No") alerts.push("Did NOT agree to clinical photographs");
  return alerts;
}

export function intakeSections(a: IntakeAnswers): { title: string; rows: IntakeViewRow[] }[] {
  const list = (items: string[], other = "") =>
    [...items.filter((x) => x !== "Other"), other].filter(Boolean).join(", ");
  const row = (label: string, value: string): IntakeViewRow => ({ label, value: value || "-" });
  const age = ageFromDob(a.dateOfBirth);
  return [
    { title: "Patient details", rows: [
      row("Name", a.name), row("Date of birth", a.dateOfBirth), row("Age", age == null ? "" : String(age)),
      row("Gender", a.gender), row("Mobile", `${a.phoneCountryCode} ${a.phone}`), row("Email", a.email),
      row("Address", a.address), row("Occupation", a.occupation),
      row("Emergency contact", a.emergencyContactName), row("Relationship", a.emergencyContactRelationship),
    ] },
    { title: "Aesthetic concerns", rows: [row("Areas of concern", list(a.concerns, a.concernOther))] },
    { title: "Previous treatments", rows: [
      row("Had procedures before", a.hadProcedures), row("Procedures", list(a.procedures, a.procedureOther)),
      row("Clinic", a.procedureClinic), row("Approximate date", a.procedureDate),
      row("Complications", a.procedureComplications),
    ] },
    { title: "Skin and hair", rows: [
      row("Skin type", a.skinType), row("Experiences", list(a.skinExperiences)),
      row("Hair concern", list(a.hairConcerns, a.hairOther)), row("Duration", a.hairDuration),
    ] },
    { title: "Medical history", rows: [
      row("Conditions", list(a.medicalConditions)), row("Other conditions", a.otherConditions),
      row("Current medications", a.medications), row("Drug allergies", a.drugAllergies),
      ...(a.gender === "Female" ? [row("Currently", list(a.pregnancy))] : []),
    ] },
    { title: "Lifestyle", rows: [
      row("Smoking", a.smoking), row("Alcohol", a.alcohol),
      row("Water (litres a day)", a.waterLitres), row("Sun exposure", a.sunExposure),
      row("Uses sunscreen", a.usesSunscreen), row("Cleanser", a.cleanser),
      row("Moisturiser", a.moisturiser), row("Sunscreen", a.sunscreen), row("Night cream or serum", a.nightCream),
    ] },
    { title: "Consent", rows: [
      row("Clinical photographs", a.photoConsent),
      row("Declaration", a.declarationAccepted ? "Accepted" : ""), row("Signed (typed)", a.signatureName),
    ] },
  ];
}
