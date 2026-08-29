"use client";

import { useState } from "react";
import type { KaiReportParamRow } from "@/src/lib/kaiReportMapping";
import { REPORT_CARD, REPORT_PILL, severityFill } from "./reportCopy";
import { MiniGradeRing } from "./ReportGradeRing";

type ParameterTilesProps = {
  parameters: KaiReportParamRow[];
  activeKey?: string | null;
  onSelect?: (key: string | null) => void;
};

export function ParameterTiles({
  parameters,
  activeKey,
  onSelect,
}: ParameterTilesProps) {
  const [internal, setInternal] = useState<string | null>(null);
  const openKey = activeKey !== undefined ? activeKey : internal;
  const watch = new Set(
    [...parameters]
      .sort((a, b) => b.severity - a.severity)
      .slice(0, 2)
      .map((p) => p.key)
  );

  function toggle(key: string) {
    const next = openKey === key ? null : key;
    onSelect?.(next);
    if (activeKey === undefined) setInternal(next);
  }

  return (
    <section className={`${REPORT_CARD} px-3.5 py-4`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className={REPORT_PILL}>Snapshot</span>
        <span className="text-[11px] font-medium text-[#8B93A4]">
          Tap to light the map
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {parameters.map((p) => {
          const on = openKey === p.key;
          const watching = watch.has(p.key);
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => toggle(p.key)}
              className={`rounded-2xl bg-white/75 p-3 text-left transition ${
                watching ? "ring-1 ring-[#2C3E6B]/18" : ""
              } ${on ? "ring-2 ring-[#2C3E6B]/35 bg-white" : ""}`}
            >
              <div className="flex items-center gap-2.5">
                <MiniGradeRing
                  grade={p.grade}
                  fill={severityFill(p.severity)}
                />
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold leading-tight text-[#1A2035]">
                    {p.shortName}
                  </span>
                  {watching ? (
                    <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-[#E4DFF5] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-[#2C3E6B]">
                      <span className="report-live-dot-on h-1 w-1 rounded-full bg-[#2C3E6B]" />
                      Watch
                    </span>
                  ) : (
                    <span className="mt-0.5 block text-[10px] font-medium text-[#8B93A4]">
                      {on ? "On map" : "Show on map"}
                    </span>
                  )}
                </span>
              </div>
              {on ? (
                <p className="mt-2.5 text-[11.5px] leading-[1.45] text-[#5B6478]">
                  {p.finding}
                </p>
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}
