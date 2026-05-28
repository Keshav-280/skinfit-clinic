import { redirect } from "next/navigation";
import { Suspense } from "react";
import { OnboardingLayoutShell } from "@/components/onboarding/OnboardingLayoutShell";
import { OnboardingResumeGate } from "@/components/onboarding/OnboardingResumeGate";
import { getSessionUserProfile } from "@/src/lib/auth/get-session";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getSessionUserProfile();
  if (!profile) {
    redirect("/login?next=/onboarding");
  }
  if (profile.onboardingComplete) {
    redirect("/dashboard");
  }

  return (
    <OnboardingLayoutShell>
      <Suspense fallback={<div className="min-h-[30vh]" aria-hidden />}>
        <OnboardingResumeGate>{children}</OnboardingResumeGate>
      </Suspense>
    </OnboardingLayoutShell>
  );
}
