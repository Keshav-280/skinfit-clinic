"use client";

import type { ReactNode, Ref } from "react";
import { DiagnosePageAtmosphere } from "@/components/dashboard/DiagnosePageAtmosphere";

type ReportShellProps = {
  children: ReactNode;
  reportRef?: Ref<HTMLDivElement>;
};

export function ReportShell({ children, reportRef }: ReportShellProps) {
  return (
    <div ref={reportRef} className="relative min-h-[100dvh] overflow-x-hidden">
      <DiagnosePageAtmosphere className="fixed inset-0" />
      <div className="relative z-10 mx-auto w-full max-w-[430px] px-4 pb-10 pt-3 sm:max-w-[460px]">
        {children}
      </div>
    </div>
  );
}
