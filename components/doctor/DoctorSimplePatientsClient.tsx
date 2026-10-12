"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";
import { CLINIC, initialsOf } from "@/components/doctor/clinicUi";

type PatientRow = {
  id: string;
  name: string | null;
  email: string | null;
  primaryConcern: string | null;
  clinicVisited: boolean;
};

export function DoctorSimplePatientsClient() {
  const [q, setQ] = useState("");
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (query: string) => {
    setError(null);
    try {
      const url = new URL("/api/doctor/patients", window.location.origin);
      if (query.trim()) url.searchParams.set("q", query.trim());
      const res = await fetch(url.pathname + url.search, {
        credentials: "include",
        cache: "no-store",
      });
      const data = (await res.json()) as {
        success?: boolean;
        patients?: PatientRow[];
        error?: string;
      };
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Could not load patients.");
      }
      setPatients(data.patients ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load patients.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => void load(q), q ? 250 : 0);
    return () => window.clearTimeout(t);
  }, [q, load]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className={CLINIC.h1}>Patients</h1>
          <p className={`mt-1 ${CLINIC.muted}`}>
            Open a patient to see their details, treatments, reports, chat and rewards.
          </p>
        </div>
        {!loading && !error ? (
          <span className={CLINIC.chip}>
            {patients.length} {patients.length === 1 ? "patient" : "patients"}
          </span>
        ) : null}
      </header>

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5B66A1]"
          aria-hidden
        />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name or email"
          className={`${CLINIC.input} pl-10`}
        />
      </div>

      {error ? (
        <p className={CLINIC.noteError}>{error}</p>
      ) : loading ? (
        <p className={CLINIC.muted}>Loading…</p>
      ) : patients.length === 0 ? (
        <p className={`${CLINIC.card} px-4 py-10 text-center ${CLINIC.muted}`}>
          No patients found.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {patients.map((p) => {
            const name = p.name?.trim() || p.email || "Patient";
            return (
              <li key={p.id}>
                <Link
                  href={`/clinic/patients/${p.id}`}
                  className={`${CLINIC.card} group flex items-center gap-3 p-4 transition hover:border-[#1E1B31]/30`}
                >
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#1E1B31] text-sm font-semibold text-[#AEB9E8]"
                    aria-hidden
                  >
                    {initialsOf(name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-[#1E1B31]">{name}</span>
                    <span className="block truncate text-xs text-[#5B66A1]">{p.email}</span>
                    <span className="mt-1.5 flex flex-wrap gap-1.5">
                      {p.primaryConcern ? (
                        <span className={CLINIC.chipSand}>{p.primaryConcern}</span>
                      ) : null}
                      <span className={p.clinicVisited ? CLINIC.chip : CLINIC.chipSand}>
                        {p.clinicVisited ? "Chat on" : "Chat off"}
                      </span>
                    </span>
                  </span>
                  <ChevronRight
                    className="h-4 w-4 shrink-0 text-[#5B66A1] transition group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
