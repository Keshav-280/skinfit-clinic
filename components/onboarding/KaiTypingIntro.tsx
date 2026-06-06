"use client";

import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

import {
  KAI_INTRO_LINES,
  KAI_LINE_PAUSE_MS,
  KAI_TYPING_MS_PER_CHAR,
} from "@/src/lib/kaiIntroScript";

const easeOut = [0.22, 1, 0.36, 1] as const;

export function KaiTypingIntro() {
  const [lineIndex, setLineIndex] = useState(0);
  const [typed, setTyped] = useState("");

  const line = KAI_INTRO_LINES[lineIndex] ?? KAI_INTRO_LINES[0];

  useEffect(() => {
    setTyped("");
  }, [lineIndex]);

  useEffect(() => {
    if (typed.length >= line.length) {
      const pauseTimer = window.setTimeout(() => {
        setLineIndex((i) => (i + 1) % KAI_INTRO_LINES.length);
      }, KAI_LINE_PAUSE_MS);
      return () => window.clearTimeout(pauseTimer);
    }
    const timer = window.setTimeout(() => {
      setTyped(line.slice(0, typed.length + 1));
    }, KAI_TYPING_MS_PER_CHAR);
    return () => window.clearTimeout(timer);
  }, [typed, line]);

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: easeOut }}
      className="rounded-[22px] border border-white/70 bg-white/40 px-5 pb-5 pt-6 shadow-[0_8px_30px_rgba(44,62,107,0.08)] backdrop-blur-sm md:px-6 md:pb-6"
    >
      <p className="text-center text-[10px] font-extrabold uppercase tracking-[0.28em] text-[#2C3E6B]/60">
        Your skin companion
      </p>
      <h1 className="mt-1 text-center text-2xl font-extrabold tracking-tight text-[#1F2A44] md:text-3xl">
        Meet <span className="text-[#2C3E6B]">kAI</span>
      </h1>

      <div className="mt-4 flex items-center gap-3 md:gap-4">
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
          className="relative shrink-0"
        >
          <Image
            src="/images/kai-avatar.png"
            alt="kAI — your SkinFit AI skin companion"
            width={132}
            height={291}
            className="h-[min(32vh,220px)] w-auto object-contain md:h-[240px]"
            priority
          />
        </motion.div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center">
            <div
              className="h-0 w-0 shrink-0 border-y-[9px] border-r-[10px] border-y-transparent border-r-white/90"
              aria-hidden
            />
            <AnimatePresence mode="wait">
              <motion.div
                key={lineIndex}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
                className="flex-1 rounded-2xl border border-white/80 bg-white/90 px-3.5 py-3 shadow-sm md:px-4 md:py-3.5"
              >
                <p className="min-h-[4.5rem] text-sm font-medium leading-relaxed text-[#374151] md:text-[15px]">
                  {typed}
                  <motion.span
                    animate={{ opacity: [1, 0, 1] }}
                    transition={{ duration: 0.9, repeat: Infinity }}
                    className="ml-0.5 inline-block text-[#2C3E6B]"
                    aria-hidden
                  >
                    |
                  </motion.span>
                </p>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="mt-3.5 flex justify-center gap-1.5">
        {KAI_INTRO_LINES.map((_, i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === lineIndex ? "w-5 bg-[#2C3E6B]" : "w-1.5 bg-[#2C3E6B]/20"
            }`}
          />
        ))}
      </div>
    </motion.section>
  );
}
