"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Shield } from "lucide-react";

import { KaiMeetIntroCard } from "@/components/onboarding/KaiMeetIntroCard";

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
          href="/onboarding/questionnaire?entry=start"
          className="text-sm font-semibold text-[#2C3E6B]/80 underline-offset-2 transition hover:text-[#2C3E6B] hover:underline"
        >
          Skip to questionnaire
        </Link>
      </div>

      <KaiMeetIntroCard />

      <div className="mt-4 flex flex-col gap-3">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2, ease: easeOut }}
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
          transition={{ duration: 0.4, delay: 0.28, ease: easeOut }}
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
