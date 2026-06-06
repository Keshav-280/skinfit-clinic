"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

import { KaiTypingIntro } from "@/components/onboarding/KaiTypingIntro";
import { ArrowRight, LogOut, Shield } from "lucide-react";

const easeOut = [0.22, 1, 0.36, 1] as const;

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
      <KaiTypingIntro />

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          
          {/* Card 1: Holographic Scan */}
          <motion.div
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.45, delay: 0.15, ease: easeOut }}
            className="relative w-full aspect-[4/3] md:aspect-[1.6/1] overflow-hidden rounded-xl border border-zinc-200 bg-[#E8EFE6] shadow-sm group"
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
            className="relative w-full aspect-[4/3] md:aspect-[1.6/1] overflow-hidden rounded-xl border border-zinc-200 bg-[#E8EFE6] shadow-sm group"
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
          <Link
            href="/dashboard"
            className="inline-flex w-full items-center justify-center rounded-xl border border-[#2C3E6B]/15 bg-white/60 px-4 py-2.5 text-sm font-semibold text-[#2C3E6B] transition hover:bg-white/90"
          >
            Skip for now
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
