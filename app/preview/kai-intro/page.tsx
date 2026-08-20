// TEMPORARY — no-auth preview of the kAI intro hero, for local design review only.
// Safe to delete before/after this is confirmed; not linked from anywhere in the app.
import { KaiMeetIntroCard } from "@/components/onboarding/KaiMeetIntroCard";

export default function KaiIntroPreviewPage() {
  return (
    <div className="min-h-dvh bg-[#F5F3EF] text-[#1F2A44]">
      <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-3 md:px-6 md:pt-4">
        <KaiMeetIntroCard />
      </main>
    </div>
  );
}
