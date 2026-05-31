"use client";

import type { ReactNode } from "react";
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

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-2.032 1.58-3.006 1.56-.126-1.085.468-2.28 1.148-3.02.77-.83 2.122-1.46 3.035-1.5.018 1.287-.397 2.464-1 2.88zM20.98 17.3c-.588 1.35-.861 1.937-1.612 3.14-1.045 1.675-2.523 3.76-4.355 3.78-1.625.02-2.04-1.05-4.237-1.05-2.197 0-2.648 1.03-4.27 1.07-1.813.04-3.195-1.85-4.24-3.52-2.305-3.7-2.55-8.04-1.126-10.35 1.004-1.72 2.59-2.73 4.09-2.73 1.887 0 3.075 1.09 4.63 1.09 1.488 0 2.4-1.09 4.12-1.09 1.474 0 2.808.85 3.703 2.33-3.216 1.7-2.693 6.16.852 7.41-.185.51-.388 1.01-.737 1.71z"
      />
    </svg>
  );
}

type SocialLoginButtonsProps = {
  disabled?: boolean;
};

function oauthHref(path: string, next: string | null): string {
  return next ? `${path}?next=${encodeURIComponent(next)}` : path;
}

function SocialIconButton({
  href,
  disabled,
  icon,
  label,
}: {
  href: string;
  disabled?: boolean;
  icon: ReactNode;
  label: string;
}) {
  return (
    <a
      href={disabled ? undefined : href}
      aria-disabled={disabled}
      aria-label={label}
      title={label}
      className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#2C3E6B] shadow-sm transition hover:border-[#2C3E6B]/25 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#2C3E6B]/20 focus:ring-offset-2 aria-disabled:pointer-events-none aria-disabled:opacity-50"
      onClick={(e) => {
        if (disabled) e.preventDefault();
      }}
    >
      {icon}
    </a>
  );
}

export function SocialLoginButtons({ disabled }: SocialLoginButtonsProps) {
  const searchParams = useSearchParams();
  const next = searchParams.get("next");

  return (
    <div className="flex justify-center gap-3">
      <SocialIconButton
        href={oauthHref("/api/auth/oauth/google", next)}
        disabled={disabled}
        icon={<GoogleIcon className="h-5 w-5 shrink-0" />}
        label="Continue with Google"
      />
      <SocialIconButton
        href={oauthHref("/api/auth/oauth/apple", next)}
        disabled={disabled}
        icon={<AppleIcon className="h-[1.35rem] w-[1.35rem] shrink-0" />}
        label="Continue with Apple"
      />
    </div>
  );
}
