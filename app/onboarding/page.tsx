import { redirect } from "next/navigation";

/** Legacy welcome/video step removed — kAI intro is the onboarding entry. */
export default function OnboardingIndexPage() {
  redirect("/onboarding/kai-intro");
}
