"use client";

import { FaceScanFlow } from "@/components/dashboard/FaceScanFlow";

export default function ScanPage() {
  return (
    <div className="relative left-1/2 flex min-h-[calc(100dvh-5.5rem)] w-screen max-w-[100vw] -translate-x-1/2 flex-col overflow-hidden p-3 sm:p-4">
      <div className="flex min-h-0 flex-1 flex-col">
        <FaceScanFlow variant="dashboard" />
      </div>
    </div>
  );
}
