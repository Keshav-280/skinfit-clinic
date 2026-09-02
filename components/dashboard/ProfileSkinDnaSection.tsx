"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ChevronRight,
  ListChecks,
} from "lucide-react";
import { QuestionnaireLockedCard } from "@/components/dashboard/QuestionnaireLockedCard";
import {
  patientInnerCard,
  patientKicker,
  patientMuted,
  patientPrimaryBtn,
  patientScoreChip,
  patientStatTile,
} from "@/src/lib/patientDashboardTheme";

type SkinProfilePayload = {
  questionnaireLocked?: boolean;
  skinDna: {
    skinType: string | null;
    primaryConcern: string | null;
    sensitivityIndex: number | null;
    uvSensitivity: string | null;
    hormonalCorrelation: string | null;
  };
  lastWeekObservations: string | null;
  keyObservations?: {
    mode: string;
    modeLabel: string;
    logDaysUsed: string[];
    scanDaysUsed: string[];
    baselineScanDateYmd: string | null;
    items: Array<{
      text: string;
      source: string;
      dateLabel: string;
    }>;
  };
  priorityKnowDo: { know: string[]; do: string[] };
  sparklines: Record<
    string,
    { values: (number | null)[]; sources: string[] }
  >;
  paramLabels: Record<string, string>;
  visits: Array<{
    id: string;
    visitDate: string;
    doctorName: string;
    purpose: string | null;
    treatments: string | null;
    notes: string;
    responseRating: string | null;
  }>;
};

function ProfileSkinDnaSkeleton() {
  return (
    <div className="space-y-6">
      <div
        className="overflow-hidden rounded-[22px] bg-gradient-to-b from-white to-[#FAF8F5]/90 p-6 shadow-[0_8px_28px_-4px_rgba(15,23,42,0.07)]"
        style={{ border: "1px solid #eee7dc" }}
      >
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 animate-pulse rounded-2xl bg-[#F8EDEE]/60" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-40 animate-pulse rounded bg-zinc-200/80" />
            <div className="h-3 w-full max-w-md animate-pulse rounded bg-zinc-100" />
          </div>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-xl bg-zinc-100/70"
            />
          ))}
        </div>
        <div className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-xl bg-zinc-100/50"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function DnaStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className={patientStatTile}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#1E1B31]/60">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold leading-snug text-[#1A1A2E]">{value}</p>
    </div>
  );
}

function MetricTile({
  label,
  pendingOnly,
  values,
}: {
  label: string;
  pendingOnly: boolean;
  values: (number | null)[];
}) {
  const latest = values[0];
  const hasScore = !pendingOnly && latest != null && Number.isFinite(latest);
  const n = hasScore ? Math.round(latest as number) : null;

  return (
    <div className={patientStatTile}>
      <p className="text-[11px] font-bold uppercase tracking-wide text-[#1E1B31]/60">
        {label}
      </p>
      {pendingOnly || n == null ? (
        <p className="mt-2 text-xs font-medium text-[#6B7280]">
          In-clinic measurement
        </p>
      ) : (
        <>
          <p className="mt-1 text-2xl font-bold tabular-nums text-[#1E1B31]">
            {n}
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#F0EAE2]">
            <div
              className="h-full rounded-full bg-[#1E1B31] transition-[width] duration-500"
              style={{ width: `${Math.min(100, Math.max(0, n))}%` }}
            />
          </div>
        </>
      )}
    </div>
  );
}

