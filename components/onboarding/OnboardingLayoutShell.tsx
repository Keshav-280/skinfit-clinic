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

function isQuestionnaireChatRoute(pathname: string | null): boolean {
  return pathname === "/onboarding/questionnaire";
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
      className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-[#1E1B31] transition hover:bg-[#1E1B31]/8 focus:outline-none focus:ring-2 focus:ring-[#1E1B31]/25 focus:ring-offset-2 focus:ring-offset-[#FAF8F5]"
    >
      <LogOut className="h-[1.125rem] w-[1.125rem]" strokeWidth={2.25} aria-hidden />
    </button>
  );
}

const onboardingShellClass =
  "min-h-dvh bg-[#FAF8F5] pt-[env(safe-area-inset-top)] text-[#1F2A44] [color-scheme:light]";

export function OnboardingLayoutShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const scanTheme = isScanThemeRoute(pathname);
  const questionnaireChat = isQuestionnaireChatRoute(pathname);

  if (questionnaireChat) {
    return (
      <div
        data-onboarding-shell
        className="h-dvh max-h-dvh overflow-hidden bg-[#F0F0F0] text-[#1F2A44] [color-scheme:light]"
      >
        <main className="h-full w-full overflow-hidden">{children}</main>
      </div>
    );
  }

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

  if (isKaiIntro) {
    return (
      <div
        data-onboarding-shell
        className="relative h-dvh max-h-dvh overflow-hidden bg-[#FAF8F5] text-[#1F2A44] [color-scheme:light]"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 z-50 flex justify-end pt-[max(0.35rem,env(safe-area-inset-top))]">
          <div className="pointer-events-auto pr-3 pt-1 md:pr-5">
            <OnboardingSignOutLink />
          </div>
        </div>
        <main className="h-full min-h-0 w-full overflow-hidden">{children}</main>
      </div>
    );
  }

  return (
    <div data-onboarding-shell className={`relative ${onboardingShellClass}`}>
      <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-end pt-[max(0.5rem,env(safe-area-inset-top))]">
        <div className="pointer-events-auto pr-3 pt-1 md:pr-5">
          <OnboardingSignOutLink />
        </div>
      </div>
      <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-3 md:px-6 md:pt-4">
        {children}
      </main>
    </div>
  );
}
