"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  FaceScanFlow,
  type FaceScanFlowVariant,
} from "@/components/dashboard/FaceScanFlow";

function MobileCaptureFlow() {
  const searchParams = useSearchParams();
  const variant: FaceScanFlowVariant =
    searchParams.get("v") === "onboarding" ? "onboarding" : "dashboard";

  return <FaceScanFlow variant={variant} />;
}

export default function MobileCapturePage() {
  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-100 flex flex-col justify-center">
      <Suspense
        fallback={
          <div className="text-center py-12 text-slate-400">
            Loading capture tool...
          </div>
        }
      >
        <MobileCaptureFlow />
      </Suspense>
    </div>
  );
}
