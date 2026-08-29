"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { DiagnosePageAtmosphere } from "@/components/dashboard/DiagnosePageAtmosphere";
import { actionLead, firstSentences, gradeRingColor } from "@/components/report/reportCopy";
import type { ConcernChipId } from "@/components/dashboard/ConcernChips";
import type { KaiReportParamRow } from "@/src/lib/kaiReportMapping";
import { ConceptFace } from "./ConceptFace";
import type { ConceptReportData } from "./conceptTypes";

function OrbitNode({
  param,
  x,
  y,
  active,
  onSelect,
}: {
  param: KaiReportParamRow;
  x: number;
  y: number;
  active: boolean;
  onSelect: () => void;
}) {
  const color = gradeRingColor(param.grade);
  return (
    <button
      type="button"
      onClick={onSelect}
      className="absolute flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full bg-white/90 shadow-[0_10px_24px_-10px_rgba(30, 27, 49,0.45)] transition"
      style={{
        left: x,
        top: y,
        outline: active ? `2px solid ${color}` : "2px solid transparent",
        boxShadow: active ? `0 0 0 4px ${color}22` : undefined,
      }}
    >
      <span
        className="text-[15px] leading-none tracking-[-0.04em] text-[#1A2035]"
        style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
      >
        {param.grade}
      </span>
      <span className="mt-0.5 max-w-[52px] truncate text-[8px] font-bold uppercase tracking-[0.08em] text-[#5B6478]">
        {param.shortName}
      </span>
    </button>
  );
}

export function OrbitReport({ data }: { data: ConceptReportData }) {
  const orbitParams = useMemo(
    () => data.parameters.filter((p) => p.concernChipId),
    [data.parameters]
  );
  const [activeKey, setActiveKey] = useState(orbitParams[0]?.key ?? null);
  const active = orbitParams.find((p) => p.key === activeKey) ?? orbitParams[0];
  const concern: ConcernChipId = active?.concernChipId ?? "all";

  const nodes = useMemo(() => {
    const size = 340;
    const cx = size / 2;
    const cy = size / 2;
    const r = 148;
    const n = orbitParams.length || 1;
    return orbitParams.map((p, i) => {
      const a = ((-90 + (i * 360) / n) * Math.PI) / 180;
      return {
        param: p,
        x: cx + Math.cos(a) * r,
        y: cy + Math.sin(a) * r,
      };
    });
  }, [orbitParams]);

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <DiagnosePageAtmosphere className="fixed inset-0" />
      <div className="relative z-10 mx-auto max-w-[440px] px-4 pb-12 pt-6">
        <p className="text-center text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#1E1B31]/55">
          Baseline · {data.dateLabel}
        </p>
        <div className="mt-1 flex items-end justify-center gap-2">
          <span
            className="text-[42px] font-light leading-none tracking-[-0.06em] text-[#1A2035]"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            {data.grade}
          </span>
          <p className="mb-1 max-w-[12rem] text-[14px] font-semibold leading-tight tracking-[-0.02em] text-[#1A2035]">
            {data.title}
          </p>
        </div>

        <div className="relative mx-auto mt-4 h-[340px] w-[340px]">
          <div className="pointer-events-none absolute inset-[18px] rounded-full border border-[#1E1B31]/12" />
          <div className="absolute left-1/2 top-1/2 h-[188px] w-[188px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full shadow-[0_20px_50px_-18px_rgba(30, 27, 49,0.45)] ring-4 ring-white/80">
            <ConceptFace
              url={data.faceUrl}
              regions={data.detectionRegions}
              proxyRegions={data.proxyRegions}
              wrinkleLines={data.wrinkleLines}
              activeConcern={concern}
              circular
              className="h-full w-full"
            />
          </div>
          {nodes.map(({ param, x, y }) => (
            <OrbitNode
              key={param.key}
              param={param}
              x={x}
              y={y}
              active={param.key === activeKey}
              onSelect={() => setActiveKey(param.key)}
            />
          ))}
        </div>

        {active ? (
          <div className="mx-auto mt-2 max-w-[22rem] rounded-[22px] bg-white/80 px-4 py-3.5 text-center shadow-[0_16px_40px_-22px_rgba(30, 27, 49,0.4)] backdrop-blur-md">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#1E1B31]/55">
              {active.shortName} · {active.grade}
            </p>
            <p className="mt-1.5 text-[14px] leading-[1.4] text-[#1A2035]">
              {active.finding}
            </p>
          </div>
        ) : null}

        <p
          className="mx-auto mt-5 max-w-[22rem] text-center text-[15px] leading-[1.4] text-[#1A2035]"
          style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
        >
          {firstSentences(data.takeaway, 2)}
        </p>

        <div className="mt-6 flex flex-col gap-2">
          {data.actions.map((text, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-full bg-white/80 px-3.5 py-3 shadow-[0_10px_28px_-18px_rgba(30, 27, 49,0.4)]"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1E1B31] text-[12px] font-bold text-white">
                {i + 1}
              </span>
              <span className="text-[13.5px] font-semibold text-[#1A2035]">
                {actionLead(text)}
              </span>
            </div>
          ))}
        </div>

        <Link
          href="/dashboard?book=1"
          className="mt-6 block rounded-full bg-[#1E1B31] py-3.5 text-center text-[14px] font-semibold text-white shadow-[0_16px_32px_-12px_rgba(30, 27, 49,0.55)]"
        >
          Book a Medixora scan
        </Link>
        <Link
          href="/dashboard/chat?assistant=doctor"
          className="mt-2 block py-2 text-center text-[13px] font-semibold text-[#1E1B31]/70"
        >
          Message {data.doctorName}
        </Link>
      </div>
    </div>
  );
}
