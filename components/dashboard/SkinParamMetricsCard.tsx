"use client";

import Link from "next/link";

import { CircularGauge } from "@/components/dashboard/CircularGauge";
import { PATIENT_GREEN } from "@/src/lib/patientDashboardTheme";

const SKIN_PARAM_INNER_CELL =
  "flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-[14px] border border-[#E8EBE8] bg-[#F5F7F5] px-2 py-2.5";

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
      className={`w-full self-start rounded-[20px] border border-[#E5E7EB] bg-white p-4 md:p-5 ${className}`}
    >
      <h3 className="mb-4 text-[14px] font-extrabold tracking-wide text-[#18181b]">
        SKIN PARAMETER METRICS
      </h3>
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {metrics.slice(0, 4).map((p) => (
          <div
            key={p.label}
            className={SKIN_PARAM_INNER_CELL}
          >
            <CircularGauge
              value={p.value}
              color={p.color}
              size={52}
              strokeWidth={4.5}
              valueClassName="text-sm sm:text-base text-[#18181b]"
            />
            <p className="text-center text-[12px] font-extrabold leading-tight text-[#18181b] sm:text-[13px]">
              {p.label}
            </p>
            <p
              className={`text-[10.5px] font-extrabold sm:text-[11.5px] ${
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
        className="mt-3.5 block w-full rounded-[12px] bg-[#2D3E6B] py-3 text-center text-sm font-bold text-white transition hover:bg-[#243456]"
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
