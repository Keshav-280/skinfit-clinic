import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
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
    <div className="min-h-screen bg-[#FDF9F0]">
      <header className="border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
        <Link
          href="/onboarding"
          className="text-sm font-semibold text-teal-700 hover:text-teal-800"
        >
          SkinFit — kAI setup
        </Link>
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 py-8 pb-16">
        <Suspense fallback={<div className="min-h-[30vh]" aria-hidden />}>
          <OnboardingResumeGate>{children}</OnboardingResumeGate>
        </Suspense>
      </main>
    </div>
  );
}
