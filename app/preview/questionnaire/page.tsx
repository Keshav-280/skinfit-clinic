// TEMPORARY - no-auth preview of the redesigned questionnaire wizard, for local design review only.
// Safe to delete before/after this is confirmed; not linked from anywhere in the app.
import { QuestionnaireWizardPreview } from "@/components/onboarding/QuestionnaireWizardPreview";

export default function QuestionnaireWizardPreviewPage() {
  return (
    <div className="min-h-dvh bg-[#FAF8F5]">
      <QuestionnaireWizardPreview />
    </div>
  );
}
