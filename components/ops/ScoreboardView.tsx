"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Scoreboard, WeekStats } from "@/src/lib/scoreboard/loadScoreboard";

function delta(cur: number, prev: number): string {
  const d = cur - prev;
  if (prev === 0 && cur === 0) return "no change";
  if (d === 0) return "same as last week";
  const sign = d > 0 ? "+" : "";
  return `${sign}${d} vs last week`;
}

function pct(part: number, whole: number): string {
  if (whole <= 0) return "0%";
  return `${Math.round((part / whole) * 100)}%`;
}

function buildWhatsAppText(data: Scoreboard): string {
  const c = data.current;
  const p = data.previous;
  const sign = (a: number, b: number) => {
    const d = a - b;
    return d > 0 ? `+${d}` : `${d}`;
  };
  const lines = [
    `SkinFit app scoreboard, ${data.rangeLabel}`,
    ``,
    `New signups: ${c.signups} (${sign(c.signups, p.signups)})`,
    `Finished a first scan: ${c.activated} of ${c.signups} (${pct(c.activated, c.signups)})`,
    `Scans done: ${c.scans} (${sign(c.scans, p.scans)})`,
    `People who came back to scan: ${c.returningScanners}`,
    `Weekly check-ins: ${c.checkins} (${sign(c.checkins, p.checkins)})`,
    `Appointment requests: ${c.requests} (${c.confirmed} confirmed)`,
  ];
  if (data.bySource.length > 0) {
    lines.push(``, `Signups by source:`);
    for (const s of data.bySource.slice(0, 6)) {
      lines.push(`${s.source}: ${s.signups}`);
    }
  }
  return lines.join("\n");
}

function Tile({
  label,
  value,
  note,
}: {
  label: string;
  value: number;
  note: string;
}) {
  return (
    <div className="rounded-2xl bg-white px-4 py-3.5 shadow-[0_1px_0_rgba(30,27,49,0.06)] ring-1 ring-[#E8E1D6]">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#5B66A1]">
        {label}
      </p>
      <p className="mt-1 font-serif text-[34px] font-semibold leading-none text-[#1E1B31]">
        {value}
      </p>
      <p className="mt-1.5 text-xs text-[#6B6A7C]">{note}</p>
    </div>
  );
}

