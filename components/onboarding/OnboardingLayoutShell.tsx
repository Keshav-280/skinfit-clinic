"use client";

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
      className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-[#2C3E6B] transition hover:bg-[#2C3E6B]/8 focus:outline-none focus:ring-2 focus:ring-[#2C3E6B]/25 focus:ring-offset-2 focus:ring-offset-[#E0EADA]"
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
    <div data-onboarding-shell className={`relative ${onboardingShellClass}`}>
      <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-end pt-[max(0.5rem,env(safe-area-inset-top))]">
        <div className="pointer-events-auto pr-3 pt-1 md:pr-5">
          <OnboardingSignOutLink />
        </div>
      </div>
      <main
        className={`mx-auto w-full ${maxWidthClass} px-4 pb-16 pt-3 md:px-6 md:pt-4`}
      >
        {children}
      </main>
    </div>
  );
}
