import Link from "next/link";
import type { ReactNode } from "react";

import { CLINIC_PUBLIC_CONTACT } from "@/src/lib/clinicPublicContact";
import { SKINFIT_THEME } from "@/src/lib/skinfitTheme";

const NAVY = SKINFIT_THEME.navy;

type Props = {
  kicker: string;
  title: string;
  lastUpdated: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function LegalPageShell({
  kicker,
  title,
  lastUpdated,
  children,
  footer,
}: Props) {
  return (
    <div
      className="min-h-screen text-[#1F2A44]"
      style={{
        background: "linear-gradient(180deg, #E8EFE6 0%, #DCE8D4 55%, #D6E4D0 100%)",
      }}
    >
      <header className="sticky top-0 z-50 border-b border-[#2C3E6B]/10 bg-[#E8EFE6]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <Link href="/dashboard" className="flex flex-col leading-tight">
            <span className="text-lg font-extrabold tracking-tight" style={{ color: NAVY }}>
              SkinnFit
            </span>
            <span className="text-[11px] font-medium text-[#5C6478]">Patient app</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="rounded-xl border border-[#2C3E6B]/15 bg-white/70 px-3 py-2 text-xs font-semibold text-[#2C3E6B] transition hover:bg-white"
            >
              Dashboard
            </Link>
            <Link
              href="/login"
              className="hidden rounded-xl px-3 py-2 text-xs font-semibold text-[#5C6478] transition hover:text-[#2C3E6B] sm:inline"
            >
              Sign in
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <article className="overflow-hidden rounded-[22px] border border-white/80 bg-white/95 px-5 py-8 shadow-[0_20px_48px_-28px_rgba(44,62,107,0.35)] ring-1 ring-[#2C3E6B]/8 sm:px-8 sm:py-10">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#3d5080]">
            {kicker}
          </p>
          <h1
            className="mt-2 text-[1.75rem] font-extrabold leading-tight tracking-tight sm:text-4xl"
            style={{ color: NAVY }}
          >
            {title}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-[#5C6478]">
            Last updated: <span className="font-semibold text-[#2C3E6B]">{lastUpdated}</span>
          </p>
          <p className="mt-2 text-sm leading-relaxed text-[#5C6478]">
            This policy applies to the SkinnFit mobile app and patient web dashboard used with
            participating dermatology clinics in India.
          </p>

          <div className="mt-8 space-y-8">{children}</div>

          {footer ? (
            <div className="mt-10 border-t border-[#2C3E6B]/10 pt-6 text-sm text-[#5C6478]">
              {footer}
            </div>
          ) : null}
        </article>

        <p className="mt-6 text-center text-xs text-[#64748B]">
          © {new Date().getFullYear()} {CLINIC_PUBLIC_CONTACT.legalName}. All rights reserved.
        </p>
      </main>
    </div>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="text-base font-extrabold sm:text-lg" style={{ color: NAVY }}>
        {title}
      </h2>
      <div className="mt-3 space-y-2.5 text-sm leading-relaxed text-[#4A5568]">{children}</div>
    </section>
  );
}

export function LegalBulletList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-2 pl-5">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}
