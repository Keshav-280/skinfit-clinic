// TEMPORARY — no-auth preview of the kAI intro hero, for local design review only.
// Safe to delete before/after this is confirmed; not linked from anywhere in the app.
import { KaiMeetIntroCard } from "@/components/onboarding/KaiMeetIntroCard";

export default function KaiIntroPreviewPage() {
  return (
    <div className="h-dvh max-h-dvh overflow-hidden bg-[#FAF8F5] text-[#1F2A44]">
      <main className="h-full min-h-0 w-full overflow-hidden">
        <KaiMeetIntroCard />
      </main>
    </div>
  );
}
