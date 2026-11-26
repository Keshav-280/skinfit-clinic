"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check } from "lucide-react";
import { STORAGE_KEY as INTRO_SEEN_KEY } from "@/components/dashboard/WelcomeModal";
import { SNOOZE_KEY as EMAIL_PROMPT_SNOOZE_KEY } from "@/components/dashboard/EmailReminderPrompt";
import {
  ageFromDob,
  CONCERNS,
  DECLARATION_TEXT,
  emptyIntake,
  FREQUENCY,
  GENDERS,
  HAIR_CONCERNS,
  INTAKE_STEPS,
  intakeErrors,
  MEDICAL_CONDITIONS,
  PHOTO_CONSENT_TEXT,
  PREGNANCY,
  PROCEDURES,
  sanitizeIntake,
  SKIN_EXPERIENCES,
  SKIN_TYPES,
  SUN_EXPOSURE,
  YES_NO,
  type IntakeAnswers,
  type IntakeError,
} from "@/src/lib/intake/form";

const DRAFT_KEY = "skinfit_intake_draft";
const INPUT =
  "w-full rounded-xl border border-[#1E1B31]/15 bg-white px-4 py-3 text-base text-[#1E1B31] outline-none focus:border-[#1E1B31] focus:ring-2 focus:ring-[#1E1B31]/15";
const LABEL = "mb-1.5 block text-sm font-semibold text-[#1E1B31]";
const PRIMARY =
  "w-full rounded-xl bg-[#1E1B31] py-3.5 text-base font-bold text-white transition hover:bg-[#242A5F] disabled:opacity-60";

type TextKey = {
  [K in keyof IntakeAnswers]: IntakeAnswers[K] extends string ? K : never;
}[keyof IntakeAnswers];
type ListKey = {
  [K in keyof IntakeAnswers]: IntakeAnswers[K] extends string[] ? K : never;
}[keyof IntakeAnswers];

type Done = { outcome: "existing" } | { outcome: "staff"; patientId: string; existed: boolean };

