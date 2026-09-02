"use client";

import { SkinFitLoader } from "@/components/dashboard/SkinFitLoader";

export default function DashboardLoading() {
  return (
    <SkinFitLoader
      title="Opening your home"
      subtitle="kAI is gathering your scores, visits, and next steps."
    />
  );
}
