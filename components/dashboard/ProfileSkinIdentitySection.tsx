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
import { QuestionnaireLockedCard } from "@/components/dashboard/QuestionnaireLockedCard";
import {
  patientGlassShell,
  patientInnerCard,
  patientKicker,
  patientMuted,
} from "@/src/lib/patientDashboardTheme";

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
  questionnaireLocked?: boolean;
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
  formatter,
}: {
  label: string;
  initial: string | number | null;
  current: string | number | null;
  rationale: string;
  icon: LucideIcon;
  formatter?: (v: string | number) => string;
}) {
  const changed = initial !== current;
  return (
    <div className={`${patientInnerCard} p-3`}>
      <div className="flex items-center gap-2">
        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#1E1B31]/10 text-[#1E1B31]">
          <Icon className="h-4 w-4" />
        </span>
        <p className="text-[10px] font-bold uppercase tracking-wide text-[#1E1B31]/60">{label}</p>
        <span
          className={`ml-auto inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
            changed ? "bg-[#1E1B31]/15 text-[#1E1B31]" : "bg-white/60 text-[#6B7280]"
          }`}
        >
          {changed ? "Evolved" : "Stable"}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <div className="flex flex-col">
          <span className="text-[9px] font-semibold uppercase tracking-wide text-[#6B7280]">Initial</span>
          <span className="text-sm font-semibold text-[#374151]">{fmt(initial, formatter)}</span>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-[#1E1B31]/40" />
        <div className="flex flex-col">
          <span className="text-[9px] font-semibold uppercase tracking-wide text-[#1E1B31]/70">Now</span>
          <span className="text-sm font-bold text-[#1A1A2E]">{fmt(current, formatter)}</span>
        </div>
      </div>
      <p className="mt-2 text-[11px] leading-snug text-[#6B7280]">
        <span className="font-semibold text-[#1E1B31]/80">why:</span> {rationale}
      </p>
    </div>
  );
}

export function ProfileSkinIdentitySection({ embedded = false }: { embedded?: boolean }) {
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
      <div className="flex items-center gap-3 py-2">
        <Loader2 className="h-5 w-5 animate-spin text-[#1E1B31]" />
        <p className={`${patientMuted}`}>Loading skin identity…</p>
      </div>
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

  if (data.questionnaireLocked) {
    return <QuestionnaireLockedCard title="Skin identity insights are locked" />;
  }

  const { initial, current, changed } = data.timeline;

  const body = (
    <>
      {!embedded ? (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className={patientKicker}>Time-aware</p>
            <h3 className="text-base font-bold text-[#1E1B31]">
              {data.user.name}&apos;s evolving profile
            </h3>
            <p className={`mt-0.5 text-xs ${patientMuted}`}>
              Initial {initial.asOfDate} → current {current.asOfDate} · {current.dataDepth.scansConsidered} scans · {current.dataDepth.logsConsidered} logs
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-[#1E1B31]/10 px-2.5 py-1 text-xs font-bold text-[#1E1B31]">
            {changed.length} field{changed.length > 1 ? "s" : ""} evolved
          </span>
        </div>
      ) : (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className={patientKicker}>Time-aware profile</p>
            <p className={`text-xs ${patientMuted}`}>
              {initial.asOfDate} → {current.asOfDate} · {changed.length} evolved
            </p>
          </div>
        </div>
      )}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <EvolvingField label="Skin type" initial={initial.skinType} current={current.skinType} rationale={current.signals.skinType} icon={Dna} />
        <EvolvingField label="Primary concern" initial={initial.primaryConcern} current={current.primaryConcern} rationale={current.signals.primaryConcern} icon={Target} />
        <EvolvingField label="Sensitivity index" initial={initial.sensitivityIndex} current={current.sensitivityIndex} rationale={current.signals.sensitivityIndex} icon={Waves} formatter={(v) => `${v}/10`} />
        <EvolvingField label="UV sensitivity" initial={initial.uvSensitivity} current={current.uvSensitivity} rationale={current.signals.uvSensitivity} icon={Sun} />
        <EvolvingField label="Hormonal correlation" initial={initial.hormonalCorrelation} current={current.hormonalCorrelation} rationale={current.signals.hormonalCorrelation} icon={Activity} />
      </div>
      {false && changed.length > 0 ? (
        <div className="mt-3 rounded-xl border border-[#1E1B31]/15 bg-[#F0EAE2]/50 p-3">
          <p className={patientKicker}>What changed since initial analysis</p>
          <ul className="mt-1.5 space-y-1 text-sm text-[#374151]">
            {changed.map((c, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wide text-[#1E1B31]">{c.field}:</span>
                <span className="text-[#6B7280]">{String(c.from ?? "—")}</span>
                <ChevronRight className="h-3.5 w-3.5 text-[#1E1B31]/40" />
                <span className="font-semibold text-[#1A1A2E]">{String(c.to ?? "—")}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );

  if (embedded) return body;

  return (
    <section className={`overflow-hidden ${patientGlassShell} p-5 md:p-6`}>
      {body}
    </section>
  );
}

