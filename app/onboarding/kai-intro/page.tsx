"use client";

import Link from "next/link";
import Image from "next/image";
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
    title: "Five-angle photos",
    caption: "Same angles each time, easier to compare",
  },
  {
    icon: TrendingUp,
    title: "Progress over time",
    caption: "Look at the trend, not just one scan",
  },
  {
    icon: Sparkles,
    title: "Simple next steps",
    caption: "Small routine nudges based on your skin",
  },
];

const BOUNDARIES = [
  "No diagnosis",
  "No prescriptions",
  "Some concerns need a clinic visit",
  "Your doctor guides your care",
];

export default function KaiIntroPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      {/* ─── Hero image section ─── */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: easeOut }}
        className="relative mx-auto w-full overflow-hidden rounded-3xl shadow-[0_20px_60px_-15px_rgba(44,62,107,0.3)]"
      >
        <div className="relative aspect-[16/10] w-full">
          <Image
            src="/images/kai-skin-analysis.png"
            alt="kAI advanced skin analysis — facial mapping with molecular insights"
            fill
            className="object-cover"
            priority
            sizes="(max-width: 768px) 100vw, 672px"
          />
          {/* Gradient overlay for text legibility */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#1E3264]/80 via-[#1E3264]/20 to-transparent" />
          {/* Text overlay on hero */}
          <div className="absolute inset-x-0 bottom-0 px-6 pb-6 pt-12 text-white">
            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-white/70">
              Your skin companion
            </p>
            <h1 className="mt-2 text-4xl font-extrabold tracking-tight md:text-[2.75rem]">
              Meet{" "}
              <span className="bg-gradient-to-r from-white via-[#a8c4e6] to-white bg-clip-text text-transparent">
                kAI
              </span>
            </h1>
            <p className="mt-2 max-w-sm text-[15px] leading-relaxed text-white/80">
              Take the same guided photos each time, so your skin changes are
              easier to follow.
            </p>
          </div>
        </div>
      </motion.div>

      {/* ─── Two-column: holographic visual + feature cards ─── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1, ease: easeOut }}
        className="grid items-stretch gap-4 sm:grid-cols-2"
      >
        {/* Left — Holographic scan image */}
        <div className="relative overflow-hidden rounded-2xl shadow-lg">
          <div className="relative aspect-[3/4] w-full sm:aspect-auto sm:h-full">
            <Image
              src="/images/kai-holographic-scan.png"
              alt="kAI holographic skin health dashboard in a modern clinic"
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, 336px"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#1E3264]/60 via-transparent to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-white/70">
                Powered by AI
              </p>
              <p className="mt-1 text-sm font-bold text-white">
                Real-time skin health metrics
              </p>
            </div>
          </div>
        </div>

        {/* Right — Feature highlight cards */}
        <div className="flex flex-col gap-3">
          {HIGHLIGHTS.map(({ icon: Icon, title, caption }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                duration: 0.4,
                delay: 0.18 + i * 0.08,
                ease: easeOut,
              }}
              className="group flex items-start gap-3.5 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#E8EFF8] to-[#D6E4F0] text-[#2C3E6B] shadow-inner">
                <Icon className="h-5 w-5" strokeWidth={2} />
              </div>
              <div>
                <p className="text-sm font-bold text-[#1E3264]">{title}</p>
                <p className="mt-0.5 text-xs leading-snug text-zinc-500">
                  {caption}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* ─── Features visual banner ─── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.25, ease: easeOut }}
        className="relative overflow-hidden rounded-2xl shadow-md"
      >
        <div className="relative aspect-[21/9] w-full">
          <Image
            src="/images/kai-features-visual.png"
            alt="AI skin analysis with progress tracking, insights, and scanning capabilities"
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 672px"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#1E3264]/70 via-[#1E3264]/30 to-transparent" />
          <div className="absolute inset-y-0 left-0 flex flex-col justify-center px-6 py-4">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/60">
              Advanced Analysis
            </p>
            <p className="mt-1.5 max-w-[220px] text-base font-extrabold leading-snug text-white md:text-lg">
              Track, analyse &amp; improve your skin health
            </p>
          </div>
        </div>
      </motion.div>

      {/* ─── Boundaries / Before you start ─── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.32, ease: easeOut }}
        className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3.5"
      >
        <div className="mb-2.5 flex items-center justify-center gap-2 text-[#2C3E6B]">
          <Shield className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
          <p className="text-xs font-semibold uppercase tracking-[0.16em]">
            Before you start
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

      {/* ─── CTA Button ─── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.38, ease: easeOut }}
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
      </motion.div>
    </div>
  );
}
