"use client";

import { SkinFitLoader } from "@/components/dashboard/SkinFitLoader";

export default function SchedulesLoading() {
  return (
    <SkinFitLoader
      title="Opening your calendar"
      subtitle="kAI is fetching visits, treatments, and requests."
    />
  );
}
