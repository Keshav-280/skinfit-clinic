import Link from "next/link";

export default function OnboardingWelcomePage() {
  return (
    <div className="space-y-6 text-center">
      <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-teal-600">
        SkinFit Wellness
      </p>
      <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 md:text-3xl">
        Welcome to your skin journey
      </h1>
      <p className="text-sm leading-relaxed text-zinc-600 md:text-base">
        Your doctor has prepared a short welcome — next you will meet kAI, our
        analysis assistant, and complete a guided skin assessment (about 10
        minutes).
      </p>
      <div className="flex min-h-[180px] items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-100 px-4 py-6">
        <p className="text-sm text-zinc-500">
          Doctor welcome video — replace this block with an embedded video when
          ready.
        </p>
      </div>
      <Link
        href="/onboarding/kai-intro"
        className="inline-flex w-full items-center justify-center rounded-2xl bg-teal-600 px-5 py-4 text-base font-bold text-white shadow-sm transition-colors hover:bg-teal-700"
      >
        Begin my skin assessment
      </Link>
    </div>
  );
}
