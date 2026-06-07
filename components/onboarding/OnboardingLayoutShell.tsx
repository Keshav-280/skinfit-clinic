"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback } from "react";

/** Routes that use the scan theme (gradient + navy chrome), same as /dashboard/scan. */
function isScanThemeRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return (
    pathname.startsWith("/onboarding/capture/") ||
    pathname.startsWith("/onboarding/baseline-report")
  );
}

function OnboardingSignOutLink() {
  const router = useRouter();

  const handleLogout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }, [router]);

  return (
    <button
      type="button"
      onClick={() => void handleLogout()}
      className="text-sm font-medium text-[#2C3E6B]/70 transition hover:text-[#2C3E6B] hover:underline"
    >
      Sign out
    </button>
  );
}

const onboardingShellClass =
  "min-h-dvh bg-gradient-to-b from-[#D6E4D0] via-[#E0EADA] to-[#EAF0E6] text-[#1F2A44] [color-scheme:light]";

export function OnboardingLayoutShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const scanTheme = isScanThemeRoute(pathname);

  if (scanTheme) {
    return (
      <div className={onboardingShellClass}>
        <main className="mx-auto w-full max-w-5xl px-4 pb-12 pt-2 md:px-6">
          {children}
        </main>
      </div>
    );
  }

  const isKaiIntro = pathname === "/onboarding/kai-intro";
  const maxWidthClass = isKaiIntro ? "max-w-5xl" : "max-w-3xl";

  return (
    <div className={onboardingShellClass}>
      {isKaiIntro ? (
        <header className="sticky top-0 z-40 px-4 pt-3 md:px-8">
          <div
            className={`mx-auto flex ${maxWidthClass} items-center justify-end`}
          >
            <OnboardingSignOutLink />
          </div>
        </header>
      ) : (
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
      )}
      <main
        className={`mx-auto w-full ${maxWidthClass} px-4 pb-16 ${isKaiIntro ? "py-6 md:py-8" : "py-8"}`}
      >
        {children}
      </main>
    </div>
  );
}
