"use client";

import { useCallback, useEffect, useState } from "react";
import { HeartPulse, Trash2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import {
  COMMON_PATIENT_TREATMENTS,
  TREATMENT_PARAM_OPTIONS,
  treatmentParamLabels,
  type PatientTreatmentRow,
} from "@/src/lib/patientTreatmentRecord";
import {
  doctorBtnPrimaryClass,
  doctorNavyIconChipClass,
  doctorPatientPageCardClass,
  doctorPatientPageFormInputClass,
} from "@/components/doctor/DoctorUiPrimitives";
import { localCalendarYmd } from "@/src/lib/date-only";

type Variant = "portal" | "simple";

export function DoctorPatientTreatmentsPanel({
  patientId,
  variant = "portal",
}: {
  patientId: string;
  variant?: Variant;
}) {
  const [items, setItems] = useState<PatientTreatmentRow[]>([]);
  const [title, setTitle] = useState("");
  const [treatedOnYmd, setTreatedOnYmd] = useState(localCalendarYmd);
  const [notes, setNotes] = useState("");
  const [params, setParams] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/doctor/patients/${patientId}/treatments`, {
      credentials: "include",
      cache: "no-store",
    });
    const data = (await res.json()) as {
      ok?: boolean;
      items?: PatientTreatmentRow[];
    };
    if (res.ok && data.ok) setItems(data.items ?? []);
  }, [patientId]);

  useEffect(() => {
    void load();
  }, [load]);

  function toggleParam(key: string) {
    setParams((cur) =>
      cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]
    );
  }

  async function save() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/doctor/patients/${patientId}/treatments`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          treatedOnYmd,
          notes,
          affectedParams: params,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        if (data.error === "TITLE_REQUIRED") {
          setError("Enter the treatment name.");
        } else if (data.error === "PARAMS_REQUIRED") {
          setError("Choose at least one parameter this treatment affects.");
        } else {
          setError("Could not save treatment.");
        }
        return;
      }
      setTitle("");
      setNotes("");
      setParams([]);
      setTreatedOnYmd(localCalendarYmd());
      await load();
    } catch {
      setError("Could not save treatment.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setError(null);
    const res = await fetch(
      `/api/doctor/patients/${patientId}/treatments/${id}`,
      { method: "DELETE", credentials: "include" }
    );
    if (!res.ok) {
      setError("Could not remove treatment.");
      return;
    }
    await load();
  }

  const form = (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold text-[#1E1B31]">
            Treatment
          </span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Hydrafacial"
            className={`${doctorPatientPageFormInputClass} py-1.5`}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold text-[#1E1B31]">
            Date given
          </span>
          <input
            type="date"
            value={treatedOnYmd}
            onChange={(e) => setTreatedOnYmd(e.target.value)}
            className={`${doctorPatientPageFormInputClass} py-1.5`}
          />
        </label>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {COMMON_PATIENT_TREATMENTS.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => setTitle(name)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              title === name
                ? "bg-[#1E1B31] text-white"
                : "bg-[#F1F4FA] text-[#1E1B31]/75 hover:bg-[#E8EDF6]"
            }`}
          >
            {name}
          </button>
        ))}
      </div>

      <div className="mt-3">
        <p className="mb-1.5 text-[11px] font-semibold text-[#1E1B31]">
          Parameters affected
        </p>
        <div className="flex flex-wrap gap-1.5">
          {TREATMENT_PARAM_OPTIONS.map((opt) => {
            const on = params.includes(opt.key);
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => toggleParam(opt.key)}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                  on
                    ? "border-[#1E1B31] bg-[#1E1B31] text-white"
                    : "border-[#1E1B31]/15 bg-white text-[#1E1B31]/75 hover:bg-[#F8F9FC]"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <label className="mt-3 block">
        <span className="mb-1 block text-[11px] font-semibold text-[#1E1B31]">
          Note (optional)
        </span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Session details, settings, or response…"
          className={`${doctorPatientPageFormInputClass} resize-y py-1.5`}
        />
      </label>

      {error ? (
        <p className="mt-2 text-xs font-medium text-rose-700">{error}</p>
      ) : null}

      <button
        type="button"
        disabled={busy}
        onClick={() => void save()}
        className={`${doctorBtnPrimaryClass} mt-3 px-3 py-1.5 text-xs disabled:opacity-50`}
      >
        {busy ? "Saving…" : "Add treatment"}
      </button>
    </>
  );

  const list =
    items.length === 0 ? (
      <p className="mt-4 text-[12px] text-[#1E1B31]/50">
        No treatments recorded for this patient yet.
      </p>
    ) : (
      <ul className="mt-4 space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-start justify-between gap-3 rounded-xl border border-[#1E1B31]/10 bg-[#FAFBFD] px-3 py-2.5"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#1E1B31]">{item.title}</p>
              <p className="mt-0.5 text-[11px] text-[#1E1B31]/50">
                {format(parseISO(`${item.treatedOnYmd}T12:00:00`), "d MMM yyyy")}
                {item.notes ? ` · ${item.notes}` : ""}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {treatmentParamLabels(item.affectedParams).map((label) => (
                  <span
                    key={label}
                    className="rounded-full bg-[#1E1B31]/8 px-2 py-0.5 text-[10px] font-semibold text-[#1E1B31]"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={() => void remove(item.id)}
              className="rounded-md p-1.5 text-[#1E1B31]/45 hover:bg-white hover:text-rose-600"
              title="Remove treatment"
              aria-label="Remove treatment"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    );

  if (variant === "simple") {
    return (
      <section className="rounded-2xl bg-white p-5 shadow-[0_1px_3px_rgba(72,64,48,0.07)]">
        <h2 className="text-sm font-bold uppercase tracking-wide text-[#1E1B31]/50">
          Treatments given
        </h2>
        <p className="mt-1 text-[12px] text-[#1E1B31]/50">
          Record what this patient received in clinic and which scores it may
          move.
        </p>
        <div className="mt-3">{form}</div>
        {list}
      </section>
    );
  }

  return (
    <div className={`${doctorPatientPageCardClass} mt-4 p-4`}>
      <h2 className="mb-3 flex items-center gap-2 border-b border-[#1E1B31]/15 pb-3 text-[#1E1B31]">
        <span className={`h-8 w-8 rounded-lg ${doctorNavyIconChipClass}`}>
          <HeartPulse className="h-4 w-4 shrink-0" aria-hidden />
        </span>
        <span className="text-sm font-semibold">Treatments given</span>
      </h2>
      <p className="mb-3 text-[11px] leading-snug text-[#1E1B31]/55">
        Log an in-clinic treatment and tag every kAI parameter it is meant to
        affect. You can pick more than one.
      </p>
      {form}
      {list}
    </div>
  );
}
