"use client";

import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  Camera,
  ClipboardList,
  LogIn,
  Search,
  UserPlus,
} from "lucide-react";
import {
  hasReturnedToPortal,
  inferLastSeenAt,
  type OpsOverview,
  type OpsPatientRow,
} from "@/src/lib/ops/opsOverviewShared";
import {
  formatOpsDateTime,
  formatOpsDayLabel,
  formatOpsDayLong,
  opsTodayYmd,
  opsYesterdayYmd,
  opsYmd,
  parseOpsInstant,
} from "@/src/lib/ops/opsDates";

function pct(part: number, whole: number): string {
  if (whole <= 0) return "—";
  return `${Math.round((part / whole) * 100)}%`;
}

function formatWhen(iso: string | null): string {
  return formatOpsDateTime(iso);
}

function formatAgo(iso: string | null): string {
  const d = parseOpsInstant(iso);
  if (!d) return "Never";
  return formatDistanceToNow(d, { addSuffix: true });
}

function latestActivityAt(row: OpsPatientRow): number {
  const stamps = [
    row.signedUpAt,
    row.lastLoginAt,
    row.lastScanAt,
    row.questionnaireAt,
    ...row.loginAtList,
    ...row.scanAtList,
  ];
  let max = 0;
  for (const stamp of stamps) {
    if (!stamp) continue;
    const t = Date.parse(stamp);
    if (Number.isFinite(t) && t > max) max = t;
  }
  return max;
}