export function ClinicIntakeForm() {
  const [a, setA] = useState<IntakeAnswers>(emptyIntake);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<IntakeError[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Done | null>(null);
  const [loaded, setLoaded] = useState(false);
  const top = useRef<HTMLDivElement>(null);

  // Keep what was typed if the page reloads (this tab only; cleared on submit).
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(DRAFT_KEY);
      if (saved) {
        const d = JSON.parse(saved) as { a?: unknown; step?: number };
        setA(sanitizeDraft(d.a));
        setStep(Math.min(Math.max(Number(d.step) || 0, 0), INTAKE_STEPS.length - 1));
      }
    } catch {
      /* private mode */
    }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded || done) return;
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ a, step }));
    } catch {
      /* private mode */
    }
  }, [a, step, loaded, done]);

  const set = (patch: Partial<IntakeAnswers>) => {
    setA((prev) => ({ ...prev, ...patch }));
    setErrors((prev) => prev.filter((e) => !(e.field in patch)));
  };

  const goTo = (next: number) => {
    setStep(next);
    setMessage("");
    top.current?.scrollIntoView();
  };

  const stepErrors = (n: number) => intakeErrors(sanitizeIntake(a)).filter((e) => e.step === n);

  async function submit() {
    const all = intakeErrors(sanitizeIntake(a));
    if (all.length > 0) {
      setErrors(all);
      goTo(all[0]!.step);
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(a),
      });
      const data = (await res.json().catch(() => ({}))) as {
        message?: string;
        outcome?: "signed-in" | "existing" | "staff";
        patientId?: string;
        existed?: boolean;
      };
      if (!res.ok || !data.outcome) {
        setMessage(data.message || "Could not save the form. Please try again.");
        return;
      }
      try {
        sessionStorage.removeItem(DRAFT_KEY);
      } catch {
        /* ignore */
      }
      if (data.outcome === "signed-in") {
        // Straight to the dashboard: no welcome or reminder popup on this first visit.
        try {
          localStorage.setItem(INTRO_SEEN_KEY, "true");
          sessionStorage.setItem(EMAIL_PROMPT_SNOOZE_KEY, "true");
        } catch {
          /* private mode */
        }
        window.location.assign("/dashboard");
        return;
      }
      setDone(
        data.outcome === "staff"
          ? { outcome: "staff", patientId: data.patientId ?? "", existed: Boolean(data.existed) }
          : { outcome: "existing" }
      );
    } catch {
      setMessage("No connection. Check the internet and press Submit again.");
    } finally {
      setBusy(false);
    }
  }

  function next() {
    const found = stepErrors(step);
    setErrors(found);
    if (found.length === 0) goTo(step + 1);
  }

  const errorFor = (field: keyof IntakeAnswers) => {
    const e = errors.find((x) => x.field === field);
    return e ? (
      <p role="alert" className="mt-1.5 text-sm font-medium text-red-700">
        {e.message}
      </p>
    ) : null;
  };

  const input = (
    field: TextKey,
    label: string,
    props: React.InputHTMLAttributes<HTMLInputElement> = {}
  ) => (
    <div>
      <label htmlFor={`in-${field}`} className={LABEL}>
        {label}
      </label>
      <input
        id={`in-${field}`}
        className={INPUT}
        value={a[field]}
        onChange={(e) => set({ [field]: e.target.value } as Partial<IntakeAnswers>)}
        {...props}
      />
      {errorFor(field)}
    </div>
  );

  const chip = (selected: boolean, label: string, onClick: () => void) => (
    <button
      key={label}
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2.5 text-sm font-semibold transition ${
        selected
          ? "border-[#1E1B31] bg-[#1E1B31] text-white"
          : "border-[#1E1B31]/20 bg-white text-[#1E1B31]"
      }`}
    >
      {selected ? <Check className="h-4 w-4" aria-hidden /> : null}
      {label}
    </button>
  );

  const single = (field: TextKey, label: string, options: readonly string[]) => (
    <fieldset>
      <legend className={LABEL}>{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) =>
          chip(a[field] === o, o, () => set({ [field]: a[field] === o ? "" : o } as Partial<IntakeAnswers>))
        )}
      </div>
      {errorFor(field)}
    </fieldset>
  );

  /** `exclusive` is the "None" choice: picking it clears the rest, and picking another clears it. */
  const multi = (field: ListKey, label: string, options: readonly string[], exclusive?: string) => (
    <fieldset>
      <legend className={LABEL}>{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) =>
          chip(a[field].includes(o), o, () => {
            const has = a[field].includes(o);
            const nextValue = has
              ? a[field].filter((x) => x !== o)
              : o === exclusive
                ? [o]
                : [...a[field].filter((x) => x !== exclusive), o];
            set({ [field]: nextValue } as Partial<IntakeAnswers>);
          })
        )}
      </div>
      {errorFor(field)}
    </fieldset>
  );

  const age = ageFromDob(a.dateOfBirth);

  if (done) {
    return (
      <Shell>
        <div className="rounded-3xl bg-white p-6 text-center shadow-[0_8px_24px_rgba(30,27,49,0.08)]">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#F0EAE2] text-[#1E1B31]" aria-hidden>
            <Check className="h-6 w-6" />
          </span>
          <h1 className="mt-4 font-serif text-xl font-semibold text-[#1E1B31]">Form received</h1>
          {done.outcome === "existing" ? (
            <>
              <p className="mt-2 text-sm text-[#5B66A1]">
                You already have a SkinFit account with these details. Sign in to see your dashboard.
              </p>
              <Link href="/login" className={`mt-5 block ${PRIMARY}`}>
                Sign in
              </Link>
            </>
          ) : (
            <>
              <p className="mt-2 text-sm text-[#5B66A1]">
                {done.existed
                  ? "Added to the existing account for this patient."
                  : "The patient account has been created."}{" "}
                You are still signed in as staff.
              </p>
              <Link href={`/clinic/patients/${done.patientId}`} className={`mt-5 block ${PRIMARY}`}>
                Open patient
              </Link>
              <button
                type="button"
                className="mt-2 w-full py-3 text-sm font-semibold text-[#1E1B31]"
                onClick={() => {
                  setA(emptyIntake());
                  setErrors([]);
                  setDone(null);
                  setStep(0);
                }}
              >
                Fill another form
              </button>
            </>
          )}
        </div>
      </Shell>
    );
  }

  const last = step === INTAKE_STEPS.length - 1;

  return (
    <Shell>
      <div ref={top} />
      <h1 className="font-serif text-2xl font-semibold text-[#1E1B31]">Patient profile and consultation form</h1>
      <p className="mt-1 text-sm text-[#5B66A1]">
        Step {step + 1} of {INTAKE_STEPS.length}: {INTAKE_STEPS[step]}
      </p>
      <div className="mt-3 flex gap-1.5" aria-hidden>
        {INTAKE_STEPS.map((s, i) => (
          <span key={s} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-[#1E1B31]" : "bg-[#1E1B31]/12"}`} />
        ))}
      </div>

      <form
        className="mt-6 space-y-5"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (busy || !loaded) return;
          if (last) void submit();
          else next();
        }}
      >
        {step === 0 ? (
          <>
            {input("name", "Name *", { autoComplete: "name" })}
            {input("dateOfBirth", "Date of birth *", { type: "date", autoComplete: "bday", max: new Date().toISOString().slice(0, 10) })}
            {age != null ? <p className="-mt-3 text-sm text-[#5B66A1]">Age: {age}</p> : null}
            {single("gender", "Gender *", GENDERS)}
            <div>
              <label htmlFor="in-phone" className={LABEL}>
                Mobile number *
              </label>
              <div className="flex gap-2">
                <input
                  aria-label="Country code"
                  className={`${INPUT} !w-24`}
                  value={a.phoneCountryCode}
                  onChange={(e) => set({ phoneCountryCode: e.target.value })}
                  inputMode="tel"
                />
                <input
                  id="in-phone"
                  className={INPUT}
                  value={a.phone}
                  onChange={(e) => set({ phone: e.target.value })}
                  inputMode="tel"
                  autoComplete="tel-national"
                />
              </div>
              {errorFor("phone")}
            </div>
            {input("email", "Email", { type: "email", autoComplete: "email" })}
            {input("address", "Address", { autoComplete: "street-address" })}
            {input("occupation", "Occupation")}
            {input("emergencyContactName", "Emergency contact name")}
            {input("emergencyContactRelationship", "Relationship")}
          </>
        ) : null}

        {step === 1 ? (
          <>
            {multi("concerns", "What brings you to SkinFit today? Tick all that apply", CONCERNS)}
            {a.concerns.includes("Other") ? input("concernOther", "Other concern") : null}
            {single("hadProcedures", "Have you had any aesthetic procedures before?", YES_NO)}
            {a.hadProcedures === "Yes" ? (
              <>
                {multi("procedures", "Which ones?", PROCEDURES)}
                {a.procedures.includes("Other") ? input("procedureOther", "Other procedure") : null}
                {input("procedureClinic", "Clinic name")}
                {input("procedureDate", "Approximate date")}
                {input("procedureComplications", "Any complications?")}
              </>
            ) : null}
          </>
        ) : null}

        {step === 2 ? (
          <>
            {single("skinType", "Skin type", SKIN_TYPES)}
            {multi("skinExperiences", "Do you experience", SKIN_EXPERIENCES)}
            {multi("hairConcerns", "Hair concern, if any", HAIR_CONCERNS)}
            {a.hairConcerns.includes("Other") ? input("hairOther", "Other hair concern") : null}
            {a.hairConcerns.length > 0 ? input("hairDuration", "How long have you had this problem?") : null}
          </>
        ) : null}

        {step === 3 ? (
          <>
            {multi("medicalConditions", "Do you have any of the following? *", MEDICAL_CONDITIONS, "None")}
            {input("otherConditions", "Other medical conditions")}
            {input("medications", "Current medications")}
            {input("drugAllergies", "Drug allergies")}
            {a.gender === "Female"
              ? multi("pregnancy", "Are you currently *", PREGNANCY, "None of the Above")
              : null}
          </>
        ) : null}

        {step === 4 ? (
          <>
            {single("smoking", "Smoking", FREQUENCY)}
            {single("alcohol", "Alcohol", FREQUENCY)}
            {input("waterLitres", "Water intake (litres a day)", { type: "number", inputMode: "decimal", min: 0, max: 15, step: 0.5 })}
            {single("sunExposure", "Sun exposure", SUN_EXPOSURE)}
            {single("usesSunscreen", "Do you regularly use sunscreen?", YES_NO)}
            <p className="text-sm font-semibold text-[#1E1B31]">Current skin care routine</p>
            {input("cleanser", "Cleanser")}
            {input("moisturiser", "Moisturiser")}
            {input("sunscreen", "Sunscreen")}
            {input("nightCream", "Night cream or serum")}
            {single("photoConsent", `${PHOTO_CONSENT_TEXT} *`, YES_NO)}
            <div>
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 h-5 w-5 shrink-0 rounded border-[#1E1B31]/30 text-[#1E1B31]"
                  checked={a.declarationAccepted}
                  onChange={(e) => set({ declarationAccepted: e.target.checked })}
                />
                <span className="text-sm leading-snug text-[#1E1B31]">{DECLARATION_TEXT} *</span>
              </label>
              {errorFor("declarationAccepted")}
            </div>
            {input("signatureName", "Type your full name as your signature *")}
          </>
        ) : null}

        {errors.some((e) => e.step === step) ? (
          <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
            Please check the highlighted answers.
          </p>
        ) : null}
        {message ? (
          <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
            {message}
          </p>
        ) : null}

        <div className="flex gap-3">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => goTo(step - 1)}
              className="inline-flex items-center justify-center rounded-xl border border-[#1E1B31]/20 bg-white px-4 text-[#1E1B31]"
              aria-label="Back"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden />
            </button>
          ) : null}
          <button type="submit" disabled={busy || !loaded} className={PRIMARY}>
            {last ? (busy ? "Submitting…" : "Submit") : "Continue"}
          </button>
        </div>
      </form>
      {step === 0 ? (
        <p className="mt-4 text-center text-sm text-[#5B66A1]">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-[#1E1B31] underline">
            Sign in
          </Link>
        </p>
      ) : null}
    </Shell>
  );
}

/** A half-filled draft must keep what was typed, so only the shape is repaired (not the values). */
function sanitizeDraft(raw: unknown): IntakeAnswers {
  const base = emptyIntake();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Record<string, unknown>;
  for (const key of Object.keys(base) as (keyof IntakeAnswers)[]) {
    const v = r[key];
    const same = Array.isArray(base[key]) ? Array.isArray(v) : typeof v === typeof base[key];
    if (same) Object.assign(base, { [key]: v });
  }
  return base;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#FAF8F5] px-5 pb-12 pt-6">
      <div className="mx-auto w-full max-w-lg">
        <Image
          src="/branding/skinfit-wellness-logo.svg"
          alt="SkinFit Wellness"
          width={560}
          height={135}
          priority
          className="mb-6 h-8 w-auto"
        />
        {children}
      </div>
    </main>
  );
}
