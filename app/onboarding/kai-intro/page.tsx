"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";

import { KaiTypingIntro } from "@/components/onboarding/KaiTypingIntro";
import { ArrowRight, Shield } from "lucide-react";

const easeOut = [0.22, 1, 0.36, 1] as const;

const BOUNDARIES = [
  "No diagnosis",
  "No prescriptions",
  "Some concerns need a clinic visit",
  "Your doctor guides your care",
];

export default function KaiIntroPage() {
  return (
    <div className="mx-auto w-full">
      <div className="mb-3 flex justify-start md:mb-4">
        <Link
          href="/onboarding/questionnaire"
          className="text-sm font-semibold text-[#2C3E6B]/80 underline-offset-2 transition hover:text-[#2C3E6B] hover:underline"
        >
          Skip to questionnaire
        </Link>
      </div>

      <div className="flex flex-col gap-4 overflow-visible md:grid md:grid-cols-[8.4fr_3.6fr] md:items-stretch md:gap-5">
        {/* Hero — skin analysis banner (+20% width vs prior 7/12; fixed height on desktop) */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: easeOut }}
          className="relative min-h-[220px] w-full overflow-hidden rounded-2xl bg-zinc-950 shadow-[0_12px_32px_-12px_rgba(44,62,107,0.3)] md:h-[280px] md:min-h-0"
        >
          <Image
            src="/images/kai-skin-analysis.png"
            alt="kAI advanced skin analysis — facial mapping with molecular insights"
            fill
            className="object-cover opacity-90"
            priority
            sizes="(max-width: 768px) 100vw, 70vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/90 via-zinc-900/20 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 z-10 p-5 text-white md:p-6">
            <p className="text-[9px] font-extrabold uppercase tracking-[0.3em] text-[#a8c4e6]">
              Your skin companion
            </p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight md:text-3xl">
              Meet{" "}
              <span className="bg-gradient-to-r from-white via-[#b4d2f5] to-white bg-clip-text text-transparent">
                kAI
              </span>
            </h1>
            <p className="mt-1 max-w-md text-xs leading-relaxed text-zinc-200">
              Take the same guided photos each time, so your skin changes are easier
              to follow.
            </p>
          </div>
        </motion.div>

        {/* kAI avatar + typing message */}
        <div className="w-full min-w-0 overflow-visible md:h-[280px] md:min-h-0">
          <KaiTypingIntro showHeader={false} variant="sidebar" />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.45, delay: 0.15, ease: easeOut }}
          className="group relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-zinc-200 bg-[#E8EFE6] shadow-sm md:aspect-[1.6/1]"
        >
          <Image
            src="/images/kai-holographic-scan.png"
            alt="kAI holographic skin health dashboard"
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, 340px"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-3">
            <p className="text-[8px] font-bold uppercase tracking-wider text-[#a8c4e6]">
              Dashboard
            </p>
            <p className="mt-0.5 text-[11px] font-bold leading-tight text-white">
              Real-time skin health metrics
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.45, delay: 0.22, ease: easeOut }}
          className="group relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-zinc-200 bg-[#E8EFE6] shadow-sm md:aspect-[1.6/1]"
        >
          <Image
            src="/images/kai-features-visual.png"
            alt="AI skin analysis tracking"
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, 340px"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-3">
            <p className="text-[8px] font-bold uppercase tracking-wider text-[#a8c4e6]">
              Insights
            </p>
            <p className="mt-0.5 text-[11px] font-bold leading-tight text-white">
              Track, analyse &amp; improve your skin
            </p>
          </div>
        </motion.div>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.28, ease: easeOut }}
          className="rounded-xl border border-[#2C3E6B]/10 bg-white/35 px-3 py-2 backdrop-blur-sm"
        >
          <div className="mb-1 flex items-center justify-center gap-1.5 text-[#2C3E6B]">
            <Shield className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
            <p className="text-[9px] font-bold uppercase tracking-[0.16em]">
              Before you start
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-1.5">
            {BOUNDARIES.map((line) => (
              <span
                key={line}
                className="rounded-full border border-white/70 bg-white/80 px-2 py-0.5 text-[9px] font-medium text-zinc-600 shadow-sm"
              >
                {line}
              </span>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.34, ease: easeOut }}
          className="flex flex-col gap-2"
        >
          <Link
            href="/onboarding/capture/photos"
            className="group relative inline-flex w-full items-center justify-center overflow-hidden rounded-xl bg-gradient-to-r from-[#2C3E6B] via-[#3d5080] to-[#1E3264] px-4 py-3 text-sm font-bold text-white shadow-[0_10px_24px_-8px_rgba(44,62,107,0.4)] transition hover:shadow-[0_14px_30px_-10px_rgba(44,62,107,0.45)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2C3E6B]"
          >
            <span className="relative z-10 flex items-center gap-2">
              Start baseline scan
              <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
            </span>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