function activityOnDay(row: OpsPatientRow, ymd: string) {
  const signedUp = opsYmd(row.signedUpAt) === ymd;
  const recordedLogin =
    opsYmd(row.lastLoginAt) === ymd ||
    row.loginAtList.some((stamp) => opsYmd(stamp) === ymd);
  const scanned = row.scanAtList.some((stamp) => opsYmd(stamp) === ymd);
  const questionnaire = opsYmd(row.questionnaireAt) === ymd;
  const usedPortal = recordedLogin || scanned || questionnaire;
  return {
    signedUp,
    loggedIn: !signedUp && usedPortal,
    scanned,
    questionnaire,
    any: signedUp || usedPortal,
  };
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
  const [dayYmd, setDayYmd] = useState<string>("");

  const activeDays = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of data.patients) {
      const days = new Set<string>();
      const add = (stamp: string | null | undefined) => {
        const ymd = opsYmd(stamp);
        if (ymd) days.add(ymd);
      };
      add(row.signedUpAt);
      add(row.lastLoginAt);
      add(row.questionnaireAt);
      row.loginAtList.forEach(add);
      row.scanAtList.forEach(add);
      for (const ymd of days) {
        counts.set(ymd, (counts.get(ymd) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort(([a], [b]) => (a < b ? 1 : -1))
      .slice(0, 14);
  }, [data.patients]);

  const dayLabel = dayYmd
    ? formatOpsDayLong(dayYmd)
    : "All days";

  const scoped = useMemo(() => {
    return data.patients.filter((row) => {
      if (!dayYmd) return true;
      return activityOnDay(row, dayYmd).any;
    });
  }, [data.patients, dayYmd]);

  const dayTotals = useMemo(() => {
    if (!dayYmd) {
      return {
        signedUp: data.totals.signedUp,
        loggedIn: data.totals.loggedIn,
        tookScan: data.totals.tookScan,
        filledQuestionnaire: data.totals.filledQuestionnaire,
        loggedInLast7Days: data.totals.loggedInLast7Days,
      };
    }
    let signedUp = 0;
    let loggedIn = 0;
    let tookScan = 0;
    let filledQuestionnaire = 0;
    for (const row of data.patients) {
      const activity = activityOnDay(row, dayYmd);
      if (activity.signedUp) signedUp += 1;
      if (activity.loggedIn) loggedIn += 1;
      if (activity.scanned) tookScan += 1;
      if (activity.questionnaire) filledQuestionnaire += 1;
    }
    return {
      signedUp,
      loggedIn,
      tookScan,
      filledQuestionnaire,
      loggedInLast7Days: data.totals.loggedInLast7Days,
    };
  }, [data.patients, data.totals, dayYmd]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scoped
      .filter((row) => {
        if (filter === "scan") {
          return dayYmd ? activityOnDay(row, dayYmd).scanned : row.hasScan;
        }
        if (filter === "questionnaire") {
          return dayYmd
            ? activityOnDay(row, dayYmd).questionnaire
            : row.questionnaireDone;
        }
        if (filter === "no-login") {
          if (!dayYmd) return !hasReturnedToPortal(row);
          const activity = activityOnDay(row, dayYmd);
          return activity.signedUp && !activity.scanned && !activity.questionnaire;
        }
        return true;
      })
      .filter((row) => {
        if (!q) return true;
        return (
          row.name.toLowerCase().includes(q) ||
          row.email.toLowerCase().includes(q) ||
          (row.phone ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => latestActivityAt(b) - latestActivityAt(a));
  }, [scoped, filter, query, dayYmd]);

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
          Daily signups, returning visits, scans, and questionnaires. Last seen
          is the latest time they used the website. Newest activity is at the
          top.
        </p>
      </div>

      <div className="rounded-2xl border border-[#E4E6F0] bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-[#1E1B31]">
            Showing {dayLabel}
            <span className="ml-2 text-xs font-medium text-[#6B7280]">
              India time (IST)
            </span>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setDayYmd("")}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                dayYmd === ""
                  ? "bg-[#1E1B31] text-white"
                  : "bg-[#FAF8F5] text-[#1E1B31]/70 hover:bg-[#F0EAE2]"
              }`}
            >
              All days
            </button>
            <button
              type="button"
              onClick={() => setDayYmd(opsTodayYmd())}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                dayYmd === opsTodayYmd()
                  ? "bg-[#1E1B31] text-white"
                  : "bg-[#FAF8F5] text-[#1E1B31]/70 hover:bg-[#F0EAE2]"
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setDayYmd(opsYesterdayYmd())}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                dayYmd === opsYesterdayYmd()
                  ? "bg-[#1E1B31] text-white"
                  : "bg-[#FAF8F5] text-[#1E1B31]/70 hover:bg-[#F0EAE2]"
              }`}
            >
              Yesterday
            </button>
            <label className="flex items-center gap-2 rounded-full bg-[#FAF8F5] px-3 py-1.5 text-xs font-semibold text-[#1E1B31]/70">
              Pick a day
              <input
                type="date"
                value={dayYmd}
                onChange={(e) => setDayYmd(e.target.value)}
                className="bg-transparent text-xs text-[#1E1B31] outline-none"
              />
            </label>
          </div>
        </div>
        {activeDays.length > 0 ? (
          <div className="mt-3 flex gap-1.5 overflow-x-auto pb-0.5">
            {activeDays.map(([ymd, count]) => (
              <button
                key={ymd}
                type="button"
                onClick={() => setDayYmd(ymd)}
                className={`shrink-0 rounded-xl border px-3 py-2 text-left ${
                  dayYmd === ymd
                    ? "border-[#1E1B31] bg-[#1E1B31] text-white"
                    : "border-[#E4E6F0] bg-[#FAF8F5] text-[#1E1B31] hover:border-[#1E1B31]/25"
                }`}
              >
                <p className="text-[11px] font-bold">
                  {formatOpsDayLabel(ymd)}
                </p>
                <p
                  className={`text-[10px] ${
                    dayYmd === ymd ? "text-white/70" : "text-[#6B7280]"
                  }`}
                >
                  {count} {count === 1 ? "person" : "people"}
                </p>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Signed up"
          value={dayTotals.signedUp}
          hint={
            dayYmd
              ? `New accounts on ${dayLabel}`
              : `${data.totals.waitlist} on waitlist`
          }
          Icon={UserPlus}
        />
        <StatCard
          label="Logged in"
          value={dayTotals.loggedIn}
          hint={
            dayYmd
              ? `Existing patients who used the site on ${dayLabel}`
              : `${data.totals.loggedInLast7Days} in last 7 days · ${pct(data.totals.loggedIn, data.totals.signedUp)} of signups`
          }
          Icon={LogIn}
        />
        <StatCard
          label="Took a scan"
          value={dayTotals.tookScan}
          hint={
            dayYmd
              ? `Scans on ${dayLabel}`
              : `${pct(data.totals.tookScan, data.totals.signedUp)} of signups`
          }
          Icon={Camera}
        />
        <StatCard
          label="Questionnaire"
          value={dayTotals.filledQuestionnaire}
          hint={
            dayYmd
              ? `Questionnaires on ${dayLabel}`
              : `${pct(data.totals.filledQuestionnaire, data.totals.signedUp)} of signups · ${data.totals.weeklyCheckins} weekly check-ins`
          }
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
                ["no-login", "Signed up only"],
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
                <th className="px-4 py-2.5">Last seen</th>
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
                rows.map((row: OpsPatientRow) => {
                  const day = dayYmd ? activityOnDay(row, dayYmd) : null;
                  const lastSeenAt = inferLastSeenAt(row);
                  return (
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
                        {day?.any ? (
                          <p className="mt-1 text-[11px] font-semibold text-[#5B66A1]">
                            {[
                              day.signedUp ? "Signed up" : null,
                              day.loggedIn ? "Logged in" : null,
                              day.scanned ? "Scanned" : null,
                              day.questionnaire ? "Questionnaire" : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-[#1E1B31]">
                        {formatWhen(row.signedUpAt)}
                      </td>
                      <td className="px-4 py-3 text-[#1E1B31]">
                        <p>{formatAgo(lastSeenAt)}</p>
                        {lastSeenAt ? (
                          <p className="text-xs text-[#6B7280]">
                            {formatWhen(lastSeenAt)}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill
                          ok={day ? day.scanned : row.hasScan}
                          yes={
                            row.scanCount === 1
                              ? "1 scan"
                              : `${row.scanCount} scans`
                          }
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
                          ok={day ? day.questionnaire : row.questionnaireDone}
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
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <p className="border-t border-[#E4E6F0] px-4 py-2.5 text-xs text-[#6B7280]">
          Showing {rows.length} of {scoped.length} patients
          {dayYmd ? ` with activity on ${dayLabel}` : ""}
        </p>
      </section>
    </div>
  );
}
