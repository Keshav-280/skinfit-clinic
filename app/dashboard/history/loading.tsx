"use client";

import { SkinFitLoader } from "@/components/dashboard/SkinFitLoader";

export default function HistoryLoading() {
  return (
    <SkinFitLoader
      title="Assembling your timeline"
      subtitle="kAI is pulling your progress, visits, and care notes."
    />
  );
}
