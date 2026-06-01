"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Scan,
  TrendingUp,
  Sparkles,
  Shield,
  type LucideIcon,
} from "lucide-react";

const easeOut = [0.22, 1, 0.36, 1] as const;

const HIGHLIGHTS: {
  icon: LucideIcon;
  title: string;
  caption: string;
}[] = [
  {
    icon: Scan,
    title: "Five-angle scans",
    caption: "Same capture flow every week",
  },
  {
    icon: TrendingUp,
    title: "Weekly trends",
    caption: "See progress, not one-off scores",
  },
  {
    icon: Sparkles,
    title: "Personal focus",
    caption: "Short, actionable guidance",
  },
];

const BOUNDARIES = [
  "Not a diagnosis",
  "Not a prescription",
  "Your doctor leads care",
];

export default function KaiIntroPage() {
  return (
    <div className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute -left-24 top-0 h-56 w-56 rounded-full bg-[#2C3E6B]/12 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-20 top-40 h-48 w-48 rounded-full bg-[#94B6A2]/35 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute bottom-20 left-1/2 h-40 w-72 -translate-x-1/2 rounded-full bg-white/50 blur-3xl"
        aria-hidden
      />

      <div className="relative mx-auto max-w-lg space-y-8">
        <motion.header
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: easeOut }}
          className="text-center"
        >
          <div className="mx-auto mb-6 flex justify-center">
            <Image
              src="/branding/skinfit-wellness-logo.svg"
              alt="SkinFit Wellness"
              width={560}
              height={135}
              priority
              className="h-10 w-auto max-w-[220px] object-contain sm:h-11 sm:max-w-[260px]"
            />
          </div>
          <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#3d5080]">
            Your skin companion
          </p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-[#1E3264] md:text-[2.75rem]">
            Meet{" "}
            <span className="bg-gradient-to-r from-[#2C3E6B] via-[#4A6FA5] to-[#2C3E6B] bg-clip-text text-transparent">
              kAI
            </span>
          </h1>
          <p className="mx-auto mt-3 max-w-xs text-[15px] leading-relaxed text-zinc-600">
            Eight skin parameters. One clear picture of what&apos;s working.
          </p>
        </motion.header>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.06, ease: easeOut }}
          className="grid gap-3 sm:grid-cols-3"
        >
          {HIGHLIGHTS.map(({ icon: Icon, title, caption }, i) => (
            <div
              key={title}
              className="group rounded-2xl border border-white/80 bg-white/75 p-4 shadow-[0_16px_40px_-20px_rgba(44,62,107,0.28)] backdrop-blur-md transition hover:-translate-y-0.5 hover:bg-white/90"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#E8EFF8] to-[#D6E4F0] text-[#2C3E6B] shadow-inner">
                <Icon className="h-5 w-5" strokeWidth={2} />
              </div>
              <p className="text-sm font-bold text-[#1E3264]">{title}</p>
              <p className="mt-1 text-xs leading-snug text-zinc-500">{caption}</p>
            </div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.12, ease: easeOut }}
          className="rounded-2xl border border-[#2C3E6B]/10 bg-[#2C3E6B]/[0.04] px-4 py-3.5 backdrop-blur-sm"
        >
          <div className="mb-2.5 flex items-center justify-center gap-2 text-[#2C3E6B]">
            <Shield className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
            <p className="text-xs font-semibold uppercase tracking-[0.16em]">
              Good to know
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {BOUNDARIES.map((line) => (
              <span
                key={line}
                className="rounded-full border border-white/70 bg-white/80 px-3 py-1 text-[11px] font-medium text-zinc-600 shadow-sm"
              >
                {line}
              </span>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.18, ease: easeOut }}
          className="pt-1"
        >
          <Link
            href="/onboarding/capture"
            className="group relative inline-flex w-full items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-r from-[#2C3E6B] via-[#3d5080] to-[#1E3264] px-5 py-4 text-base font-bold text-white shadow-[0_14px_36px_-10px_rgba(44,62,107,0.55)] transition hover:shadow-[0_18px_44px_-12px_rgba(44,62,107,0.6)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2C3E6B]"
          >
            <span className="relative z-10 flex items-center gap-2">
              Start baseline scan
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </span>
            <span
              className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/12 to-white/0 opacity-0 transition group-hover:opacity-100"
              aria-hidden
            />
          </Link>
          <p className="mt-3 text-center text-[11px] font-medium tracking-wide text-zinc-500">
            ~2 min · 5 guided photos
          </p>
        </motion.div>
      </div>
    </div>
  );
}
