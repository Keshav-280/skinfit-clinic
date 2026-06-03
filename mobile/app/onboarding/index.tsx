import { Redirect, type Href } from "expo-router";

/** Legacy welcome/video step removed — kAI intro is the onboarding entry. */
export default function OnboardingWelcome() {
  return <Redirect href={"/onboarding/kai-intro" as Href} />;
}
