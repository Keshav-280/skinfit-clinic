"use client";

import Link from "next/link";
import type { MovementGroups, MovementRow } from "@/src/lib/report/buildMovementGroups";
import type { KaiGradeTone } from "@/src/lib/kaiReportMapping";
import { resolveConcernSlug } from "@/src/lib/skinConcernSlug";
import { REPORT_CARD, REPORT_PILL } from "./reportCopy";

type MovementSectionProps = {
  groups: MovementGroups;
};

const DOT: Record<KaiGradeTone, string> = {
  good: "bg-kai-good",
  mid: "bg-kai-mid",
  low: "bg-kai-low",
};

function Chip({ row }: { row: MovementRow }) {
  const slug = resolveConcernSlug(row.key);
  return (
    <div className="w-full rounded-2xl bg-white/70 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        {slug ? (
          <Link
            href={`/dashboard/score/${slug}`}
            className="flex min-w-0 items-center gap-1.5 text-[13px] font-semibold text-[#1A2035] underline decoration-[#1A2035]/20 decoration-1 underline-offset-2 transition hover:decoration-[#1A2035]/50"
          >
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT[row.gradeColor]}`} />
            <span className="truncate">{row.name}</span>
          </Link>
        ) : (
          <span className="flex min-w-0 items-center gap-1.5 text-[13px] font-semibold text-[#1A2035]">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT[row.gradeColor]}`} />
            <span className="truncate">{row.name}</span>
          </span>
        )}
        <span className="flex shrink-0 items-center gap-1.5">
          <span className="text-[9.5px] font-bold uppercase tracking-[0.06em] text-[#8B93A4]">
            {row.movement.tag}
          </span>
          <span
            className="font-serif text-[16px] text-[#1A2035]"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            {row.grade}
          </span>
        </span>
      </div>
      {row.note ? (
        <p className="mt-2 text-[12px] leading-[1.45] text-[#5B6478]">{row.note}</p>
      ) : null}
    </div>
  );
}

export function MovementSection({ groups }: MovementSectionProps) {
  const counts = [
    { label: "Improved", n: groups.improved.length, tone: "text-[#2F6B4A] bg-[#4E9B72]/12" },
    { label: "Declined", n: groups.declined.length, tone: "text-[#8B3A3A] bg-[#8B3A3A]/12" },
    { label: "Holding", n: groups.holding.length, tone: "text-[#1E1B31] bg-[#F8EDEE]" },
    { label: "Tracking", n: groups.tracking.length, tone: "text-[#A87C22] bg-[#D4A03F]/15" },
  ];

  const blocks: Array<{ label: string; rows: MovementRow[] }> = [
    { label: "Declined", rows: groups.declined },
    { label: "Improved", rows: groups.improved },
    { label: "Holding", rows: groups.holding },
    { label: "Tracking", rows: groups.tracking },
  ];

  return (
    <section className={`${REPORT_CARD} px-3.5 py-4`}>
      <div className="mb-3 flex items-center justify-between">
        <span className={REPORT_PILL}>What moved</span>
        <span className="text-[11px] font-medium text-[#8B93A4]">Tap a name to view it</span>
      </div>
      <div className="mb-3 grid grid-cols-4 gap-2">
        {counts.map((c) => (
          <div
            key={c.label}
            className={`rounded-2xl px-1.5 py-2.5 text-center ${c.tone}`}
          >
            <p className="text-[18px] font-semibold leading-none tracking-tight">{c.n}</p>
            <p className="mt-1 text-[8.5px] font-bold uppercase tracking-[0.08em] opacity-80">
              {c.label}
            </p>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-3">
        {blocks.map((block) =>
          block.rows.length === 0 ? null : (
            <div key={block.label}>
              <p className="mb-1.5 px-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#8B93A4]">
                {block.label}
              </p>
              <div className="flex flex-col gap-1.5">
                {block.rows.map((r) => (
                  <Chip key={r.key} row={r} />
                ))}
              </div>
            </div>
          )
        )}
      </div>
    </section>
  );
}
