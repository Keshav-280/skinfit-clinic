"use client";

import { SkinFitLoader } from "@/components/dashboard/SkinFitLoader";

export default function VisitDetailLoading() {
  return (
    <SkinFitLoader
      title="Opening visit details"
      subtitle="kAI is fetching clinic notes and attachments."
    />
  );
}
