"use client";

import { SkinFitLoader } from "@/components/dashboard/SkinFitLoader";

export default function VisitsListLoading() {
  return (
    <SkinFitLoader
      title="Opening your visits"
      subtitle="kAI is fetching clinic notes from past appointments."
    />
  );
}
