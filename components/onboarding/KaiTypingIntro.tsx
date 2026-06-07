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

type Props = {
  /** When false, only avatar + speech (hero carries the title). */
  showHeader?: boolean;
  /** Tighter layout for the desktop sidebar beside the hero image. */
  variant?: "default" | "sidebar";
};

export function KaiTypingIntro({
  showHeader = true,
  variant = "default",
}: Props) {
  const [lineIndex, setLineIndex] = useState(0);
  const [typed, setTyped] = useState("");

  const line = KAI_INTRO_LINES[lineIndex] ?? KAI_INTRO_LINES[0];
  const isSidebar = variant === "sidebar";

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
      className={`flex h-full flex-col rounded-[22px] border border-white/70 bg-white/40 shadow-[0_8px_30px_rgba(44,62,107,0.08)] backdrop-blur-sm ${
        isSidebar ? "px-4 pb-4 pt-4 md:px-5 md:pb-5" : "px-5 pb-5 pt-6 md:px-6 md:pb-6"
      }`}
    >
      {showHeader ? (
        <>
          <p
            className={`font-extrabold uppercase tracking-[0.28em] text-[#2C3E6B]/60 ${
              isSidebar ? "text-[9px]" : "text-center text-[10px]"
            }`}
          >
            Your skin companion
          </p>
          <h1
            className={`mt-1 font-extrabold tracking-tight text-[#1F2A44] ${
              isSidebar ? "text-xl md:text-2xl" : "text-center text-2xl md:text-3xl"
            }`}
          >
            Meet <span className="text-[#2C3E6B]">kAI</span>
          </h1>
        </>
      ) : null}

      <div
        className={`flex min-h-0 flex-1 ${
          isSidebar ? "mt-2 flex-col items-center gap-3" : "mt-4 items-center gap-3 md:gap-4"
        } ${!isSidebar ? "md:flex-row" : ""}`}
      >
        <motion.div
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
          className="relative shrink-0"
        >
          <Image
            src="/images/kai-avatar.png"
            alt="kAI — your SkinFit AI skin companion"
            width={132}
            height={291}
            className={
              isSidebar
                ? "h-[min(28vh,180px)] w-auto object-contain md:h-[200px]"
                : "h-[min(32vh,220px)] w-auto object-contain md:h-[240px]"
            }
            priority
          />
        </motion.div>

        <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col justify-center">
          <div className={`flex items-center ${isSidebar ? "flex-col sm:flex-row" : ""}`}>
            {!isSidebar ? (
              <div
                className="hidden h-0 w-0 shrink-0 border-y-[9px] border-r-[10px] border-y-transparent border-r-white/90 md:block"
                aria-hidden
              />
            ) : (
              <div
                className="mb-1 hidden h-0 w-0 shrink-0 border-b-[10px] border-l-[9px] border-r-[9px] border-b-white/90 border-l-transparent border-r-transparent sm:mb-0 sm:mr-0 sm:block sm:border-b-[9px] sm:border-l-transparent sm:border-r-[10px] sm:border-t-transparent sm:border-b-transparent sm:border-r-white/90"
                aria-hidden
              />
            )}
            <AnimatePresence mode="wait">
              <motion.div
                key={lineIndex}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
                className="w-full flex-1 rounded-2xl border border-white/80 bg-white/90 px-3.5 py-3 shadow-sm md:px-4 md:py-3.5"
              >
                <p
                  className={`font-medium leading-relaxed text-[#374151] ${
                    isSidebar
                      ? "min-h-[5.5rem] text-[13px] md:min-h-[6rem] md:text-sm"
                      : "min-h-[4.5rem] text-sm md:text-[15px]"
                  }`}
                >
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

      <div className={`mt-3 flex justify-center gap-1.5 ${isSidebar ? "md:mt-auto" : "mt-3.5"}`}>
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
