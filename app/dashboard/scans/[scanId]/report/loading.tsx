"use client";

import { SkinFitLoader } from "@/components/dashboard/SkinFitLoader";

export default function ScanReportLoading() {
  return (
    <SkinFitLoader
      title="Preparing your report"
      subtitle="kAI is laying out your scan details. This usually takes a few seconds."
    />
  );
}
