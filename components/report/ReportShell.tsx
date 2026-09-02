"use client";

import type { ReactNode, Ref } from "react";

type ReportShellProps = {
  children: ReactNode;
  reportRef?: Ref<HTMLDivElement>;
};

export function ReportShell({ children, reportRef }: ReportShellProps) {
  return (
    <div
      ref={reportRef}
      className="relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2 -mt-6 min-h-[calc(100dvh-4rem)] bg-[#1E1B31]"
    >
      {children}
    </div>
  );
}
