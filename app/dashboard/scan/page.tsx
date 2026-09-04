"use client";

import { useCallback, useState } from "react";
import { FaceScanFlow } from "@/components/dashboard/FaceScanFlow";
import { DiagnoseActivityRings } from "@/components/dashboard/DiagnoseActivityRings";
import { DiagnosePageAtmosphere } from "@/components/dashboard/DiagnosePageAtmosphere";

/**
 * Diagnose tab - canvas / linen atmosphere from the brand palette.
 *
 * FaceScanFlow must stay mounted when the layout expands (photo guide, camera).
 * Switching between two different trees used to remount it and reset
 * `photoGuideOpen` / camera state, so "View photo tips" appeared to do nothing.
 */
export default function ScanPage() {
  const [flowExpanded, setFlowExpanded] = useState(false);
  const [edgeToEdge, setEdgeToEdge] = useState(false);

  const onLayoutExpanded = useCallback(
    (expanded: boolean, options?: { edgeToEdge?: boolean }) => {
      setFlowExpanded(expanded);
      setEdgeToEdge(Boolean(options?.edgeToEdge));
    },
    [],
  );

  return (
    <div
      className={
        flowExpanded
          ? `relative left-1/2 flex min-h-[calc(100dvh-5.5rem)] w-screen min-w-0 max-w-[100vw] -translate-x-1/2 -mt-6 flex-col overflow-x-hidden overflow-y-auto bg-[#FAF8F5] ${
              edgeToEdge
                ? "px-0 pb-0"
                : "px-3 pb-3 sm:px-4 sm:pb-4"
            }`
          : "relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2 -mt-6 min-h-[calc(100dvh-4rem)] md:-mt-6"
      }
    >
      {!flowExpanded ? <DiagnosePageAtmosphere /> : null}

      <div
        className={
          flowExpanded
            ? "relative z-10 flex min-h-0 w-full min-w-0 flex-1 flex-col"
            : "relative z-10 mx-auto flex min-h-[calc(100dvh-8.5rem)] w-full max-w-lg flex-col gap-5 px-4 pb-8 pt-3 sm:max-w-xl md:max-w-2xl md:px-6"
        }
      >
        <div className={flowExpanded ? "hidden" : "contents"}>
          <DiagnoseActivityRings />
        </div>
        <FaceScanFlow
          variant="dashboard"
          onLayoutExpanded={onLayoutExpanded}
        />
      </div>
    </div>
  );
}
