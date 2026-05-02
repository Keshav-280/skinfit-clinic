"use client";

import { useEffect, useState } from "react";

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

export function ProfileSkinDnaSection() {
  const [data, setData] = useState<SkinProfilePayload | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
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
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  return (
    <div className="space-y-6">
      <section className="rounded-[22px] border border-zinc-100 bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
        <h2 className="text-lg font-bold text-zinc-900">Skin DNA snapshot</h2>
        <p className="mt-2 text-sm text-zinc-600">
          Type: {data.skinDna.skinType ?? "—"} · Concern:{" "}
          {data.skinDna.primaryConcern ?? "—"}
        </p>
        {data.lastWeekObservations ? (
          <p className="mt-3 text-sm leading-relaxed text-zinc-700">
            {data.lastWeekObservations}
          </p>
        ) : null}
        <p className="mt-4 text-sm font-semibold text-zinc-800">
          3 things to do
        </p>
        <ul className="mt-2 list-decimal space-y-1 pl-5 text-sm text-zinc-700">
          {data.priorityKnowDo.do.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
        <p className="mt-4 text-sm font-semibold text-zinc-800">
          Last scans (up to 4)
        </p>
        <ul className="mt-2 space-y-1 text-sm text-zinc-600">
          {Object.keys(data.sparklines).map((key) => {
            const sp = data.sparklines[key];
            const label = data.paramLabels[key] ?? key;
            const pendingOnly =
              sp?.sources?.every((s) => s === "pending") ?? false;
            return (
              <li key={key}>
                <span className="font-medium text-zinc-800">{label}:</span>{" "}
                {pendingOnly
                  ? "In-clinic measurement only"
                  : (sp?.values ?? [])
                      .map((v) => (v == null ? "—" : String(v)))
                      .join(" · ")}
              </li>
            );
          })}
        </ul>
      </section>

      {data.visits.length > 0 ? (
        <section className="rounded-[22px] border border-zinc-100 bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
          <h2 className="text-lg font-bold text-zinc-900">Recent visits</h2>
          <div className="mt-4 space-y-4">
            {data.visits.slice(0, 5).map((v) => (
              <div
                key={v.id}
                className="rounded-xl border border-zinc-100 bg-zinc-50/80 p-4 text-sm"
              >
                <p className="font-semibold text-zinc-900">
                  {v.visitDate} · {v.doctorName}
                </p>
                {v.purpose ? (
                  <p className="mt-2 text-zinc-700">Purpose: {v.purpose}</p>
                ) : null}
                {v.treatments ? (
                  <p className="mt-1 text-zinc-700">
                    Treatments: {v.treatments}
                  </p>
                ) : null}
                <p className="mt-2 line-clamp-4 text-zinc-600">{v.notes}</p>
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
