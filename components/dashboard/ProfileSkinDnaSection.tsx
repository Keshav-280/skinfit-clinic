"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import {
  ChevronRight,
  Dna,
  ListChecks,
  Microscope,
} from "lucide-react";

type SkinProfilePayload = {
  skinDna: {
    skinType: string | null;
    primaryConcern: string | null;
    sensitivityIndex: number | null;
    uvSensitivity: string | null;
    hormonalCorrelation: string | null;
  };
  lastWeekObservations: string | null;
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
        className="overflow-hidden rounded-[22px] bg-gradient-to-b from-white to-[#FAF8F4]/90 p-6 shadow-[0_8px_28px_-4px_rgba(15,23,42,0.07)]"
        style={{ border: "1px solid #eee7dc" }}
      >
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 animate-pulse rounded-2xl bg-teal-100/60" />
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

function Pill({ children }: { children: ReactNode }) {
  return (
    <span
      className="inline-flex items-center rounded-full bg-[#f0ebe3] px-3 py-1 text-xs font-semibold text-zinc-800"
      style={{ border: "1px solid #ddd6cc" }}
    >
      {children}
    </span>
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
    <div
      className="rounded-xl bg-white px-3.5 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
      style={{ border: "1px solid #e8e2d8" }}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold leading-snug text-zinc-900">{value}</p>
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
    <div
      className="rounded-xl bg-white/90 px-3 py-3 shadow-[0_1px_3px_rgba(15,23,42,0.05)]"
      style={{ border: "1px solid #e8e2d8" }}
    >
      <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      {pendingOnly || n == null ? (
        <p className="mt-2 text-xs font-medium text-zinc-500">
          In-clinic measurement
        </p>
      ) : (
        <>
          <p className="mt-1 text-2xl font-bold tabular-nums text-teal-800">
            {n}
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-200/80">
            <div
              className="h-full rounded-full bg-teal-600 transition-[width] duration-500"
              style={{ width: `${Math.min(100, Math.max(0, n))}%` }}
            />
          </div>
        </>
      )}
    </div>
  );
}

export function ProfileSkinDnaSection() {
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

  const paramKeys = Object.keys(data.sparklines);

  return (
    <div className="space-y-6">
      <section
        className="overflow-hidden rounded-[22px] bg-gradient-to-b from-white to-[#FAF8F4]/90 shadow-[0_8px_28px_-4px_rgba(15,23,42,0.07)]"
        style={{ border: "1px solid #eee7dc" }}
      >
        <div className="border-b border-stone-200/40 bg-gradient-to-r from-teal-50/80 to-transparent px-5 py-4 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal-100 text-teal-800 shadow-sm">
                <Dna className="h-6 w-6" aria-hidden />
              </span>
              <div>
                <h2 className="text-lg font-bold tracking-tight text-zinc-900">
                  Skin DNA snapshot
                </h2>
                <p className="mt-1 max-w-xl text-sm text-zinc-600">
                  A quick read on your skin profile and recent scan parameters.
                </p>
              </div>
            </div>
            <Link
              href="/dashboard/history"
              className="inline-flex shrink-0 items-center justify-center gap-1.5 self-start rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_2px_8px_-2px_rgba(15,118,110,0.45)] transition hover:bg-teal-700"
            >
              View scan reports
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>

        <div className="space-y-6 p-5 sm:p-6">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            <DnaStat label="Skin type" value={data.skinDna.skinType ?? "—"} />
            <DnaStat
              label="Primary concern"
              value={data.skinDna.primaryConcern ?? "—"}
            />
            <DnaStat
              label="Sensitivity index"
              value={
                data.skinDna.sensitivityIndex != null
                  ? `${data.skinDna.sensitivityIndex}/10`
                  : "—"
              }
            />
            <DnaStat label="UV sensitivity" value={data.skinDna.uvSensitivity ?? "—"} />
            <DnaStat
              label="Hormonal correlation"
              value={data.skinDna.hormonalCorrelation ?? "—"}
            />
          </div>

          {data.lastWeekObservations ? (
            <div
              className="rounded-xl bg-[#f5f2ed] px-4 py-3 text-sm leading-relaxed text-zinc-800"
              style={{ border: "1px solid #e4ddd4" }}
            >
              <p className="text-[11px] font-bold uppercase tracking-wide text-teal-800">
                Last check-in
              </p>
              <p className="mt-2 text-zinc-700">{data.lastWeekObservations}</p>
            </div>
          ) : null}

          <div>
            <div className="mb-3 flex items-center gap-2">
              <ListChecks className="h-5 w-5 text-teal-700" aria-hidden />
              <h3 className="text-sm font-bold text-zinc-900">
                3 things to focus on
              </h3>
            </div>
            <ol className="grid gap-3 sm:grid-cols-1">
              {data.priorityKnowDo.do.map((t, i) => (
                <li
                  key={i}
                  className="flex gap-3 rounded-xl bg-white/95 px-4 py-3 shadow-[0_1px_3px_rgba(15,23,42,0.04)]"
                  style={{ border: "1px solid #e8e2d8" }}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-100 text-sm font-bold text-teal-900">
                    {i + 1}
                  </span>
                  <p className="pt-1 text-sm leading-snug text-zinc-800">
                    {t}
                  </p>
                </li>
              ))}
            </ol>
          </div>

          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Microscope className="h-5 w-5 text-teal-700" aria-hidden />
                <h3 className="text-sm font-bold text-zinc-900">
                  Last scans (up to 4)
                </h3>
              </div>
              <p className="text-xs text-zinc-500">
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
        </div>
      </section>

      {data.visits.length > 0 ? (
        <section
          className="rounded-[22px] bg-gradient-to-b from-white to-[#FAF8F4]/90 p-5 shadow-[0_8px_28px_-4px_rgba(15,23,42,0.07)] sm:p-6"
          style={{ border: "1px solid #eee7dc" }}
        >
          <h2 className="text-lg font-bold text-zinc-900">Recent visits</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Notes from your clinic appointments.
          </p>
          <div className="mt-4 space-y-3">
            {data.visits.slice(0, 5).map((v) => (
              <div
                key={v.id}
                className="rounded-xl bg-white/95 p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)]"
                style={{ border: "1px solid #e8e2d8" }}
              >
                <p className="font-semibold text-zinc-900">
                  {v.visitDate} · {v.doctorName}
                </p>
                {v.purpose ? (
                  <p className="mt-2 text-sm text-zinc-700">Purpose: {v.purpose}</p>
                ) : null}
                {v.treatments ? (
                  <p className="mt-1 text-sm text-zinc-700">
                    Treatments: {v.treatments}
                  </p>
                ) : null}
                <p className="mt-2 line-clamp-4 text-sm text-zinc-600">
                  {v.notes}
                </p>
                {v.responseRating ? (
                  <p className="mt-2 text-xs font-semibold text-teal-700">
                    Response: {v.responseRating}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
