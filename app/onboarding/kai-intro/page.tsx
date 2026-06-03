"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowRight,
  LogOut,
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
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="mx-auto w-full md:max-h-[85vh]">
      {/* 2-Column Dashboard Grid: Stacks on mobile, side-by-side on desktop */}
      <div className="flex flex-col gap-4 md:grid md:grid-cols-12 md:gap-5 md:items-start">
        
        {/* ─── LEFT COLUMN: HERO IMAGE & FEATURE HIGHLIGHTS (8/12 width) ─── */}
        <div className="flex flex-col gap-4 md:col-span-8">
          
          {/* Main Hero Card (Shorter aspect ratio on desktop to fit 1 page) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: easeOut }}
            className="relative w-full aspect-[16/10] md:aspect-[2/1] overflow-hidden rounded-2xl bg-zinc-950 shadow-[0_12px_32px_-12px_rgba(44,62,107,0.3)]"
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
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/85 via-zinc-900/15 to-transparent" />
            
            {/* Text Overlay */}
            <div className="absolute inset-x-0 bottom-0 p-5 md:p-6 z-10 text-white">
              <p className="text-[9px] font-extrabold uppercase tracking-[0.3em] text-[#a8c4e6]">
                Your skin companion
              </p>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight md:text-3xl">
                Meet{" "}
                <span className="bg-gradient-to-r from-white via-[#b4d2f5] to-white bg-clip-text text-transparent">
                  kAI
                </span>
              </h1>
              <p className="mt-1 text-xs leading-relaxed text-zinc-200 max-w-xl">
                Take the same guided photos each time, so your skin changes are
                easier to follow.
              </p>
            </div>
          </motion.div>

          {/* 3 Highlights Side-by-Side Under the Hero */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.08, ease: easeOut }}
            className="grid gap-2.5 grid-cols-1 sm:grid-cols-3"
          >
            {HIGHLIGHTS.map(({ icon: Icon, title, caption }, i) => (
              <div
                key={title}
                className="group rounded-xl border border-zinc-200 bg-white px-3.5 py-3 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#E8EFF8] to-[#D6E4F0] text-[#2C3E6B] shadow-inner">
                  <Icon className="h-4 w-4" strokeWidth={2.2} />
                </div>
                <p className="text-xs font-bold text-[#1E3264]">{title}</p>
                <p className="mt-0.5 text-[10px] leading-snug text-zinc-500">{caption}</p>
              </div>
            ))}
          </motion.div>
          
        </div>

        {/* ─── RIGHT COLUMN: OTHER 2 IMAGES STACKED VERTICALLY (4/12 width) ─── */}
        <div className="flex flex-col gap-3 md:col-span-4">
          
          {/* Card 1: Holographic Scan */}
          <motion.div
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.45, delay: 0.15, ease: easeOut }}
            className="relative w-full aspect-[4/3] md:aspect-[1.6/1] overflow-hidden rounded-xl shadow-sm border border-zinc-200 group"
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
              <p className="mt-0.5 text-[11px] font-bold text-white leading-tight">
                Real-time skin health metrics
              </p>
            </div>
          </motion.div>

          {/* Card 2: Features Visual */}
          <motion.div
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.45, delay: 0.22, ease: easeOut }}
            className="relative w-full aspect-[4/3] md:aspect-[1.6/1] overflow-hidden rounded-xl shadow-sm border border-zinc-200 group"
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
              <p className="mt-0.5 text-[11px] font-bold text-white leading-tight">
                Track, analyse &amp; improve your skin
              </p>
            </div>
          </motion.div>

        </div>
      </div>

      {/* ─── BOTTOM SECTION: BOUNDARIES & ACTION BUTTON ─── */}
      <div className="mt-4 flex flex-col gap-3">
        
        {/* Boundaries Info Box */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.28, ease: easeOut }}
          className="rounded-xl border border-zinc-200 bg-zinc-50/80 px-3 py-2"
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
                className="rounded-full border border-white/70 bg-white/90 px-2 py-0.5 text-[9px] font-medium text-zinc-600 shadow-sm"
              >
                {line}
              </span>
            ))}
          </div>
        </motion.div>

        {/* Start Scan Button */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.34, ease: easeOut }}
        >
          <Link
            href="/onboarding/capture"
            className="group relative inline-flex w-full items-center justify-center overflow-hidden rounded-xl bg-gradient-to-r from-[#2C3E6B] via-[#3d5080] to-[#1E3264] px-4 py-3 text-sm font-bold text-white shadow-[0_10px_24px_-8px_rgba(44,62,107,0.4)] transition hover:shadow-[0_14px_30px_-10px_rgba(44,62,107,0.45)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2C3E6B]"
          >
            <span className="relative z-10 flex items-center gap-2">
              Start baseline scan
              <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
            </span>
            <span
              className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/12 to-white/0 opacity-0 transition group-hover:opacity-100"
              aria-hidden
            />
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.38, ease: easeOut }}
        >
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white/50 px-4 py-3 text-sm font-bold text-zinc-700 shadow-sm backdrop-blur-sm transition-colors hover:bg-white/80"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            Sign out
          </button>
        </motion.div>

      </div>
    </div>
  );
}
