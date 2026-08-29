"use client";

import { useCallback, useState } from "react";
import { FaceScanFlow } from "@/components/dashboard/FaceScanFlow";
import { DiagnoseActivityRings } from "@/components/dashboard/DiagnoseActivityRings";
import { DiagnosePageAtmosphere } from "@/components/dashboard/DiagnosePageAtmosphere";

/**
 * Diagnose tab — full lavender atmosphere from the product mock.
 */
export default function ScanPage() {
  const [flowExpanded, setFlowExpanded] = useState(false);

  const onLayoutExpanded = useCallback((expanded: boolean) => {
    setFlowExpanded(expanded);
  }, []);

  if (flowExpanded) {
    return (
      <div className="relative left-1/2 flex min-h-[calc(100dvh-5.5rem)] w-screen max-w-[100vw] -translate-x-1/2 flex-col overflow-hidden bg-[#F5F3EF] p-3 sm:p-4">
        <FaceScanFlow
          variant="dashboard"
          onLayoutExpanded={onLayoutExpanded}
        />
      </div>
    );
  }

  return (
    <div className="relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2 -mt-6 min-h-[calc(100dvh-4rem)] md:-mt-6">
      <DiagnosePageAtmosphere />

      <div className="relative z-10 mx-auto flex min-h-[calc(100dvh-8.5rem)] w-full max-w-lg flex-col gap-5 px-4 pb-8 pt-3 sm:max-w-xl md:max-w-2xl md:px-6">
        <DiagnoseActivityRings />
        <FaceScanFlow
          variant="dashboard"
          onLayoutExpanded={onLayoutExpanded}
        />
      </div>
    </div>
  );
}
