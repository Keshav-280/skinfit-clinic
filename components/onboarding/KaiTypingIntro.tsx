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
      className={`flex h-full w-full min-w-0 flex-col overflow-visible rounded-[22px] ${
        isSidebar ? "px-3 pb-3 pt-3 md:pl-3 md:pr-0 md:pb-3 md:pt-2" : "px-5 pb-5 pt-6 md:px-6 md:pb-6"
      }`}
    >
      {showHeader ? (
        <>
          <p
            className={`font-extrabold uppercase tracking-[0.28em] text-[#1E1B31]/60 ${
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
            Meet <span className="text-[#1E1B31]">kAI</span>
          </h1>
        </>
      ) : null}

      <div
        className={
          isSidebar
            ? "relative mt-0 min-h-0 w-full flex-1"
            : "mt-4 flex min-h-0 flex-1 flex-col items-center gap-3 md:flex-row md:items-center md:gap-4"
        }
      >
        <motion.div
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
          className={isSidebar ? "relative z-20 shrink-0" : "relative shrink-0"}
        >
          <Image
            src="/images/kai-avatar.png"
            alt="kAI — your SkinFit AI skin companion"
            width={132}
            height={291}
            className={
              isSidebar
                ? "h-[min(44vh,260px)] w-auto object-contain sm:h-[255px] md:h-[268px]"
                : "h-[min(32vh,220px)] w-auto object-contain md:h-[240px]"
            }
            priority
          />
        </motion.div>

        {isSidebar ? (
          <div className="absolute top-0 z-10 left-[7.75rem] w-[calc(100%-7.75rem+1rem)] sm:left-[8rem] sm:w-[calc(100%-8rem+1.25rem)] md:left-[8.25rem] md:w-[calc(100%-8.25rem+1.5rem)]">
            <div className="flex w-full items-start">
              <div
                className="mt-3 h-0 w-0 shrink-0 border-y-[7px] border-r-[9px] border-y-transparent border-r-white/70"
                aria-hidden
              />
              <AnimatePresence mode="wait">
                <motion.div
                  key={lineIndex}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.25 }}
                  className="w-full min-w-0 flex-1 rounded-2xl rounded-tl-md border border-white/75 bg-white/50 px-3.5 py-2.5 shadow-[0_6px_20px_rgba(30, 27, 49,0.08)] backdrop-blur-sm sm:py-3"
                >
                  <p className="text-[12px] font-medium leading-relaxed text-[#374151] sm:text-[13px] md:text-sm">
                    {typed}
                    <motion.span
                      animate={{ opacity: [1, 0, 1] }}
                      transition={{ duration: 0.9, repeat: Infinity }}
                      className="ml-0.5 inline-block text-[#1E1B31]"
                      aria-hidden
                    >
                      |
                    </motion.span>
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col justify-center">
            <div className="flex items-start">
              <div
                className="hidden h-0 w-0 shrink-0 border-y-[7px] border-r-[9px] border-y-transparent border-r-white/70 md:block"
                aria-hidden
              />
              <AnimatePresence mode="wait">
                <motion.div
                  key={lineIndex}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.25 }}
                  className="w-full flex-1 rounded-2xl border border-white/75 bg-white/50 px-3.5 py-3 shadow-[0_6px_20px_rgba(30, 27, 49,0.08)] backdrop-blur-sm md:rounded-tl-md"
                >
                  <p className="min-h-[4.5rem] text-sm font-medium leading-relaxed text-[#374151] md:text-[15px]">
                    {typed}
                    <motion.span
                      animate={{ opacity: [1, 0, 1] }}
                      transition={{ duration: 0.9, repeat: Infinity }}
                      className="ml-0.5 inline-block text-[#1E1B31]"
                      aria-hidden
                    >
                      |
                    </motion.span>
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>

    </motion.section>
  );
}
