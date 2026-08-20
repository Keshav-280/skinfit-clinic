// TEMPORARY — no-auth preview of the illustrated 5-angle capture guide, for local design review only.
// Safe to delete before/after this is confirmed; not linked from anywhere in the app.
import { CaptureGuideWizardPreview } from "@/components/onboarding/CaptureGuideWizardPreview";

export default function CaptureGuidePreviewPage() {
  return (
    <div className="min-h-dvh bg-[#F5F3EF]">
      <CaptureGuideWizardPreview />
    </div>
  );
}
