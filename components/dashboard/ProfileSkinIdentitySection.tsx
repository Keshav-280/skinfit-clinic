"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  ChevronRight,
  Dna,
  Loader2,
  Sun,
  Target,
  Waves,
  type LucideIcon,
} from "lucide-react";

type TimelineIdentity = {
  asOfDate: string;
  skinType: string | null;
  primaryConcern: string | null;
  sensitivityIndex: number | null;
  uvSensitivity: string | null;
  hormonalCorrelation: string | null;
  signals: {
    skinType: string;
    primaryConcern: string;
    sensitivityIndex: string;
    uvSensitivity: string;
    hormonalCorrelation: string;
  };
  dataDepth: { scansConsidered: number; logsConsidered: number };
};

type IdentityPayload = {
  user: { name: string; email: string };
  timeline: {
    initial: TimelineIdentity;
    current: TimelineIdentity;
    changed: Array<{ field: string; from: string | number | null; to: string | number | null }>;
  };
};

function fmt(v: string | number | null, formatter?: (v: string | number) => string) {
  if (v == null || (typeof v === "string" && !v.trim())) return "—";
  return formatter ? formatter(v) : String(v);
}

function EvolvingField({
  label,
  initial,
  current,
  rationale,
  icon: Icon,
  accent,
  formatter,
}: {
  label: string;
  initial: string | number | null;
  current: string | number | null;
  rationale: string;
  icon: LucideIcon;
  accent: string;
  formatter?: (v: string | number) => string;
}) {
  const changed = initial !== current;
  return (
    <div className="rounded-xl border border-slate-200 bg-white/80 p-3 shadow-sm">
      <div className="flex items-center gap-2">
        <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${accent}`}>
          <Icon className="h-4 w-4" />
        </span>
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
        <span
          className={`ml-auto inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
            changed ? "bg-indigo-100 text-indigo-800" : "bg-slate-100 text-slate-600"
          }`}
        >
          {changed ? "Evolved" : "Stable"}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <div className="flex flex-col">
          <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">Initial</span>
          <span className="text-sm font-semibold text-slate-700">{fmt(initial, formatter)}</span>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
        <div className="flex flex-col">
          <span className="text-[9px] font-semibold uppercase tracking-wide text-emerald-700">Now</span>
          <span className="text-sm font-bold text-slate-900">{fmt(current, formatter)}</span>
        </div>
      </div>
      <p className="mt-2 text-[11px] leading-snug text-slate-500">
        <span className="font-semibold text-slate-600">why:</span> {rationale}
      </p>
    </div>
  );
}

export function ProfileSkinIdentitySection() {
  const [data, setData] = useState<IdentityPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch("/api/patient/skin-identity", { credentials: "include" });
        if (!res.ok) {
          if (res.status === 400) {
            if (!cancelled) setData(null);
            return;
          }
          throw new Error("failed");
        }
        const json = (await res.json()) as IdentityPayload;
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) {
          setErr("Could not load skin identity card.");
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <section className="flex items-center gap-3 rounded-[22px] bg-gradient-to-b from-violet-50 via-white to-teal-50 px-5 py-6 shadow-[0_8px_28px_-4px_rgba(15,23,42,0.07)] sm:px-6">
        <Loader2 className="h-5 w-5 animate-spin text-violet-700" />
        <p className="text-sm text-zinc-700">Loading skin identity card…</p>
      </section>
    );
  }
  if (err) {
    return (
      <section className="rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        {err}
      </section>
    );
  }
  if (!data) return null;

  const { initial, current, changed } = data.timeline;
  return (
    <section className="overflow-hidden rounded-[22px] border border-violet-100 bg-gradient-to-br from-violet-50 via-white to-teal-50 p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-800 shadow-sm">
            <Dna className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-violet-700">
              Skin identity card · time-aware
            </p>
            <h2 className="text-lg font-bold text-slate-900">{data.user.name}&apos;s skin DNA</h2>
            <p className="text-xs text-slate-500">
              Initial analysis {initial.asOfDate} → current {current.asOfDate} · {current.dataDepth.scansConsidered} scans · {current.dataDepth.logsConsidered} logs
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-bold text-indigo-800">
          {changed.length} field{changed.length > 1 ? "s" : ""} evolved
        </span>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <EvolvingField label="Skin type" initial={initial.skinType} current={current.skinType} rationale={current.signals.skinType} icon={Dna} accent="bg-violet-100 text-violet-800" />
        <EvolvingField label="Primary concern" initial={initial.primaryConcern} current={current.primaryConcern} rationale={current.signals.primaryConcern} icon={Target} accent="bg-rose-100 text-rose-800" />
        <EvolvingField label="Sensitivity index" initial={initial.sensitivityIndex} current={current.sensitivityIndex} rationale={current.signals.sensitivityIndex} icon={Waves} accent="bg-sky-100 text-sky-800" formatter={(v) => `${v}/10`} />
        <EvolvingField label="UV sensitivity" initial={initial.uvSensitivity} current={current.uvSensitivity} rationale={current.signals.uvSensitivity} icon={Sun} accent="bg-amber-100 text-amber-800" />
        <EvolvingField label="Hormonal correlation" initial={initial.hormonalCorrelation} current={current.hormonalCorrelation} rationale={current.signals.hormonalCorrelation} icon={Activity} accent="bg-teal-100 text-teal-800" />
      </div>
      {changed.length > 0 ? (
        <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50/60 p-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-indigo-800">What changed since initial analysis</p>
          <ul className="mt-1.5 space-y-1 text-sm text-slate-700">
            {changed.map((c, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wide text-indigo-700">{c.field}:</span>
                <span className="text-slate-500">{String(c.from ?? "—")}</span>
                <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                <span className="font-semibold text-slate-900">{String(c.to ?? "—")}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

