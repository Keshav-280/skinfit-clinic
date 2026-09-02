"use client";

import { SkinFitLoader } from "@/components/dashboard/SkinFitLoader";

export default function ProfileLoading() {
  return (
    <SkinFitLoader
      title="Opening your profile"
      subtitle="kAI is gathering your skin identity and care notes."
    />
  );
}