export function ProfileSkinDnaSection({ embedded = false }: { embedded?: boolean }) {
  const [data, setData] = useState<SkinProfilePayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch("/api/patient/skin-profile", {
          credentials: "include",
        });
        if (!res.ok) {
          if (!cancelled) setData(null);
          return;
        }
        const json = (await res.json()) as SkinProfilePayload;
        if (!cancelled) {
          setData(json);
          setErr(null);
        }
      } catch {
        if (!cancelled) {
          setErr("Could not load Skin DNA snapshot.");
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
    return <ProfileSkinDnaSkeleton />;
  }

  if (err) {
    return (
      <div
        className="rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        role="status"
      >
        {err}
      </div>
    );
  }

  if (!data) return null;

  if (data.questionnaireLocked) {
    return <QuestionnaireLockedCard title="Skin DNA is locked" />;
  }

  // const paramKeys = Object.keys(data.sparklines);

  const body = (
    <>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className={patientMuted}>Your baseline profile from onboarding and recent scans.</p>
          <Link href="/dashboard/history" className={patientPrimaryBtn}>
            View scan reports
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            <DnaStat label="Skin type" value={data.skinDna.skinType ?? "-"} />
            <DnaStat
              label="Primary concern"
              value={data.skinDna.primaryConcern ?? "-"}
            />
            <DnaStat
              label="Sensitivity index"
              value={
                data.skinDna.sensitivityIndex != null
                  ? `${data.skinDna.sensitivityIndex}/10`
                  : "-"
              }
            />
            <DnaStat label="UV sensitivity" value={data.skinDna.uvSensitivity ?? "-"} />
            <DnaStat
              label="Hormonal correlation"
              value={data.skinDna.hormonalCorrelation ?? "-"}
            />
          </div>

          {data.keyObservations?.items?.length ? (
            <div className={`${patientInnerCard} bg-[#F0EAE2]/40 px-4 py-3`}>
              <p className={patientKicker}>Key observations</p>
              <p className="mt-1 text-xs text-[#6B7280]">
                {data.keyObservations.modeLabel}
              </p>
              <ul className="mt-3 space-y-3">
                {data.keyObservations.items.map((item, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1E1B31]/10 text-xs font-bold text-[#1E1B31]">
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#6B7280]">
                        {item.dateLabel}
                        {item.source ? ` · ${item.source.replace(/_/g, " ")}` : ""}
                      </p>
                      <p className="mt-0.5 text-[#374151]">{item.text}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : data.lastWeekObservations ? (
            <div className={`${patientInnerCard} bg-[#F0EAE2]/40 px-4 py-3`}>
              <p className={patientKicker}>Last check-in</p>
              <p className="mt-2 text-sm text-[#374151]">{data.lastWeekObservations}</p>
            </div>
          ) : null}

          <div>
            <div className="mb-3 flex items-center gap-2">
              <ListChecks className="h-5 w-5 text-[#1E1B31]" aria-hidden />
              <h3 className="text-sm font-bold text-[#1E1B31]">
                3 things to focus on
              </h3>
            </div>
            <ol className="grid gap-3 sm:grid-cols-1">
              {data.priorityKnowDo.do.map((t, i) => (
                <li
                  key={i}
                  className={`flex gap-3 ${patientInnerCard} px-4 py-3`}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1E1B31]/10 text-sm font-bold text-[#1E1B31]">
                    {i + 1}
                  </span>
                  <p className="pt-1 text-sm leading-snug text-[#374151]">
                    {t}
                  </p>
                </li>
              ))}
            </ol>
          </div>

          {/*
          Last scans (up to 4) - hidden per profile layout request.
          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Microscope className="h-5 w-5 text-[#1E1B31]" aria-hidden />
                <h3 className="text-sm font-bold text-[#1E1B31]">
                  Last scans (up to 4)
                </h3>
              </div>
              <p className="text-xs text-[#6B7280]">
                Newest scan first · scores when available
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {paramKeys.map((key) => {
                const sp = data.sparklines[key];
                const label = data.paramLabels[key] ?? key;
                const pendingOnly =
                  sp?.sources?.every((s) => s === "pending") ?? false;
                return (
                  <MetricTile
                    key={key}
                    label={label}
                    pendingOnly={pendingOnly}
                    values={sp?.values ?? []}
                  />
                );
              })}
            </div>
          </div>
          */}
        </div>
    </>
  );

  if (embedded) return body;

  return <div className="space-y-6">{body}</div>;
}
