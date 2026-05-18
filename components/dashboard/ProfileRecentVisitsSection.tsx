"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { CalendarDays, ChevronRight, Stethoscope } from "lucide-react";

type VisitRow = {
  id: string;
  visitDate: string;
  doctorName: string;
  purpose: string | null;
  treatments: string | null;
  notes: string;
  responseRating: string | null;
};

function formatVisitDate(ymd: string): string {
  try {
    return format(parseISO(`${ymd}T12:00:00`), "d MMM yyyy");
  } catch {
    return ymd;
  }
}

function VisitCard({ v }: { v: VisitRow }) {
  return (
    <Link
      href={`/dashboard/history/visits/${v.id}`}
      className="block rounded-xl bg-white/95 p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)] transition hover:bg-white"
      style={{ border: "1px solid #e8e2d8" }}
    >
      <p className="font-semibold text-zinc-900">
        {formatVisitDate(v.visitDate)} · {v.doctorName}
      </p>
      {v.purpose ? (
        <p className="mt-2 text-sm text-zinc-700">Purpose: {v.purpose}</p>
      ) : null}
      {v.treatments ? (
        <p className="mt-1 text-sm text-zinc-700">Treatments: {v.treatments}</p>
      ) : null}
      <p className="mt-2 line-clamp-4 text-sm leading-relaxed text-zinc-600">
        {v.notes?.trim() || "No written notes for this visit."}
      </p>
      {v.responseRating ? (
        <p className="mt-2 text-xs font-semibold capitalize text-teal-700">
          Response: {v.responseRating}
        </p>
      ) : null}
    </Link>
  );
}

export function ProfileRecentVisitsSection() {
  const [visits, setVisits] = useState<VisitRow[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [profileRes, historyRes] = await Promise.all([
          fetch("/api/patient/skin-profile", { credentials: "include" }),
          fetch("/api/patient/history", { credentials: "include" }),
        ]);

        let rows: VisitRow[] = [];

        if (profileRes.ok) {
          const profile = (await profileRes.json()) as { visits?: VisitRow[] };
          if (Array.isArray(profile.visits)) {
            rows = profile.visits;
          }
        }

        if (rows.length === 0 && historyRes.ok) {
          const history = (await historyRes.json()) as {
            visitNotes?: Array<{
              id: string;
              visitDateYmd: string;
              doctorName: string;
              notes: string;
              purpose?: string | null;
              treatments?: string | null;
              responseRating?: string | null;
            }>;
          };
          if (Array.isArray(history.visitNotes)) {
            rows = history.visitNotes.map((v) => ({
              id: v.id,
              visitDate: v.visitDateYmd,
              doctorName: v.doctorName,
              purpose: v.purpose ?? null,
              treatments: v.treatments ?? null,
              notes: v.notes,
              responseRating: v.responseRating ?? null,
            }));
          }
        }

        if (!cancelled) setVisits(rows);
      } catch {
        if (!cancelled) setVisits([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const list = visits ?? [];
  const latest = list[0];

  return (
    <section
      className="rounded-[22px] bg-gradient-to-b from-white to-[#FAF8F4]/90 p-5 shadow-[0_8px_28px_-4px_rgba(15,23,42,0.07)] sm:p-6"
      style={{ border: "1px solid #eee7dc" }}
      aria-labelledby="profile-recent-visits-heading"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal-100 text-teal-800 shadow-sm">
            <Stethoscope className="h-6 w-6" aria-hidden />
          </span>
          <div>
            <h2
              id="profile-recent-visits-heading"
              className="text-lg font-bold tracking-tight text-zinc-900"
            >
              Recent visits
            </h2>
            <p className="mt-1 max-w-xl text-sm text-zinc-600">
              Notes from your clinic appointments — same as treatment history.
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/history"
          className="inline-flex shrink-0 items-center justify-center gap-1.5 self-start rounded-xl bg-[#2C3E6B] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#3d5080]"
        >
          Treatment history
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>

      {loading ? (
        <div className="mt-6 space-y-3">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-xl bg-zinc-100/70"
            />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-zinc-200 bg-white/60 px-4 py-8 text-center">
          <CalendarDays className="mx-auto h-8 w-8 text-zinc-400" aria-hidden />
          <p className="mt-3 text-sm font-medium text-zinc-700">
            No clinic visits on file yet
          </p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-zinc-500">
            After your doctor adds visit notes, they will appear here and under
            treatment history.
          </p>
        </div>
      ) : (
        <>
          {latest ? (
            <div
              className="mt-6 flex flex-col gap-3 rounded-xl bg-[#e8ede6]/90 p-4 sm:flex-row sm:items-center sm:justify-between"
              style={{ border: "1px solid #d4ddd2" }}
            >
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                  Last treatment
                </p>
                <p className="mt-1 text-base font-bold text-zinc-900">
                  {formatVisitDate(latest.visitDate)}
                </p>
                <p className="text-sm text-zinc-600">with {latest.doctorName}</p>
              </div>
              <Link
                href={`/dashboard/history/visits/${latest.id}`}
                className="inline-flex items-center justify-center rounded-full bg-[#2C3E6B] px-5 py-2 text-sm font-semibold text-white"
              >
                View
              </Link>
            </div>
          ) : null}

          <div className="mt-4 space-y-3">
            {list.slice(0, 5).map((v) => (
              <VisitCard key={v.id} v={v} />
            ))}
          </div>

          {list.length > 5 ? (
            <p className="mt-3 text-center text-sm text-zinc-500">
              Showing 5 of {list.length} visits.{" "}
              <Link href="/dashboard/history" className="font-semibold text-teal-700 underline">
                See all
              </Link>
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