export function ScoreboardView({ data }: { data: Scoreboard }) {
  const [copied, setCopied] = useState<"text" | "link" | null>(null);
  const [sourceName, setSourceName] = useState("");
  const c: WeekStats = data.current;
  const p: WeekStats = data.previous;
  const maxSource = Math.max(1, ...data.bySource.map((s) => s.signups));

  const link = useMemo(() => {
    const clean = sourceName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);
    const origin =
      typeof window !== "undefined" ? window.location.origin : "https://my.skinfitwellness.in";
    return clean ? `${origin}/?src=${clean}` : "";
  }, [sourceName]);

  async function copy(text: string, kind: "text" | "link") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      /* clipboard unavailable */
    }
  }

  const weeks = [
    { offset: 0, label: "This week" },
    { offset: -1, label: "Last week" },
    { offset: -2, label: "2 weeks ago" },
  ];

  return (
    <div className="mx-auto flex max-w-[460px] flex-col gap-5 px-3 pb-10 pt-4">
      <div className="flex flex-wrap items-center gap-2">
        {weeks.map((w) => (
          <Link
            key={w.offset}
            href={w.offset === 0 ? "/clinic/scoreboard" : `/clinic/scoreboard?week=${w.offset}`}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
              data.weekOffset === w.offset
                ? "bg-[#1E1B31] text-white"
                : "bg-white text-[#1E1B31] ring-1 ring-[#E8E1D6] hover:bg-[#F0EAE2]"
            }`}
          >
            {w.label}
          </Link>
        ))}
      </div>

      {/* The card to screenshot */}
      <div id="scoreboard-card" className="overflow-hidden rounded-3xl bg-[#FAF8F5] ring-1 ring-[#E8E1D6]">
        <div className="bg-[#1E1B31] px-5 pb-5 pt-5 text-white">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#DF9DA4]">
            SkinFit app
          </p>
          <h1 className="mt-1 font-serif text-2xl font-semibold leading-tight">Weekly scoreboard</h1>
          <p className="mt-1 text-sm text-[#AEB9E8]">{data.rangeLabel}</p>
        </div>

        <div className="space-y-3 p-4">
          <div className="grid grid-cols-2 gap-3">
            <Tile label="New signups" value={c.signups} note={delta(c.signups, p.signups)} />
            <Tile label="Scans done" value={c.scans} note={delta(c.scans, p.scans)} />
            <Tile label="Weekly check-ins" value={c.checkins} note={delta(c.checkins, p.checkins)} />
            <Tile
              label="Appointment requests"
              value={c.requests}
              note={`${c.confirmed} confirmed`}
            />
          </div>

          <div className="rounded-2xl bg-[#1E1B31] px-4 py-3.5 text-white">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-semibold">Finished a first scan</p>
              <p className="font-serif text-2xl font-semibold text-[#DF9DA4]">
                {pct(c.activated, c.signups)}
              </p>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-[#DF9DA4]"
                style={{ width: pct(c.activated, c.signups) }}
              />
            </div>
            <p className="mt-2 text-xs text-[#AEB9E8]">
              {c.activated} of {c.signups} new signups. {c.returningScanners} people came back for another scan.
            </p>
          </div>

          <div className="rounded-2xl bg-white px-4 py-3.5 ring-1 ring-[#E8E1D6]">
            <p className="text-sm font-semibold text-[#1E1B31]">Where signups came from</p>
            {data.bySource.length === 0 ? (
              <p className="mt-2 text-sm text-[#6B6A7C]">No signups this week yet.</p>
            ) : (
              <ul className="mt-2.5 space-y-2.5">
                {data.bySource.slice(0, 6).map((s) => (
                  <li key={s.source}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-[#1E1B31]">{s.source}</span>
                      <span className="text-[#5B66A1]">
                        {s.signups} signup{s.signups === 1 ? "" : "s"}, {s.activated} scanned
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#F0EAE2]">
                      <div
                        className="h-full rounded-full bg-[#5B66A1]"
                        style={{ width: `${Math.round((s.signups / maxSource) * 100)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="px-1 text-center text-[11px] text-[#9A98A8]">my.skinfitwellness.in</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => copy(buildWhatsAppText(data), "text")}
          className="rounded-full bg-[#1E1B31] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#242A5F]"
        >
          {copied === "text" ? "Copied" : "Copy as WhatsApp text"}
        </button>
        <p className="self-center text-xs text-[#6B6A7C]">
          Or take a screenshot of the card above.
        </p>
      </div>

      <div className="rounded-2xl bg-white p-4 ring-1 ring-[#E8E1D6]">
        <p className="text-sm font-semibold text-[#1E1B31]">Make a tracking link</p>
        <p className="mt-1 text-xs text-[#6B6A7C]">
          Type a name for who or where the link is for, such as reception, priya or instagram.
          Everyone who signs up through it is counted under that name.
        </p>
        <input
          value={sourceName}
          onChange={(e) => setSourceName(e.target.value)}
          placeholder="reception"
          className="mt-3 w-full rounded-xl border border-[#E5E7EB] bg-[#FAF8F5] px-3.5 py-2.5 text-base"
        />
        {link ? (
          <div className="mt-3 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg bg-[#F0EAE2] px-3 py-2 text-xs text-[#1E1B31]">
              {link}
            </code>
            <button
              type="button"
              onClick={() => copy(link, "link")}
              className="shrink-0 rounded-full border border-[#1E1B31]/20 px-3.5 py-2 text-sm font-semibold text-[#1E1B31]"
            >
              {copied === "link" ? "Copied" : "Copy"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
