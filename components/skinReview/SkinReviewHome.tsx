"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Search } from "lucide-react";

type Waiting = { id: string; patientId: string; patientName: string; capturedAt: string; overdue: boolean };
type Patient = { id: string; name: string; phoneEnd: string | null; waiting: number; sent: number };

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

const hoursSince = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 3600_000);

export function SkinReviewHome({ reviewHours }: { reviewHours: number }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [data, setData] = useState<{ waiting: Waiting[]; patients: Patient[] } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/skin-review/overview?q=${encodeURIComponent(q)}`, { cache: "no-store" });
        if (res.status === 401) return router.refresh();
        const json = await res.json();
        if (!res.ok) throw new Error(json.message);
        if (alive) {
          setData(json);
          setError("");
        }
      } catch {
        if (alive) setError("Could not load. Check the connection.");
      }
    };
    const first = window.setTimeout(load, q ? 250 : 0);
    const again = window.setInterval(load, 60_000);
    return () => {
      alive = false;
      window.clearTimeout(first);
      window.clearInterval(again);
    };
  }, [q, router]);

  return (
    <div className="space-y-6">
      {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p> : null}

      <section className="rounded-2xl border border-[#E4E6F0] bg-white">
        <div className="border-b border-[#E4E6F0] px-4 py-3">
          <h1 className="font-headline text-lg font-semibold text-[#1E1B31]">
            Waiting for scores{data ? ` (${data.waiting.length})` : ""}
          </h1>
          <p className="text-xs text-[#6B7280]">Oldest first. Each patient was promised a report within {reviewHours} hours.</p>
        </div>
        {!data ? (
          <p className="px-4 py-6 text-sm text-[#6B7280]">Loading…</p>
        ) : data.waiting.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-[#6B7280]">Nothing is waiting.</p>
        ) : (
          <ul className="divide-y divide-[#E4E6F0]">
            {data.waiting.map((w) => (
              <li key={w.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-[#1E1B31]">{w.patientName}</p>
                  <p className="text-xs text-[#6B7280]">{when(w.capturedAt)}</p>
                </div>
                <span className={w.overdue ? "rounded-md bg-red-50 px-2 py-1 text-xs font-semibold text-red-800" : "text-xs text-[#6B7280]"}>
                  {w.overdue ? "Overdue, " : "Waiting "}
                  {hoursSince(w.capturedAt)} h
                </span>
                {/* A plain link: the marking screen is its own page. */}
                <a href={`/skin-review-tool.html?id=${w.id}`} className="rounded-lg bg-[#1E1B31] px-4 py-2 text-sm font-semibold text-white">
                  Mark and score
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-headline text-lg font-semibold text-[#1E1B31]">Patients</h2>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5B66A1]" aria-hidden />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, mobile or email"
            aria-label="Search patients"
            className="w-full rounded-xl border border-[#1E1B31]/15 bg-white py-3 pl-10 pr-4 text-base text-[#1E1B31]"
          />
        </div>
        {data && data.patients.length === 0 ? (
          <p className="text-sm text-[#6B7280]">{q ? "No patient found." : "No patient has sent a scan yet."}</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {data?.patients.map((p) => (
              <li key={p.id}>
                <Link href={`/skin-review/patients/${p.id}`} className="flex items-center gap-3 rounded-xl border border-[#E4E6F0] bg-white px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-[#1E1B31]">{p.name}</span>
                    <span className="text-xs text-[#6B7280]">
                      {p.phoneEnd ? `Mobile ending ${p.phoneEnd} | ` : ""}
                      {p.waiting} waiting | {p.sent} sent
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-[#5B66A1]" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
