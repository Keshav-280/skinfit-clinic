import { redirect } from "next/navigation";
import { Suspense } from "react";
import { OnboardingLayoutShell } from "@/components/onboarding/OnboardingLayoutShell";
import { OnboardingResumeGate } from "@/components/onboarding/OnboardingResumeGate";
import { getSessionUserProfile } from "@/src/lib/auth/get-session";
import { getOnboardingAccessForUser } from "@/src/lib/onboardingAccess";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getSessionUserProfile();
  if (!profile) {
    redirect("/login?next=/onboarding/kai-intro");
  }
  if (profile.onboardingComplete) {
    const access = await getOnboardingAccessForUser(profile.id);
    if (access.hasBaselineScan || access.baselineScanPending) {
      redirect("/dashboard");
    }
  }

  return (
    <OnboardingLayoutShell>
      <Suspense fallback={<div className="min-h-[30vh]" aria-hidden />}>
        <OnboardingResumeGate>{children}</OnboardingResumeGate>
      </Suspense>
    </OnboardingLayoutShell>
  );
}
