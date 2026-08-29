"use client";

import { useState } from "react";
import Link from "next/link";
import { actionLead, firstSentences } from "@/components/report/reportCopy";
import type { ConcernChipId } from "@/components/dashboard/ConcernChips";
import { ConceptFace } from "./ConceptFace";
import type { ConceptReportData } from "./conceptTypes";

export function SwissReport({ data }: { data: ConceptReportData }) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [concern, setConcern] = useState<ConcernChipId>("all");
  const watch = [...data.parameters]
    .sort((a, b) => b.severity - a.severity)
    .slice(0, 2)
    .map((p) => p.key);

  return (
    <div className="min-h-dvh bg-[#F3EEE4] text-[#161410]">
      <div className="mx-auto max-w-[440px] px-5 pb-12 pt-6">
        <header className="flex items-end justify-between border-b border-[#161410] pb-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.22em]">
            kAI baseline
          </p>
          <p className="text-[10px] font-medium uppercase tracking-[0.18em]">
            {data.dateLabel}
          </p>
        </header>

        <div className="relative mt-2 min-h-[210px]">
          <p
            className="leading-none text-[#161410]"
            style={{
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontSize: "168px",
              letterSpacing: "-0.07em",
            }}
          >
            {data.grade}
          </p>
          <div className="absolute right-0 top-8 h-[210px] w-[158px] overflow-hidden border border-[#161410]">
            <ConceptFace
              url={data.faceUrl}
              regions={data.detectionRegions}
              proxyRegions={data.proxyRegions}
              wrinkleLines={data.wrinkleLines}
              activeConcern={concern}
              className="h-full w-full"
            />
          </div>
        </div>

        <h1 className="mt-3 max-w-[16rem] text-[22px] font-medium leading-[1.2] tracking-[-0.03em]">
          {data.title}
        </h1>
        <p className="mt-3 max-w-[20rem] text-[13px] leading-[1.5] text-[#161410]/70">
          {firstSentences(data.takeaway, 2)}
        </p>

        <div className="mt-8 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setConcern("all")}
            className={`border px-2 py-1 text-[10px] font-medium uppercase tracking-[0.14em] ${
              concern === "all"
                ? "border-[#161410] bg-[#161410] text-[#F3EEE4]"
                : "border-[#161410]/30"
            }`}
          >
            All
          </button>
          {data.parameters
            .filter((p) => p.concernChipId)
            .map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setConcern(p.concernChipId as ConcernChipId)}
                className={`border px-2 py-1 text-[10px] font-medium uppercase tracking-[0.14em] ${
                  concern === p.concernChipId
                    ? "border-[#161410] bg-[#161410] text-[#F3EEE4]"
                    : "border-[#161410]/30"
                }`}
              >
                {p.shortName}
              </button>
            ))}
        </div>

        <section className="mt-10">
          <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.2em]">
            Markers
          </p>
          {data.parameters.map((p) => {
            const on = openKey === p.key;
            const hot = watch.includes(p.key);
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => setOpenKey(on ? null : p.key)}
                className="block w-full border-t border-[#161410]/20 py-3 text-left last:border-b"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[14px] font-medium">
                    {p.name}
                    {hot ? (
                      <span className="ml-2 text-[10px] uppercase tracking-[0.14em] text-[#9C2B1A]">
                        Watch
                      </span>
                    ) : null}
                  </span>
                  <span
                    className="text-[20px] leading-none"
                    style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
                  >
                    {p.grade}
                  </span>
                </div>
                <div className="mt-2 h-px w-full bg-[#161410]/10">
                  <div
                    className="h-px bg-[#161410]"
                    style={{
                      width: `${Math.max(8, 100 - ((p.severity - 1) / 4) * 100)}%`,
                    }}
                  />
                </div>
                {on ? (
                  <p className="mt-2 text-[12.5px] leading-[1.45] text-[#161410]/65">
                    {p.finding}
                  </p>
                ) : null}
              </button>
            );
          })}
        </section>

        <section className="mt-10">
          <p className="mb-4 text-[10px] font-medium uppercase tracking-[0.2em]">
            Three moves
          </p>
          <ol>
            {data.actions.map((text, i) => (
              <li
                key={i}
                className="flex gap-4 border-t border-[#161410]/20 py-4 last:border-b"
              >
                <span
                  className="w-8 shrink-0 text-[18px] leading-none"
                  style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
                >
                  0{i + 1}
                </span>
                <span className="text-[14px] leading-[1.4]">{actionLead(text)}</span>
              </li>
            ))}
          </ol>
        </section>

        <Link
          href="/dashboard?book=1"
          className="mt-10 block bg-[#161410] py-4 text-center text-[13px] font-medium uppercase tracking-[0.16em] text-[#F3EEE4]"
        >
          Book a Medixora scan
        </Link>
        <Link
          href="/dashboard/chat?assistant=doctor"
          className="mt-3 block py-2 text-center text-[12px] uppercase tracking-[0.14em] text-[#161410]/55"
        >
          Message {data.doctorName}
        </Link>
      </div>
    </div>
  );
}
