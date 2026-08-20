"use client";

import { motion } from "framer-motion";
import { Shield } from "lucide-react";

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
      <KaiMeetIntroCard />

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2, ease: easeOut }}
        className="mt-8"
      >
        <div className="mb-1.5 flex items-center justify-center gap-1.5 text-[#2C3E6B]/70">
          <Shield className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
          <p className="text-[9px] font-bold uppercase tracking-[0.16em]">
            Before you start
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-1.5">
          {BOUNDARIES.map((line) => (
            <span
              key={line}
              className="rounded-full border border-[#2C3E6B]/15 bg-white/60 px-2 py-0.5 text-[9px] font-medium text-zinc-600"
            >
              {line}
            </span>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
