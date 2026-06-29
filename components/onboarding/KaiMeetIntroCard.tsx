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
      viewBox="0 0 100 100"
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
      className="relative overflow-hidden rounded-[20px] shadow-[0_20px_48px_-16px_rgba(44,62,107,0.5)]"
      style={{
        background: `
          radial-gradient(ellipse 95% 110% at 72% 48%, ${KAI_MEET_CARD.gradient.glow} 0%, transparent 52%),
          radial-gradient(ellipse 120% 100% at 18% 80%, rgba(255,255,255,0.14) 0%, transparent 45%),
          linear-gradient(145deg, ${KAI_MEET_CARD.gradient.mid} 0%, ${KAI_MEET_CARD.gradient.edge} 52%, ${KAI_MEET_CARD.gradient.deep} 100%)
        `,
      }}
    >
      <div className="relative flex min-h-[300px] flex-col md:min-h-[400px] md:flex-row md:items-stretch">
        {/* Copy */}
        <div className="relative z-10 flex min-w-0 flex-1 flex-col justify-center px-7 py-8 sm:px-9 sm:py-10 md:max-w-[54%] md:py-12 lg:max-w-[52%]">
          <p
            className="text-sm font-bold tracking-tight"
            style={{ color: KAI_MEET_CARD.text.meet }}
          >
            Meet
          </p>
          <h1 className="mt-1 text-[3.5rem] font-extrabold leading-[0.92] tracking-tight text-white sm:text-[4rem] md:text-[4.5rem] lg:text-[5rem]">
            kAI
          </h1>
          <p className="mt-3 text-[11px] font-extrabold uppercase tracking-[0.28em] text-white sm:text-xs">
            YOUR SKIN COMPANION
          </p>

          <div className="mt-6 min-h-[5.5rem] md:mt-8 md:min-h-[4.5rem]">
            <AnimatePresence mode="wait">
              <motion.p
                key={lineIndex}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.22 }}
                className="max-w-sm text-[15px] font-semibold leading-relaxed md:max-w-md md:text-base lg:text-[17px]"
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
        </div>

        {/* Avatar + halo — halo locked to character, not the card corner */}
        <div className="relative flex min-h-[260px] flex-none items-stretch justify-center md:min-h-0 md:w-[46%] lg:w-[48%]">
          <div className="flex h-full w-full items-end justify-center pb-1 md:pb-2">
            <motion.div
              animate={{ y: [0, -5, 0] }}
              transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
              className="relative inline-block"
            >
              <div className="pointer-events-none absolute bottom-[20%] left-1/2 aspect-square w-[108%] -translate-x-1/2">
                <DotFieldSvg dots={HALO_DOTS} className="h-full w-full" glow preserveAspectRatio="xMidYMid meet" />
              </div>
              <Image
                src="/images/kai-avatar.png"
                alt="kAI — your SkinFit AI skin companion"
                width={200}
                height={441}
                className="relative z-10 block h-[min(58vw,280px)] w-auto object-contain object-bottom sm:h-[300px] md:h-[380px] lg:h-[400px]"
                priority
              />
            </motion.div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
