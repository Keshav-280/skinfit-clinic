"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { CLINIC } from "@/components/doctor/clinicUi";
import { intakeAlerts, intakeSections, sanitizeIntake } from "@/src/lib/intake/form";

type Form = {
  id: string;
  answers: unknown;
  verified: boolean;
  enteredByStaff: boolean;
  createdAt: string;
};

/** Clinic portal: the patient's consultation form, safety answers first. */
export function PatientIntakeFormCard({ patientId }: { patientId: string }) {
  const [forms, setForms] = useState<Form[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setForms(null);
    setFailed(false);
    setIndex(0);
    fetch(`/api/doctor/patients/${patientId}/intake`, { credentials: "include", cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        setForms(((await r.json()) as { forms: Form[] }).forms);
      })
      .catch(() => setFailed(true));
  }, [patientId]);

  const form = forms?.[index];
  const answers = form ? sanitizeIntake(form.answers) : null;
  const alerts = answers ? intakeAlerts(answers) : [];

  return (
    <section className={CLINIC.cardPad}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className={CLINIC.h2}>Consultation form</h2>
        {forms && forms.length > 1 ? (
          <select
            aria-label="Choose a submitted form"
            value={index}
            onChange={(e) => setIndex(Number(e.target.value))}
            className={`${CLINIC.input} w-auto`}
          >
            {forms.map((f, i) => (
              <option key={f.id} value={i}>
                {new Date(f.createdAt).toLocaleString("en-IN")}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      {failed ? (
        <p className={`mt-2 ${CLINIC.noteError}`}>Could not load the form. Refresh to try again.</p>
      ) : !forms ? (
        <p className={`mt-2 ${CLINIC.muted}`}>Loading…</p>
      ) : !form || !answers ? (
        <p className={`mt-2 ${CLINIC.muted}`}>No consultation form submitted.</p>
      ) : (
        <>
          <p className={`mt-1 ${CLINIC.muted}`}>
            Submitted {new Date(form.createdAt).toLocaleString("en-IN")}
            {form.enteredByStaff ? " by clinic staff" : ""}
          </p>
          {!form.verified ? (
            <p className={`mt-2 ${CLINIC.noteError}`}>
              Filled without signing in to this existing account. Confirm the details with the
              patient before relying on them.
            </p>
          ) : null}
          {alerts.length > 0 ? (
            <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="h-4 w-4" aria-hidden />
                Check before treatment
              </p>
              <ul className="mt-1 list-disc pl-5">
                {alerts.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {intakeSections(answers).map((s) => (
            <div key={s.title} className="mt-5">
              <h3 className="text-sm font-semibold text-[#1E1B31]">{s.title}</h3>
              <dl className="mt-2 grid gap-3 sm:grid-cols-3">
                {s.rows.map((r) => (
                  <div key={r.label}>
                    <dt className={CLINIC.label}>{r.label}</dt>
                    <dd className="mt-0.5 break-words text-sm text-[#1E1B31]">{r.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </>
      )}
    </section>
  );
}
