"use client";

import { useCallback, useState } from "react";
import { FaceScanFlow } from "@/components/dashboard/FaceScanFlow";
import { DiagnoseActivityRings } from "@/components/dashboard/DiagnoseActivityRings";

export default function ScanPage() {
  const [flowExpanded, setFlowExpanded] = useState(false);

  const onLayoutExpanded = useCallback((expanded: boolean) => {
    setFlowExpanded(expanded);
  }, []);

  return (
    <div
      className={
        flowExpanded
          ? "relative left-1/2 flex min-h-[calc(100dvh-5.5rem)] w-screen max-w-[100vw] -translate-x-1/2 flex-col overflow-hidden p-3 sm:p-4"
          : "mx-auto flex min-h-[calc(100dvh-8.5rem)] w-full max-w-5xl flex-col gap-3 px-3 pb-3 pt-2 sm:px-4"
      }
    >
      <div
        className={
          flowExpanded
            ? "flex min-h-0 flex-1 flex-col"
            : "flex flex-col gap-3 md:grid md:grid-cols-2 md:items-stretch"
        }
      >
        {!flowExpanded ? <DiagnoseActivityRings /> : null}
        <FaceScanFlow
          variant="dashboard"
          onLayoutExpanded={onLayoutExpanded}
        />
      </div>
    </div>
  );
}
