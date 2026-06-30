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
    <div className="flex min-h-screen flex-col justify-center bg-[#F2F9F2] text-[#2C3E6B]">
      <Suspense
        fallback={
          <div className="py-12 text-center text-sm text-[#64748B]">
            Loading capture tool...
          </div>
        }
      >
        <MobileCaptureFlow />
      </Suspense>
    </div>
  );
}
