"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";
import { CLINIC, initialsOf } from "@/components/doctor/clinicUi";

type Row = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  reportCount: number;
};

export function MedixoraPatientList() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [limited, setLimited] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const stop = new AbortController();
    const timer = window.setTimeout(
      async () => {
        try {
          const res = await fetch(`/api/medixora/patients?q=${encodeURIComponent(q)}`, {
            cache: "no-store",
            signal: stop.signal,
          });
          const data = (await res.json()) as { patients?: Row[]; limited?: boolean; message?: string };
          if (!res.ok || !data.patients) throw new Error(data.message || "Could not load patients.");
          setRows(data.patients);
          setLimited(Boolean(data.limited));
          setError("");
        } catch (e) {
          if (!stop.signal.aborted) setError(e instanceof Error ? e.message : "Could not load patients.");
        }
      },
      q ? 250 : 0
    );
    return () => {
      stop.abort();
      window.clearTimeout(timer);
    };
  }, [q]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className={CLINIC.h1}>Medixora reports</h1>
        <p className={`mt-1 ${CLINIC.muted}`}>Search for a patient, then scan the QR on the Medixora screen.</p>
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5B66A1]" aria-hidden />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, mobile or email"
          aria-label="Search patients"
          className={`${CLINIC.input} pl-10`}
        />
      </div>
      {error ? (
        <p className={CLINIC.noteError}>{error}</p>
      ) : !rows ? (
        <p className={CLINIC.muted}>Loading…</p>
      ) : rows.length === 0 ? (
        <p className={`${CLINIC.card} px-4 py-10 text-center ${CLINIC.muted}`}>
          No patient found. Ask them to fill the patient form first.
        </p>
      ) : (
        <>
          <ul className="grid gap-3 sm:grid-cols-2">
            {rows.map((p) => (
              <li key={p.id}>
                <Link href={`/medixora-reports/${p.id}`} className={`${CLINIC.card} flex items-center gap-3 p-4 transition hover:border-[#1E1B31]/30`}>
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#1E1B31] text-sm font-semibold text-[#AEB9E8]" aria-hidden>
                    {initialsOf(p.name || "P")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-[#1E1B31]">{p.name}</span>
                    <span className="block truncate text-xs text-[#5B66A1]">{p.phone ?? p.email ?? "-"}</span>
                    <span className="mt-1.5 inline-block">
                      <span className={p.reportCount ? CLINIC.chip : CLINIC.chipSand}>
                        {p.reportCount ? `${p.reportCount} ${p.reportCount === 1 ? "report" : "reports"}` : "No report yet"}
                      </span>
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-[#5B66A1]" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
          {limited ? <p className={CLINIC.muted}>Showing the 100 newest. Search to find others.</p> : null}
        </>
      )}
    </div>
  );
}
