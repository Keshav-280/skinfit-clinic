"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

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
    <div className="space-y-5">
      <header>
        <h1 className="font-headline text-2xl font-bold text-[#1E1B31]">
          Patients
        </h1>
        <p className="mt-1 text-sm text-[#1E1B31]/60">
          Open a patient to see their details, reports, questionnaire, and chat.
        </p>
      </header>

      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search name or email"
        className="w-full rounded-xl border border-[#1E1B31]/12 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#1E1B31]/35"
      />

      {error ? (
        <p className="text-sm text-rose-700">{error}</p>
      ) : loading ? (
        <p className="text-sm text-[#1E1B31]/55">Loading…</p>
      ) : patients.length === 0 ? (
        <p className="rounded-2xl bg-[#E8E7DE] px-4 py-8 text-center text-sm text-[#1E1B31]/60">
          No patients found.
        </p>
      ) : (
        <ul className="divide-y divide-[#1E1B31]/8 overflow-hidden rounded-2xl bg-white shadow-[0_1px_3px_rgba(72,64,48,0.07)]">
          {patients.map((p) => (
            <li key={p.id}>
              <Link
                href={`/clinic/patients/${p.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3.5 transition hover:bg-[#FAF8F5]"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-[#1E1B31]">
                    {p.name?.trim() || p.email || "Patient"}
                  </p>
                  <p className="truncate text-xs text-[#1E1B31]/50">
                    {p.email}
                    {p.primaryConcern ? ` · ${p.primaryConcern}` : ""}
                  </p>
                </div>
                <span className="shrink-0 text-xs font-medium text-[#1E1B31]/40">
                  {p.clinicVisited ? "Chat on" : "Chat off"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
