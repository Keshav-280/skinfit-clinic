"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronRight,
  LayoutGrid,
  List,
  Mail,
  RefreshCw,
  Search,
  User,
} from "lucide-react";
import { GLOBAL_LIVE_REFRESH_EVENT } from "@/src/lib/globalRefreshEvents";
import {
  DoctorCard,
  DoctorEmptyState,
  DoctorInlineLoader,
  doctorIvoryFieldClass,
  doctorIvoryToggleOnClass,
  doctorIvoryToggleShellClass,
  doctorPatientListRowClass,
  doctorPatientListRowUrgentClass,
  doctorPatientTileClass,
  doctorPatientTileUrgentClass,
} from "@/components/doctor/DoctorUiPrimitives";

type PatientRow = {
  id: string;
  name: string;
  email: string;
  primaryConcern: string | null;
  onboardingComplete: boolean;
  clinicVisited?: boolean;
  createdAt: string;
  sosRowTint?: "urgent" | "seen" | null;
  /** kAI questionnaire red flag (chronic concern / high sensitivity). */
  onboardingClinicalAlert?: boolean;
  lastSosAt?: string | null;
};

function patientShowsSosTag(p: PatientRow): boolean {
  return p.sosRowTint === "urgent" || Boolean(p.onboardingClinicalAlert);
}

type PatientsViewMode = "grid" | "list";

const VIEW_STORAGE_KEY = "doctor-patients-view";

const CONCERNS = [
  { value: "", label: "All concerns" },
  { value: "acne", label: "Acne" },
  { value: "pigmentation", label: "Pigmentation" },
  { value: "ageing", label: "Ageing" },
  { value: "hair", label: "Hair" },
  { value: "general", label: "General" },
] as const;

function PatientBadges({ p }: { p: PatientRow }) {
  const showSos = patientShowsSosTag(p);
  if (!showSos && !p.clinicVisited && p.onboardingComplete) return null;
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
      {showSos ? (
        <span
          className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-rose-700"
          title={
            p.onboardingClinicalAlert
              ? "kAI onboarding clinical flag — review questionnaire"
              : "Urgent patient message"
          }
        >
          <AlertTriangle className="h-2.5 w-2.5" aria-hidden />
          SOS
        </span>
      ) : null}
      {p.clinicVisited ? (
        <span className="rounded-full border border-[#2C3E6B]/20 bg-[#2C3E6B]/10 px-2 py-0.5 text-[10px] font-semibold text-[#2C3E6B]">
          Visited
        </span>
      ) : null}
      {!p.onboardingComplete ? (
        <span className="rounded-full border border-slate-200 bg-white/70 px-2 py-0.5 text-[10px] font-medium text-slate-600">
          Onboarding
        </span>
      ) : null}
    </div>
  );
}

function PatientCardLink({ p }: { p: PatientRow }) {
  const isUrgent = patientShowsSosTag(p);

  return (
    <Link
      href={`/doctor/patients/${p.id}`}
      className={`group relative block h-full min-h-[8.25rem] p-3.5 ${
        isUrgent ? doctorPatientTileUrgentClass : doctorPatientTileClass
      }`}
    >
      <div className="flex items-start justify-between gap-2.5">
        <p className="min-w-0 pr-1 text-[15px] font-semibold leading-snug tracking-[-0.01em] text-slate-900 group-hover:text-[#2C3E6B]">
          <span className="line-clamp-2">{p.name}</span>
        </p>
        <ChevronRight
          className="mt-0.5 h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-[#2C3E6B]"
          aria-hidden
        />
      </div>
      {p.email ? (
        <p
          className="mt-2 flex min-w-0 items-center gap-1.5 text-xs text-[#2C3E6B]"
          title={p.email}
        >
          <Mail className="h-3 w-3 shrink-0 text-[#2C3E6B]/70" aria-hidden />
          <span className="truncate font-medium">{p.email}</span>
        </p>
      ) : null}
      {p.primaryConcern ? (
        <p className="mt-1.5 truncate text-[11px] font-medium capitalize text-slate-500">
          {p.primaryConcern}
        </p>
      ) : null}
      <div className="mt-3">
        <PatientBadges p={p} />
      </div>
    </Link>
  );
}

