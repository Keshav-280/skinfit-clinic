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
    <div className="mx-auto w-full">
      {/* 2-Column Dashboard Grid: Stacks on mobile, side-by-side on desktop */}
      <div className="flex flex-col gap-6 md:grid md:grid-cols-12 md:gap-6 md:items-start">
        
        {/* ─── LEFT COLUMN: HERO IMAGE & FEATURE HIGHLIGHTS (8/12 width) ─── */}
        <div className="flex flex-col gap-6 md:col-span-8">
          
          {/* Main Hero Card (Wider aspect ratio) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: easeOut }}
            className="relative w-full aspect-[16/10] overflow-hidden rounded-3xl bg-zinc-950 shadow-[0_15px_40px_-12px_rgba(44,62,107,0.3)]"
          >
            <Image
              src="/images/kai-skin-analysis.png"
              alt="kAI advanced skin analysis — facial mapping with molecular insights"
              fill
              className="object-cover opacity-90 transition-transform duration-700 hover:scale-105"
              priority
              sizes="(max-width: 768px) 100vw, 680px"
            />
            {/* Soft gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 via-zinc-900/20 to-transparent" />
            
            {/* Text Overlay */}
            <div className="absolute inset-x-0 bottom-0 p-6 md:p-8 z-10 text-white">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-[#a8c4e6]">
                Your skin companion
              </p>
              <h1 className="mt-1.5 text-3xl font-extrabold tracking-tight md:text-4xl">
                Meet{" "}
                <span className="bg-gradient-to-r from-white via-[#b4d2f5] to-white bg-clip-text text-transparent">
                  kAI
                </span>
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-zinc-200">
                Take the same guided photos each time, so your skin changes are
                easier to follow.
              </p>
            </div>
          </motion.div>

          {/* 3 Highlights Side-by-Side Under the Hero */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.08, ease: easeOut }}
            className="grid gap-3 grid-cols-1 sm:grid-cols-3"
          >
            {HIGHLIGHTS.map(({ icon: Icon, title, caption }, i) => (
              <div
                key={title}
                className="group rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="mb-2.5 flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#E8EFF8] to-[#D6E4F0] text-[#2C3E6B] shadow-inner">
                  <Icon className="h-4.5 w-4.5" strokeWidth={2.2} />
                </div>
                <p className="text-xs font-bold text-[#1E3264]">{title}</p>
                <p className="mt-1 text-[11px] leading-snug text-zinc-500">{caption}</p>
              </div>
            ))}
          </motion.div>
          
        </div>

        {/* ─── RIGHT COLUMN: OTHER 2 IMAGES STACKED VERTICALLY (4/12 width) ─── */}
        <div className="flex flex-col gap-4 md:col-span-4">
          
          {/* Card 1: Holographic Scan */}
          <motion.div
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.45, delay: 0.15, ease: easeOut }}
            className="relative w-full aspect-[4/3] overflow-hidden rounded-2xl shadow-md border border-zinc-200 group"
          >
            <Image
              src="/images/kai-holographic-scan.png"
              alt="kAI holographic skin health dashboard"
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, 340px"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#a8c4e6]">
                Dashboard
              </p>
              <p className="mt-0.5 text-xs font-bold text-white">
                Real-time skin health metrics
              </p>
            </div>
          </motion.div>

          {/* Card 2: Features Visual */}
          <motion.div
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.45, delay: 0.22, ease: easeOut }}
            className="relative w-full aspect-[4/3] overflow-hidden rounded-2xl shadow-md border border-zinc-200 group"
          >
            <Image
              src="/images/kai-features-visual.png"
              alt="AI skin analysis tracking"
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, 340px"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#a8c4e6]">
                Insights
              </p>
              <p className="mt-0.5 text-xs font-bold text-white">
                Track, analyse &amp; improve your skin
              </p>
            </div>
          </motion.div>

        </div>
      </div>

      {/* ─── BOTTOM SECTION: BOUNDARIES & ACTION BUTTON ─── */}
      <div className="mt-6 flex flex-col gap-4">
        
        {/* Boundaries Info Box */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.28, ease: easeOut }}
          className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3"
        >
          <div className="mb-2 flex items-center justify-center gap-1.5 text-[#2C3E6B]">
            <Shield className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
            <p className="text-[10px] font-bold uppercase tracking-[0.16em]">
              Before you start
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-1.5">
            {BOUNDARIES.map((line) => (
              <span
                key={line}
                className="rounded-full border border-white/70 bg-white/90 px-2.5 py-0.5 text-[10px] font-medium text-zinc-600 shadow-sm"
              >
                {line}
              </span>
            ))}
          </div>
        </motion.div>

        {/* Start Scan Button */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.34, ease: easeOut }}
        >
          <Link
            href="/onboarding/capture"
            className="group relative inline-flex w-full items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-r from-[#2C3E6B] via-[#3d5080] to-[#1E3264] px-5 py-4 text-base font-bold text-white shadow-[0_12px_30px_-8px_rgba(44,62,107,0.45)] transition hover:shadow-[0_16px_36px_-10px_rgba(44,62,107,0.5)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2C3E6B]"
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
    </div>
  );
}
