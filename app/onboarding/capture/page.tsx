import { redirect } from "next/navigation";

/** Legacy intro URL - go straight to photo guide + capture. */
export default function OnboardingCaptureRedirectPage() {
  redirect("/onboarding/capture/photos");
}