function PatientListRow({ p }: { p: PatientRow }) {
  const isUrgent = patientShowsSosTag(p);

  return (
    <Link
      href={`/doctor/patients/${p.id}`}
      className={`group flex items-center gap-3 px-3 py-2.5 ${
        isUrgent ? doctorPatientListRowUrgentClass : doctorPatientListRowClass
      }`}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2C3E6B]/10 text-[#2C3E6B]">
        <User className="h-4 w-4" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900 group-hover:text-[#2C3E6B]">
          {p.name}
        </p>
        {p.email ? (
          <p className="mt-0.5 truncate text-xs text-slate-600" title={p.email}>
            {p.email}
          </p>
        ) : null}
      </div>
      {p.primaryConcern ? (
        <p className="hidden min-w-[5.5rem] shrink-0 truncate text-right text-xs font-medium capitalize text-slate-500 sm:block">
          {p.primaryConcern}
        </p>
      ) : null}
      <PatientBadges p={p} />
      <ChevronRight
        className="h-4 w-4 shrink-0 text-slate-300 group-hover:text-[#2C3E6B]"
        aria-hidden
      />
    </Link>
  );
}

function ViewToggle({
  view,
  onChange,
}: {
  view: PatientsViewMode;
  onChange: (v: PatientsViewMode) => void;
}) {
  return (
    <div
      className={doctorIvoryToggleShellClass}
      role="group"
      aria-label="Patient list layout"
    >
      <button
        type="button"
        onClick={() => onChange("grid")}
        className={`inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-semibold transition ${
          view === "grid"
            ? doctorIvoryToggleOnClass
            : "text-slate-600 hover:text-slate-900"
        }`}
        aria-pressed={view === "grid"}
      >
        <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
        Grid
      </button>
      <button
        type="button"
        onClick={() => onChange("list")}
        className={`inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-semibold transition ${
          view === "list"
            ? doctorIvoryToggleOnClass
            : "text-slate-600 hover:text-slate-900"
        }`}
        aria-pressed={view === "list"}
      >
        <List className="h-3.5 w-3.5" aria-hidden />
        List
      </button>
    </div>
  );
}

export function DoctorPatientsClient({
  initialSosOnly = false,
}: {
  initialSosOnly?: boolean;
}) {
  const [q, setQ] = useState("");
  const [concern, setConcern] = useState("");
  const [sosOnly, setSosOnly] = useState(initialSosOnly);
  const [view, setView] = useState<PatientsViewMode>("grid");
  const [rows, setRows] = useState<PatientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(VIEW_STORAGE_KEY);
      if (stored === "grid" || stored === "list") setView(stored);
    } catch {
      /* ignore */
    }
  }, []);

  const setViewMode = useCallback((next: PatientsViewMode) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

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
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        patients?: PatientRow[];
        error?: string;
      };
      if (!res.ok || !data.success) {
        setErr(
          data.error ??
            (res.status === 401
              ? "Session expired — sign in again."
              : "Could not load patients.")
        );
        setRows([]);
        return;
      }
      setRows(data.patients ?? []);
    } catch {
      setErr("Could not reach the server. Check your connection and try again.");
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

  const stats = useMemo(() => {
    const sos = rows.filter((r) => patientShowsSosTag(r)).length;
    return { total: rows.length, sos };
  }, [rows]);

  return (
    <DoctorCard
      variant="patients"
      className="flex h-full min-h-[min(520px,calc(100vh-5.5rem))] max-h-[calc(100vh-5.5rem)] flex-col p-4"
    >
      <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Patients</h2>
          <p className="text-xs text-slate-600">
            {stats.total} shown
            {stats.sos > 0 ? (
              <span className="font-semibold text-rose-700">
                {" "}
                · {stats.sos} with SOS
              </span>
            ) : null}
          </p>
        </div>
        <ViewToggle view={view} onChange={setViewMode} />
      </div>

      <form
        className="mb-3 flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center"
        onSubmit={(e) => {
          e.preventDefault();
          void load();
        }}
        role="search"
        aria-label="Filter patients"
      >
        <div className="relative min-w-0 flex-1">
          <label htmlFor="patient-search" className="sr-only">
            Search patients
          </label>
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#2C3E6B]/70"
            aria-hidden
          />
          <input
            id="patient-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name or email…"
            className={`w-full ${doctorIvoryFieldClass} py-2 pl-8 pr-3 text-sm outline-none focus:border-[#2C3E6B] focus:ring-2 focus:ring-[#2C3E6B]/20`}
          />
        </div>
        <select
          value={concern}
          onChange={(e) => setConcern(e.target.value)}
          className={`${doctorIvoryFieldClass} px-2.5 py-2 text-sm outline-none focus:border-[#2C3E6B] focus:ring-2 focus:ring-[#2C3E6B]/20`}
          aria-label="Filter by concern"
        >
          {CONCERNS.map((c) => (
            <option key={c.value || "any"} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-700">
          <input
            type="checkbox"
            checked={sosOnly}
            onChange={(e) => setSosOnly(e.target.checked)}
            className="accent-[#2C3E6B]"
          />
          Alerts
        </label>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center rounded-lg bg-[#2C3E6B] px-3 py-2 text-xs font-semibold text-white hover:bg-[#243356] disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden />
        </button>
      </form>

      {err ? (
        <p className="mb-2 shrink-0 text-sm text-red-600" role="alert">
          {err}
        </p>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-0.5 [-webkit-overflow-scrolling:touch]">
        {loading && rows.length === 0 ? (
          <DoctorInlineLoader label="Loading patients…" compact />
        ) : rows.length === 0 ? (
          <DoctorEmptyState
            icon={<User className="h-6 w-6" />}
            title="No patients found"
            description="Try adjusting search or filters."
          />
        ) : view === "list" ? (
          <ul className="flex flex-col gap-1.5" role="list" aria-label="Patients">
            {rows.map((p) => (
              <li key={p.id} className="min-w-0">
                <PatientListRow p={p} />
              </li>
            ))}
          </ul>
        ) : (
          <ul
            className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3"
            role="list"
            aria-label="Patients"
          >
            {rows.map((p) => (
              <li key={p.id} className="min-w-0">
                <PatientCardLink p={p} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </DoctorCard>
  );
}
