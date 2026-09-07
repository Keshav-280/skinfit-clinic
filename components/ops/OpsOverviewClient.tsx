"use client";

import { useMemo, useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import {
  Camera,
  ClipboardList,
  LogIn,
  Search,
  UserPlus,
} from "lucide-react";
import type { OpsOverview, OpsPatientRow } from "@/src/lib/ops/loadOpsOverview";

function pct(part: number, whole: number): string {
  if (whole <= 0) return "—";
  return `${Math.round((part / whole) * 100)}%`;
}

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return format(d, "d MMM yyyy");
}

function formatAgo(iso: string | null): string {
  if (!iso) return "Never";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Never";
  return formatDistanceToNow(d, { addSuffix: true });
}

function StatusPill({
  ok,
  yes,
  no,
}: {
  ok: boolean;
  yes: string;
  no: string;
}) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${
        ok
          ? "bg-emerald-50 text-emerald-800"
          : "bg-[#F0EAE2] text-[#1E1B31]/55"
      }`}
    >
      {ok ? yes : no}
    </span>
  );
}

function StatCard({
  label,
  value,
  hint,
  Icon,
}: {
  label: string;
  value: number;
  hint: string;
  Icon: typeof UserPlus;
}) {
  return (
    <div className="rounded-2xl border border-[#E4E6F0] bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#1E1B31]/50">
          {label}
        </p>
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#1E1B31]/8 text-[#1E1B31]">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
      </div>
      <p className="mt-2 font-headline text-3xl font-bold tabular-nums text-[#1E1B31]">
        {value}
      </p>
      <p className="mt-1 text-xs text-[#6B7280]">{hint}</p>
    </div>
  );
}

export function OpsOverviewClient({ data }: { data: OpsOverview }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "scan" | "questionnaire" | "no-login">(
    "all"
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.patients.filter((row) => {
      if (filter === "scan" && !row.hasScan) return false;
      if (filter === "questionnaire" && !row.questionnaireDone) return false;
      if (filter === "no-login" && row.lastLoginAt) return false;
      if (!q) return true;
      return (
        row.name.toLowerCase().includes(q) ||
        row.email.toLowerCase().includes(q) ||
        (row.phone ?? "").toLowerCase().includes(q)
      );
    });
  }, [data.patients, filter, query]);

  const { totals } = data;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#1E1B31]/50">
          Website
        </p>
        <h1 className="font-headline text-2xl font-bold text-[#1E1B31]">
          Patient activity
        </h1>
        <p className="mt-1 text-sm text-[#6B7280]">
          Who signed up, who logged in, who scanned, and who finished the
          questionnaire.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Signed up"
          value={totals.signedUp}
          hint={`${totals.waitlist} on waitlist`}
          Icon={UserPlus}
        />
        <StatCard
          label="Logged in"
          value={totals.loggedIn}
          hint={`${totals.loggedInLast7Days} in last 7 days · ${pct(totals.loggedIn, totals.signedUp)} of signups`}
          Icon={LogIn}
        />
        <StatCard
          label="Took a scan"
          value={totals.tookScan}
          hint={`${pct(totals.tookScan, totals.signedUp)} of signups`}
          Icon={Camera}
        />
        <StatCard
          label="Questionnaire"
          value={totals.filledQuestionnaire}
          hint={`${pct(totals.filledQuestionnaire, totals.signedUp)} of signups · ${totals.weeklyCheckins} weekly check-ins`}
          Icon={ClipboardList}
        />
      </div>

      <section className="overflow-hidden rounded-2xl border border-[#E4E6F0] bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-[#E4E6F0] px-4 py-3 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-[#E4E6F0] bg-[#FAF8F5] px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-[#1E1B31]/40" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, email, or phone…"
              className="w-full bg-transparent text-sm text-[#1E1B31] outline-none placeholder:text-[#1E1B31]/35"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ["all", "All"],
                ["scan", "Scanned"],
                ["questionnaire", "Questionnaire"],
                ["no-login", "Never logged in"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                  filter === id
                    ? "bg-[#1E1B31] text-white"
                    : "bg-[#FAF8F5] text-[#1E1B31]/70 hover:bg-[#F0EAE2]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#FAF8F5] text-[11px] font-extrabold uppercase tracking-wide text-[#1E1B31]/50">
              <tr>
                <th className="px-4 py-2.5">Patient</th>
                <th className="px-4 py-2.5">Signed up</th>
                <th className="px-4 py-2.5">Last login</th>
                <th className="px-4 py-2.5">Scan</th>
                <th className="px-4 py-2.5">Questionnaire</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-10 text-center text-sm text-[#6B7280]"
                  >
                    No patients match this filter.
                  </td>
                </tr>
              ) : (
                rows.map((row: OpsPatientRow) => (
                  <tr
                    key={row.id}
                    className="border-t border-[#E4E6F0] align-top"
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[#1E1B31]">{row.name}</p>
                      <p className="text-xs text-[#6B7280]">{row.email}</p>
                      {row.phone ? (
                        <p className="text-xs text-[#6B7280]">{row.phone}</p>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[#1E1B31]">
                      {formatWhen(row.signedUpAt)}
                    </td>
                    <td className="px-4 py-3 text-[#1E1B31]">
                      <p>{formatAgo(row.lastLoginAt)}</p>
                      {row.lastLoginAt ? (
                        <p className="text-xs text-[#6B7280]">
                          {formatWhen(row.lastLoginAt)}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill
                        ok={row.hasScan}
                        yes={row.scanCount === 1 ? "1 scan" : `${row.scanCount} scans`}
                        no="None"
                      />
                      {row.lastScanAt ? (
                        <p className="mt-1 text-xs text-[#6B7280]">
                          Last {formatWhen(row.lastScanAt)}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill
                        ok={row.questionnaireDone}
                        yes="Filled"
                        no="Not yet"
                      />
                      {row.questionnaireAt ? (
                        <p className="mt-1 text-xs text-[#6B7280]">
                          {formatWhen(row.questionnaireAt)}
                        </p>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="border-t border-[#E4E6F0] px-4 py-2.5 text-xs text-[#6B7280]">
          Showing {rows.length} of {data.patients.length} patients
        </p>
      </section>
    </div>
  );
}
