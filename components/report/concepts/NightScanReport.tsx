"use client";

import { useState } from "react";
import Link from "next/link";
import { actionLead, firstSentences, severityFill } from "@/components/report/reportCopy";
import type { ConcernChipId } from "@/components/dashboard/ConcernChips";
import { ConceptFace } from "./ConceptFace";
import type { ConceptReportData } from "./conceptTypes";

function Bracket({ className }: { className: string }) {
  return (
    <span
      className={`pointer-events-none absolute h-5 w-5 border-[#7EE0F2] ${className}`}
      aria-hidden
    />
  );
}

export function NightScanReport({ data }: { data: ConceptReportData }) {
  const [openKey, setOpenKey] = useState<string | null>(
    data.parameters[0]?.key ?? null
  );
  const [concern, setConcern] = useState<ConcernChipId>("all");
  const watch = data.parameters
    .slice()
    .sort((a, b) => b.severity - a.severity)[0];

  return (
    <div className="min-h-dvh bg-[#070A12] text-[#E8EEF8]">
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(#7EE0F2 1px, transparent 1px), linear-gradient(90deg, #7EE0F2 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
        aria-hidden
      />

      <div className="relative mx-auto max-w-[440px] px-4 pb-12 pt-5">
        <header className="mb-4 flex items-center justify-between font-mono text-[10px] tracking-[0.18em] text-[#7EE0F2]/80">
          <span>kAI // SCAN</span>
          <span className="flex items-center gap-2">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[#7EE0F2]" />
            {data.dateLabel.toUpperCase()}
          </span>
        </header>

        <div className="relative">
          <div className="relative aspect-[3/4] overflow-hidden rounded-sm bg-[#101522]">
            <ConceptFace
              url={data.faceUrl}
              regions={data.detectionRegions}
              proxyRegions={data.proxyRegions}
              wrinkleLines={data.wrinkleLines}
              activeConcern={concern}
              className="h-full w-full"
            />
            <Bracket className="left-2 top-2 border-l-2 border-t-2" />
            <Bracket className="right-2 top-2 border-r-2 border-t-2" />
            <Bracket className="bottom-2 left-2 border-b-2 border-l-2" />
            <Bracket className="bottom-2 right-2 border-b-2 border-r-2" />

            <div className="pointer-events-none absolute left-3 top-3 font-mono text-[10px] tracking-[0.16em] text-[#7EE0F2]">
              LOCK · FRONT
            </div>
            <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
              <div>
                <p className="font-mono text-[10px] tracking-[0.2em] text-[#7EE0F2]/70">
                  OVERALL
                </p>
                <p
                  className="text-[72px] font-light leading-[0.8] text-white"
                  style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
                >
                  {data.grade}
                </p>
              </div>
              <div className="mb-1 rounded-sm border border-[#7EE0F2]/40 bg-[#070A12]/70 px-2 py-1 font-mono text-[10px] tracking-[0.14em] text-[#E8C37A]">
                PRI · {watch?.shortName.toUpperCase() ?? "-"} {watch?.grade}
              </div>
            </div>
          </div>
        </div>

        <p className="mt-4 text-[15px] font-medium leading-snug tracking-[-0.02em] text-white">
          {data.title}
        </p>
        <p className="mt-2 font-mono text-[11px] leading-[1.5] text-[#9AA8C2]">
          {firstSentences(data.takeaway, 1)}
        </p>

        <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {(["all", ...data.parameters.filter((p) => p.concernChipId).map((p) => p.concernChipId!)] as ConcernChipId[]).map(
            (id) => {
              const label =
                id === "all"
                  ? "ALL"
                  : data.parameters.find((p) => p.concernChipId === id)?.shortName ??
                    id;
              const on = concern === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setConcern(id)}
                  className={`shrink-0 border px-2.5 py-1 font-mono text-[10px] tracking-[0.12em] ${
                    on
                      ? "border-[#7EE0F2] bg-[#7EE0F2] text-[#070A12]"
                      : "border-[#7EE0F2]/25 text-[#7EE0F2]/80"
                  }`}
                >
                  {label.toUpperCase()}
                </button>
              );
            }
          )}
        </div>

        <section className="mt-6 border border-[#7EE0F2]/20 bg-[#0C111C]/80">
          <div className="border-b border-[#7EE0F2]/20 px-3 py-2 font-mono text-[10px] tracking-[0.18em] text-[#7EE0F2]/70">
            CHANNEL READOUT
          </div>
          {data.parameters.map((p) => {
            const on = openKey === p.key;
            const fill = severityFill(p.severity);
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => setOpenKey(on ? null : p.key)}
                className="block w-full border-b border-[#7EE0F2]/10 px-3 py-2.5 text-left last:border-b-0"
              >
                <div className="flex items-center gap-3">
                  <span className="w-[5.5rem] font-mono text-[11px] tracking-[0.08em] text-[#9AA8C2]">
                    {p.shortName.toUpperCase()}
                  </span>
                  <span className="h-[3px] flex-1 bg-[#1A2336]">
                    <span
                      className="block h-full bg-[#7EE0F2]"
                      style={{ width: `${fill}%` }}
                    />
                  </span>
                  <span className="w-8 text-right font-mono text-[13px] text-white">
                    {p.grade}
                  </span>
                </div>
                {on ? (
                  <p className="mt-2 text-[12px] leading-[1.45] text-[#9AA8C2]">
                    {p.finding}
                  </p>
                ) : null}
              </button>
            );
          })}
        </section>

        <section className="mt-6">
          <p className="mb-3 font-mono text-[10px] tracking-[0.18em] text-[#7EE0F2]/70">
            PROTOCOL
          </p>
          {data.actions.map((text, i) => (
            <div
              key={i}
              className="mb-2 flex gap-3 border-l-2 border-[#E8C37A] bg-[#0C111C] px-3 py-3"
            >
              <span className="font-mono text-[11px] text-[#E8C37A]">0{i + 1}</span>
              <p className="text-[13px] leading-snug text-[#E8EEF8]">
                {actionLead(text)}
              </p>
            </div>
          ))}
        </section>

        <Link
          href="/dashboard?book=1"
          className="mt-6 block border border-[#7EE0F2] py-3.5 text-center font-mono text-[12px] tracking-[0.16em] text-[#7EE0F2]"
        >
          OPEN CLINIC CHANNEL
        </Link>
        <Link
          href="/dashboard/chat?assistant=doctor"
          className="mt-2 block py-2 text-center font-mono text-[11px] tracking-[0.12em] text-[#9AA8C2]"
        >
          MSG {data.doctorName.toUpperCase()}
        </Link>
      </div>
    </div>
  );
}
