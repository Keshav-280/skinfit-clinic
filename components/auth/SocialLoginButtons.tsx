"use client";

import { useSearchParams } from "next/navigation";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

type SocialLoginButtonsProps = {
  disabled?: boolean;
  variant?: "light" | "dark";
  /** @deprecated Bar layout is always used; kept for call-site compatibility */
  compact?: boolean;
};

function oauthHref(path: string, next: string | null): string {
  return next ? `${path}?next=${encodeURIComponent(next)}` : path;
}

export function SocialLoginButtons({
  disabled,
  variant = "light",
}: SocialLoginButtonsProps) {
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const isDark = variant === "dark";

  return (
    <a
      href={disabled ? undefined : oauthHref("/api/auth/oauth/google", next)}
      aria-disabled={disabled}
      className={`flex w-full items-center justify-center gap-3 rounded-xl border px-4 py-3.5 text-[15px] font-semibold shadow-sm transition focus:outline-none focus:ring-2 aria-disabled:pointer-events-none aria-disabled:opacity-50 ${
        isDark
          ? "border-white/20 bg-white text-[#1E232C] hover:bg-white/95 focus:ring-[#F0EAE2]/25 focus:ring-offset-2 focus:ring-offset-[#1E1B31]"
          : "border-[#E8ECF4] bg-white text-[#1E232C] hover:border-slate-300 hover:bg-[#F7F8F9] focus:ring-[#1E1B31]/20 focus:ring-offset-2"
      }`}
      onClick={(e) => {
        if (disabled) e.preventDefault();
      }}
    >
      <GoogleIcon className="h-5 w-5 shrink-0" />
      <span>Continue with Google</span>
    </a>
  );
}
