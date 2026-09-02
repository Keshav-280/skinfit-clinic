"use client";

import { SkinFitLoader } from "@/components/dashboard/SkinFitLoader";

export default function ScoreConcernLoading() {
  return (
    <SkinFitLoader
      title="Preparing your score"
      subtitle="kAI is lining up this concern against your recent scans."
    />
  );
}
