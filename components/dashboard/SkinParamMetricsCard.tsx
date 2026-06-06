"use client";

import Link from "next/link";

import { CircularGauge } from "@/components/dashboard/CircularGauge";
import { PATIENT_GREEN } from "@/src/lib/patientDashboardTheme";

const SKIN_PARAM_INNER_CELL =
  "flex w-full flex-col items-center justify-center gap-0.5 rounded-[12px] border border-[#E8EBE8] bg-[#F5F7F5] px-1.5 py-2";

export type SkinParamMetric = {
  label: string;
  value: number;
  color: string;
  sublabel: string;
};

type Props = {
  metrics: SkinParamMetric[];
  viewAllHref: string;
  className?: string;
};

export function SkinParamMetricsCard({ metrics, viewAllHref, className = "" }: Props) {
  return (
    <div
      className={`self-start rounded-[20px] border border-[#E5E7EB] bg-white p-3.5 md:p-4 ${className}`}
    >
      <h3 className="mb-2 text-[12px] font-extrabold tracking-wide text-[#18181b]">
        SKIN PARAMETER METRICS
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {metrics.slice(0, 4).map((p) => (
          <div
            key={p.label}
            className={SKIN_PARAM_INNER_CELL}
          >
            <CircularGauge
              value={p.value}
              color={p.color}
              size={44}
              strokeWidth={4}
              valueClassName="text-sm text-[#18181b]"
            />
            <p className="text-center text-[11px] font-extrabold leading-tight text-[#18181b]">
              {p.label}
            </p>
            <p
              className={`text-[10px] font-extrabold leading-none ${
                p.sublabel === "Needs Care"
                  ? "text-red-500"
                  : p.sublabel === "Moderate"
                    ? "text-amber-500"
                    : "text-[#4CAF50]"
              }`}
            >
              {p.sublabel}
            </p>
          </div>
        ))}
      </div>
      <Link
        href={viewAllHref}
        className="mt-2.5 block w-full rounded-[12px] bg-[#2D3E6B] py-2.5 text-center text-[13px] font-bold text-white transition hover:bg-[#243456]"
      >
        View all Parameters
      </Link>
    </div>
  );
}

export function classifySkinParamMetric(v: number) {
  if (v >= 75) return { color: PATIENT_GREEN, sublabel: "Mild" };
  if (v >= 50) return { color: "#F59E0B", sublabel: "Moderate" };
  return { color: "#DC2626", sublabel: "Needs Care" };
}
