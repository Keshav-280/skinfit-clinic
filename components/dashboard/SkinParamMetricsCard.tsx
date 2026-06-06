"use client";

import Link from "next/link";

import { CircularGauge } from "@/components/dashboard/CircularGauge";
import { DASHBOARD_SECTION_CARD } from "@/components/dashboard/DashboardSectionHeader";
import { PATIENT_GREEN } from "@/src/lib/patientDashboardTheme";

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
    <div className={`${DASHBOARD_SECTION_CARD} self-start ${className}`}>
      <h3 className="mb-4 text-[14px] font-extrabold tracking-wide text-[#18181b]">
        SKIN PARAMETER METRICS
      </h3>
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {metrics.slice(0, 4).map((p) => (
          <div
            key={p.label}
            className="flex aspect-[4/5] max-h-[148px] flex-col items-center justify-center gap-1.5 rounded-[16px] border border-[#E5E7EB] bg-[#F2F9F2] px-2 py-3"
          >
            <CircularGauge value={p.value} color={p.color} size={52} strokeWidth={5} />
            <p className="text-center text-[12px] font-bold leading-tight text-[#18181b] sm:text-[13px]">
              {p.label}
            </p>
            <p
              className={`text-[11px] font-bold ${
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
        className="mt-4 block w-full rounded-[14px] bg-[#2D3E6B] py-3.5 text-center text-[15px] font-bold text-white shadow-md transition hover:bg-[#243456]"
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
