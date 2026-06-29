"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

import {
  KAI_INTRO_LINES,
  KAI_LINE_PAUSE_MS,
  KAI_TYPING_MS_PER_CHAR,
} from "@/src/lib/kaiIntroScript";

const easeOut = [0.22, 1, 0.36, 1] as const;

function SparkleHalo({ className }: { className?: string }) {
  const dots = Array.from({ length: 48 }, (_, i) => {
    const angle = (i / 48) * Math.PI * 2;
    const radius = 46 + (i % 3) * 2;
    const x = 50 + Math.cos(angle) * radius;
    const y = 50 + Math.sin(angle) * radius;
    const size = i % 4 === 0 ? 3.5 : i % 2 === 0 ? 2.5 : 1.8;
    const opacity = 0.35 + (i % 5) * 0.12;
    return { x, y, size, opacity, key: i };
  });

  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      aria-hidden
    >
      {dots.map((dot) => (
        <circle
          key={dot.key}
          cx={dot.x}
          cy={dot.y}
          r={dot.size}
          fill="white"
          opacity={dot.opacity}
        />
      ))}
    </svg>
  );
}

export function KaiMeetIntroCard() {
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
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: easeOut }}
      className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#7B8EC8] via-[#8B96D8] to-[#A8B5E0] shadow-[0_16px_40px_-14px_rgba(44,62,107,0.45)]"
    >
      <div className="flex flex-col md:min-h-[280px] md:flex-row md:items-stretch">
        <div className="flex min-w-0 flex-1 flex-col justify-center px-6 py-7 sm:px-8 sm:py-8 md:max-w-[58%] md:py-9">
          <p className="text-sm font-bold tracking-tight text-[#1E3264]">Meet</p>
          <h1 className="mt-0.5 text-[3.25rem] font-extrabold leading-[0.95] tracking-tight text-white sm:text-[3.75rem] md:text-[4.25rem]">
            kAI
          </h1>
          <p className="mt-2 text-xs font-bold uppercase tracking-[0.22em] text-white/95 sm:text-sm">
            Your skin companion
          </p>

          <div className="mt-5 min-h-[5.5rem] sm:min-h-[4.75rem] md:min-h-[5.25rem]">
            <AnimatePresence mode="wait">
              <motion.p
                key={lineIndex}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.22 }}
                className="max-w-md text-sm font-medium leading-relaxed text-[#1F2A44] sm:text-[15px] md:text-base"
              >
                {typed}
                <motion.span
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ duration: 0.9, repeat: Infinity }}
                  className="ml-0.5 inline-block text-[#1E3264]"
                  aria-hidden
                >
                  |
                </motion.span>
              </motion.p>
            </AnimatePresence>
          </div>
        </div>

        <div className="relative flex min-h-[220px] flex-none items-end justify-center px-4 pb-0 pt-2 sm:min-h-[240px] md:min-h-0 md:w-[42%] md:px-2 md:pt-0">
          <SparkleHalo className="pointer-events-none absolute bottom-[8%] right-[8%] h-[min(72vw,240px)] w-[min(72vw,240px)] opacity-90 md:bottom-[10%] md:right-[6%] md:h-[min(100%,260px)] md:w-[min(100%,260px)]" />
          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
            className="relative z-10"
          >
            <Image
              src="/images/kai-avatar.png"
              alt="kAI — your SkinFit AI skin companion"
              width={180}
              height={397}
              className="h-[min(52vw,220px)] w-auto object-contain sm:h-[240px] md:h-[min(34vw,268px)] md:max-h-[268px]"
              priority
            />
          </motion.div>
        </div>
      </div>
    </motion.section>
  );
}
