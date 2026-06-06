"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";

/** Routes that use the scan theme (gradient + navy chrome), same as /dashboard/scan. */
function isScanThemeRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return (
    pathname.startsWith("/onboarding/capture/") ||
    pathname.startsWith("/onboarding/baseline-report")
  );
}

export function OnboardingLayoutShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const scanTheme = isScanThemeRoute(pathname);
  const headerTitle = "kAI baseline photos";

  if (scanTheme) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#D6E4D0] via-[#E0EADA] to-[#EAF0E6]">
        <header className="sticky top-0 z-40 border-b border-white/25 bg-white/30 shadow-[0_4px_30px_rgba(0,0,0,0.04)] backdrop-blur-xl backdrop-saturate-150">
          <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 md:px-8">
            <Link
              href="/onboarding/kai-intro"
              className="flex items-center gap-1.5 rounded-full border border-white/60 bg-white/50 px-3 py-1.5 text-sm font-medium text-[#2C3E6B] backdrop-blur-sm transition-colors hover:bg-white/80"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Back
            </Link>
            <div className="flex min-w-0 flex-1 items-center justify-center gap-2 sm:justify-start">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2C3E6B] text-white shadow-md shadow-[#2C3E6B]/20">
                <Sparkles className="h-4 w-4" aria-hidden />
              </div>
              <span className="truncate text-base font-extrabold tracking-tight text-[#2C3E6B]">
                {headerTitle}
              </span>
            </div>
            <div className="hidden w-[88px] sm:block" aria-hidden />
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 pb-12 md:px-8">
          {children}
        </main>
      </div>
    );
  }

  const isKaiIntro = pathname === "/onboarding/kai-intro";
  const maxWidthClass = isKaiIntro ? "max-w-5xl" : "max-w-3xl";

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#D6E4D0] via-[#E0EADA] to-[#EAF0E6]">
      {!isKaiIntro ? (
        <header className="sticky top-0 z-40 border-b border-white/25 bg-white/30 px-4 py-3 shadow-[0_4px_30px_rgba(0,0,0,0.04)] backdrop-blur-xl backdrop-saturate-150">
          <div className={`mx-auto flex ${maxWidthClass} items-center justify-between gap-3`}>
            <Link
              href="/onboarding/kai-intro"
              className="inline-flex shrink-0 items-center"
              aria-label="SkinFit Wellness — onboarding home"
            >
              <Image
                src="/branding/skinfit-wellness-logo.svg"
                alt="SkinFit Wellness"
                width={560}
                height={135}
                className="h-8 w-auto max-w-[10.5rem] object-contain object-left sm:max-w-[11.5rem]"
              />
            </Link>
            <span className="hidden w-[7rem] sm:block" aria-hidden />
          </div>
        </header>
      ) : null}
      <main
        className={`mx-auto w-full ${maxWidthClass} px-4 pb-16 ${isKaiIntro ? "py-6 md:py-8" : "py-8"}`}
      >
        {children}
      </main>
    </div>
  );
}
