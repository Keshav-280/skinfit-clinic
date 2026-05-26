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
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.05 20.28c-.98.95-2.05 1.88-3.51 1.9-1.46.02-1.93-.86-3.6-.86-1.67 0-2.19.84-3.57.88-1.38.04-2.43-.92-3.41-1.87C2.09 15.25 1.28 10.96 3.14 7.72c1.86-3.24 5.28-4.45 6.56-4.3 1.28.15 2.2 1.02 3.6 1.02 1.4 0 2.25-.88 3.78-.95 1.53-.07 2.65.8 3.9 1.88-3.43 1.88-2.87 6.02.76 7.35-.65 1.58-1.54 3.16-2.69 4.56zM12.03 4.25c.73-1.76 2.41-2.94 4.2-3.08.33 1.83-.53 3.67-1.85 4.78-1.32 1.11-3.14 1.55-2.35-.7z" />
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
  variant,
}: {
  href: string;
  disabled?: boolean;
  icon: ReactNode;
  label: string;
  variant: "google" | "apple";
}) {
  const base =
    "inline-flex h-12 w-12 items-center justify-center rounded-full border shadow-sm transition-transform focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 aria-disabled:pointer-events-none aria-disabled:opacity-50 hover:scale-[0.97]";
  const styles =
    variant === "apple"
      ? `${base} border-slate-900 bg-slate-900 text-white hover:bg-slate-800`
      : `${base} border-slate-200 bg-white text-slate-800 hover:bg-slate-50`;

  return (
    <a
      href={disabled ? undefined : href}
      aria-disabled={disabled}
      aria-label={label}
      title={label}
      className={styles}
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
    <div className="flex justify-center gap-4">
      <SocialIconButton
        href={oauthHref("/api/auth/oauth/google", next)}
        disabled={disabled}
        variant="google"
        icon={<GoogleIcon className="h-5 w-5 shrink-0" />}
        label="Continue with Google"
      />
      <SocialIconButton
        href={oauthHref("/api/auth/oauth/apple", next)}
        disabled={disabled}
        variant="apple"
        icon={<AppleIcon className="h-5 w-5 shrink-0" />}
        label="Continue with Apple"
      />
    </div>
  );
}
