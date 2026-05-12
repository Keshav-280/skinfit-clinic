"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ChevronRight,
  RefreshCw,
  Search,
  User,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { GLOBAL_LIVE_REFRESH_EVENT } from "@/src/lib/globalRefreshEvents";

type PatientRow = {
  id: string;
  name: string;
  email: string;
  primaryConcern: string | null;
  onboardingComplete: boolean;
  createdAt: string;
  sosRowTint?: "urgent" | "seen" | null;
  lastSosAt?: string | null;
};

const CONCERNS = [
  { value: "", label: "All concerns" },
  { value: "acne", label: "Acne" },
  { value: "pigmentation", label: "Pigmentation" },
  { value: "ageing", label: "Ageing" },
  { value: "hair", label: "Hair" },
  { value: "general", label: "General" },
];

export function DoctorPatientsClient({
  initialSosOnly = false,
}: {
  initialSosOnly?: boolean;
}) {
  const [q, setQ] = useState("");
  const [concern, setConcern] = useState("");
  const [sosOnly, setSosOnly] = useState(initialSosOnly);
  const [rows, setRows] = useState<PatientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (concern) params.set("concern", concern);
      if (sosOnly) params.set("sos", "1");
      const res = await fetch(`/api/doctor/patients?${params}`, {
        credentials: "include",
      });
      const data = (await res.json()) as {
        success?: boolean;
        patients?: PatientRow[];
        error?: string;
      };
      if (!res.ok || !data.success) {
        setErr(data.error ?? "Could not load patients.");
        setRows([]);
        return;
      }
      setRows(data.patients ?? []);
    } catch {
      setErr("Network error.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [q, concern, sosOnly]);

  useEffect(() => {
    const t = window.setTimeout(() => void load(), 280);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    const onRefresh = () => void load();
    window.addEventListener(GLOBAL_LIVE_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(GLOBAL_LIVE_REFRESH_EVENT, onRefresh);
  }, [load]);

  return (
    <div className="space-y-4">
      {/* ── Filters ── */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-[#2C3E6B] focus:bg-white focus:ring-1 focus:ring-[#2C3E6B]/20"
          />
        </div>
        <select
          value={concern}
          onChange={(e) => setConcern(e.target.value)}
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#2C3E6B] focus:ring-1 focus:ring-[#2C3E6B]/20"
        >
          {CONCERNS.map((c) => (
            <option key={c.value || "any"} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100">
          <input
            type="checkbox"
            checked={sosOnly}
            onChange={(e) => setSosOnly(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-slate-300 accent-red-600"
          />
          <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
          SOS only
        </label>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#2C3E6B] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#243356] disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {err && <p className="text-sm font-medium text-red-600">{err}</p>}

      {/* ── Patient cards ── */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="h-5 w-5 animate-spin text-slate-400" />
          <span className="ml-2 text-sm text-slate-500">Loading patients…</span>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center">
          <User className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-2 text-sm text-slate-500">No patients match these filters.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((p) => {
            const isUrgent = p.sosRowTint === "urgent";
            const isSeen = p.sosRowTint === "seen";
            return (
              <Link
                key={p.id}
                href={`/doctor/patients/${p.id}`}
                className={`group relative flex items-center gap-3 rounded-2xl border bg-white p-4 shadow-sm transition hover:shadow-md ${
                  isUrgent
                    ? "border-red-300 ring-1 ring-red-100"
                    : isSeen
                      ? "border-red-200/60"
                      : "border-slate-200/80 hover:border-slate-300"
                }`}
              >
                {/* Avatar */}
                <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${
                  isUrgent ? "bg-red-500" : "bg-[#2C3E6B]"
                }`}>
                  {p.name.charAt(0).toUpperCase()}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-slate-900">{p.name}</p>
                    {isUrgent && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                        <AlertTriangle className="h-2.5 w-2.5" /> SOS
                      </span>
                    )}
                    {isSeen && (
                      <span className="inline-flex items-center gap-0.5 rounded-full border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-red-700">
                        SOS
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-slate-500">{p.email}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    {p.primaryConcern && (
                      <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
                        {p.primaryConcern}
                      </span>
                    )}
                    <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${
                      p.onboardingComplete
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-amber-50 text-amber-700"
                    }`}>
                      {p.onboardingComplete ? "Onboarded" : "In progress"}
                    </span>
                  </div>
                </div>

                <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-300 transition group-hover:text-[#2C3E6B]" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
