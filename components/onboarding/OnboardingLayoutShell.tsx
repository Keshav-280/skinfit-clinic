"use client";

import Image from "next/image";
import Link from "next/link";
import { LogOut } from "lucide-react";
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
      aria-label="Sign out"
      title="Sign out"
      className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#2C3E6B]/15 bg-white/55 text-[#2C3E6B] shadow-[0_4px_16px_-8px_rgba(44,62,107,0.35)] backdrop-blur-md transition hover:border-[#2C3E6B]/28 hover:bg-white/80 focus:outline-none focus:ring-2 focus:ring-[#2C3E6B]/25 focus:ring-offset-2 focus:ring-offset-[#E0EADA]"
    >
      <LogOut className="h-[1.125rem] w-[1.125rem]" strokeWidth={2.25} aria-hidden />
    </button>
  );
}

const onboardingShellClass =
  "min-h-dvh bg-[#D6E4D0] bg-gradient-to-b from-[#D6E4D0] via-[#E0EADA] to-[#EAF0E6] pt-[env(safe-area-inset-top)] text-[#1F2A44] [color-scheme:light]";

export function OnboardingLayoutShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const scanTheme = isScanThemeRoute(pathname);

  if (scanTheme) {
    return (
      <div
        data-onboarding-shell
        className={`${onboardingShellClass} flex min-h-dvh flex-col`}
      >
        <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col overflow-y-auto px-4 py-6 md:px-6 md:py-8">
          {children}
        </main>
      </div>
    );
  }

  const isKaiIntro = pathname === "/onboarding/kai-intro";
  const maxWidthClass = isKaiIntro ? "max-w-5xl" : "max-w-3xl";

  return (
    <div data-onboarding-shell className={onboardingShellClass}>
      {isKaiIntro ? (
        <header className="sticky top-0 z-40 border-b border-[#2C3E6B]/10 bg-[#D6E4D0]/90 bg-gradient-to-b from-[#D6E4D0] to-[#E0EADA]/80 px-4 pb-3 pt-3 shadow-[0_4px_24px_-12px_rgba(44,62,107,0.12)] backdrop-blur-md md:px-8">
          <div
            className={`mx-auto flex ${maxWidthClass} items-center justify-end`}
          >
            <OnboardingSignOutLink />
          </div>
        </header>
      ) : (
        <header className="sticky top-0 z-40 border-b border-[#2C3E6B]/10 bg-[#E0EADA]/85 px-4 py-3 shadow-[0_4px_24px_-12px_rgba(44,62,107,0.1)] backdrop-blur-md">
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
            <OnboardingSignOutLink />
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
