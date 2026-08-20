"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

import {
  KAI_INTRO_LINES,
  KAI_LINE_PAUSE_MS,
  KAI_TYPING_MS_PER_CHAR,
} from "@/src/lib/kaiIntroScript";
import {
  KAI_MEET_CARD,
  meetCardHaloDots,
} from "@/src/lib/kaiMeetIntroCardVisual";

const easeOut = [0.22, 1, 0.36, 1] as const;

const HALO_DOTS = meetCardHaloDots();

function DotFieldSvg({
  dots,
  className,
  glow = false,
  preserveAspectRatio = "none",
}: {
  dots: typeof HALO_DOTS;
  className?: string;
  glow?: boolean;
  preserveAspectRatio?: string;
}) {
  return (
    <svg
      viewBox="-24 -24 148 148"
      preserveAspectRatio={preserveAspectRatio}
      className={className}
      aria-hidden
    >
      {dots.map((dot) => (
        <circle
          key={dot.key}
          cx={dot.x}
          cy={dot.y}
          r={dot.r}
          fill="white"
          opacity={dot.opacity}
          style={glow ? { filter: "blur(0.3px)" } : undefined}
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
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, ease: easeOut }}
      className="relative -mx-4 overflow-hidden md:-mx-6"
      style={{
        background: `
          radial-gradient(circle 520px at 76% 55%, ${KAI_MEET_CARD.gradient.glow} 0%, rgba(218,232,255,0.14) 40%, transparent 72%),
          radial-gradient(ellipse 120% 100% at 18% 90%, rgba(255,255,255,0.10) 0%, transparent 45%),
          linear-gradient(135deg, ${KAI_MEET_CARD.gradient.mid} 0%, ${KAI_MEET_CARD.gradient.edge} 54%, ${KAI_MEET_CARD.gradient.deep} 100%)
        `,
      }}
    >
      <div className="relative flex min-h-[78vh] flex-col md:min-h-[80vh] md:flex-row md:items-stretch">
        {/* Copy — text lives directly on the page, no card panel */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15, ease: easeOut }}
          className="relative z-10 flex min-w-0 flex-1 flex-col justify-center px-7 pt-10 sm:px-10 sm:pt-14 md:max-w-[56%] md:py-16 md:pl-14 lg:pl-20"
        >
          <p
            className="text-base font-semibold tracking-tight"
            style={{ color: KAI_MEET_CARD.text.meet }}
          >
            Meet
          </p>
          <h1 className="mt-1 text-[5rem] font-extrabold leading-[0.9] tracking-tight text-white sm:text-[6rem] md:text-[7rem] lg:text-[8.5rem]">
            kAI.
          </h1>
          <p className="mt-4 text-sm font-extrabold uppercase tracking-[0.32em] text-white/90 sm:text-base">
            Your skin companion.
          </p>

          <div className="mt-8 min-h-[5rem] md:mt-12">
            <AnimatePresence mode="wait">
              <motion.p
                key={lineIndex}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.22 }}
                className="max-w-sm text-base font-medium leading-relaxed md:max-w-md md:text-lg lg:text-xl"
                style={{ color: KAI_MEET_CARD.text.desc }}
              >
                {typed}
                <motion.span
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ duration: 0.9, repeat: Infinity }}
                  className="ml-0.5 inline-block"
                  style={{ color: KAI_MEET_CARD.text.desc }}
                  aria-hidden
                >
                  |
                </motion.span>
              </motion.p>
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Character — full-bleed, bottom-anchored */}
        <div className="relative flex flex-none items-end justify-center md:w-[44%] lg:w-[46%]">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease: easeOut }}
            className="relative w-full"
          >
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{
                duration: 4.5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="relative flex items-end justify-center"
            >
              <div className="pointer-events-none absolute bottom-[8%] left-1/2 aspect-square w-[130%] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(235,244,255,0.28)_0%,rgba(155,190,255,0.10)_40%,transparent_70%)] blur-[2px]" />
              <div className="pointer-events-none absolute bottom-[6%] left-1/2 aspect-square w-[135%] -translate-x-1/2">
                <DotFieldSvg
                  dots={HALO_DOTS}
                  className="h-full w-full drop-shadow-[0_0_6px_rgba(214,235,255,0.55)]"
                  glow
                  preserveAspectRatio="xMidYMid meet"
                />
              </div>
              <Image
                src="/images/kai-avatar.png"
                alt="kAI — your SkinFit AI skin companion"
                width={200}
                height={441}
                className="relative z-10 block h-[min(70vw,340px)] w-auto object-contain object-bottom sm:h-[400px] md:h-[560px] lg:h-[640px]"
                priority
              />
            </motion.div>
          </motion.div>
        </div>
      </div>
    </motion.section>
  );
}
