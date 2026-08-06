"use client";

import { useCallback, useState } from "react";
import { Sun } from "lucide-react";
import { FaceScanFlow } from "@/components/dashboard/FaceScanFlow";
import { DiagnoseActivityRings } from "@/components/dashboard/DiagnoseActivityRings";
import { FACE_SCAN_INSTRUCTIONS_BELOW_CAMERA } from "@/src/lib/faceScanCaptures";

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
          : "mx-auto w-full max-w-5xl px-3 pb-10 pt-2 sm:px-4"
      }
    >
      <div
        className={
          flowExpanded
            ? "flex min-h-0 flex-1 flex-col"
            : "grid gap-4 md:grid-cols-2 md:items-stretch"
        }
      >
        {!flowExpanded ? <DiagnoseActivityRings /> : null}
        <FaceScanFlow
          variant="dashboard"
          onLayoutExpanded={onLayoutExpanded}
        />
      </div>

      {!flowExpanded ? (
        <div className="mt-4 flex flex-col gap-2 border-t border-zinc-100 pt-4 sm:flex-row sm:items-center sm:gap-3">
          <Sun
            className="h-4 w-4 shrink-0 text-[#2C3E6B]/70"
            aria-hidden
          />
          <ul className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-0">
            {FACE_SCAN_INSTRUCTIONS_BELOW_CAMERA.map((line, i) => (
              <li
                key={line}
                className="flex items-start text-sm font-light text-zinc-500 sm:items-center"
              >
                {i > 0 ? (
                  <span
                    className="mx-2.5 hidden text-zinc-300 sm:inline"
                    aria-hidden
                  >
                    ·
                  </span>
                ) : null}
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
