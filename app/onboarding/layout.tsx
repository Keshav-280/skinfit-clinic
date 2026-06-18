import { redirect } from "next/navigation";
import { Suspense } from "react";
import { OnboardingLayoutShell } from "@/components/onboarding/OnboardingLayoutShell";
import { OnboardingResumeGate } from "@/components/onboarding/OnboardingResumeGate";
import { getSessionUserProfile } from "@/src/lib/auth/get-session";
import { getOnboardingResumeSnapshot } from "@/src/lib/onboardingResume";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getSessionUserProfile();
  if (!profile) {
    redirect("/login?next=/onboarding/kai-intro");
  }
  const resume = await getOnboardingResumeSnapshot(profile.id);
  // Only hard-redirect once everything (baseline + every questionnaire answer)
  // is done. Submitted-with-skips must stay reachable so patients can return
  // from the profile tracker and finish their remaining questions; the client
  // OnboardingResumeGate then routes non-questionnaire paths appropriately.
  if (resume?.onboardingFullyComplete) {
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
