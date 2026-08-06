import { Suspense } from "react";
import { OnboardingQuestionnaireForm } from "@/components/onboarding/OnboardingQuestionnaireForm";

export default function OnboardingQuestionnairePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[100dvh] items-center justify-center bg-[#F0F0F0] text-sm text-zinc-500">
          Loading…
        </div>
      }
    >
      <OnboardingQuestionnaireForm />
    </Suspense>
  );
}
