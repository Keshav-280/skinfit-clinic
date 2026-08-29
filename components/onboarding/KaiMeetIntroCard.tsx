"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Camera, ClipboardList } from "lucide-react";
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
  color = "white",
  glow = false,
  preserveAspectRatio = "none",
}: {
  dots: typeof HALO_DOTS;
  className?: string;
  color?: string;
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
          fill={color}
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
    >
      <div className="relative flex min-h-[70vh] flex-col md:min-h-[74vh] md:flex-row md:items-stretch">
        {/* Copy — sits directly on the page's own background, no card/box. Each line stages in after the character. */}
        <div className="relative z-10 flex min-w-0 flex-1 flex-col justify-center px-7 pt-10 sm:px-10 sm:pt-14 md:max-w-[56%] md:py-16 md:pl-14 lg:pl-20">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 1.1, ease: easeOut }}
          >
            <p
              className="text-2xl font-bold tracking-tight sm:text-3xl"
              style={{ color: KAI_MEET_CARD.text.meet }}
            >
              Meet
            </p>
            <h1
              className="mt-1 text-[5rem] font-extrabold leading-[0.9] tracking-tight sm:text-[6rem] md:text-[7rem] lg:text-[8.5rem]"
              style={{ color: KAI_MEET_CARD.text.meet }}
            >
              kAI.
            </h1>
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.9, ease: easeOut }}
            className="mt-4 text-sm font-extrabold uppercase tracking-[0.32em] sm:text-base"
            style={{ color: KAI_MEET_CARD.gradient.edge }}
          >
            Your skin companion.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 2.6, ease: easeOut }}
            className="mt-8 min-h-[5rem] md:mt-12"
          >
            <AnimatePresence mode="wait">
              <motion.p
                key={lineIndex}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.22 }}
                className="inline-block max-w-sm rounded-2xl bg-white/70 px-4 py-3 text-base font-medium leading-relaxed shadow-[0_4px_18px_-6px_rgba(30, 27, 49,0.25)] backdrop-blur-sm md:max-w-md md:text-lg lg:text-xl"
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
          </motion.div>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 3.4, ease: easeOut }}
            className="mt-8 flex flex-col gap-3 sm:flex-row md:mt-10"
          >
            <Link
              href="/preview/capture-guide"
              className="group inline-flex items-center justify-center gap-2 rounded-xl bg-[#1E1B31] px-5 py-3.5 text-sm font-bold text-white shadow-[0_10px_24px_-8px_rgba(30, 27, 49,0.4)] transition hover:bg-[#242A5F] hover:shadow-[0_14px_30px_-10px_rgba(30, 27, 49,0.45)]"
            >
              <Camera className="h-4 w-4" aria-hidden />
              Take scan first
              <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" aria-hidden />
            </Link>
            <Link
              href="/preview/questionnaire"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#1E1B31]/25 bg-white/70 px-5 py-3.5 text-sm font-bold text-[#1E1B31] backdrop-blur-sm transition hover:border-[#1E1B31]/40 hover:bg-white"
            >
              <ClipboardList className="h-4 w-4" aria-hidden />
              Fill questionnaire first
            </Link>
          </motion.div>
        </div>

        {/* Character — appears first, full-bleed, bottom-anchored, floats directly on the page background */}
        <div className="relative flex flex-none items-end justify-center md:w-[44%] lg:w-[46%]">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.1, delay: 0.1, ease: easeOut }}
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
              <div
                className="pointer-events-none absolute bottom-[8%] left-1/2 aspect-square w-[130%] -translate-x-1/2 rounded-full blur-[2px]"
                style={{
                  background: `radial-gradient(circle, ${KAI_MEET_CARD.gradient.mid}40 0%, ${KAI_MEET_CARD.gradient.edge}1A 40%, transparent 70%)`,
                }}
              />
              <div className="pointer-events-none absolute bottom-[6%] left-1/2 aspect-square w-[135%] -translate-x-1/2">
                <DotFieldSvg
                  dots={HALO_DOTS}
                  className="h-full w-full"
                  color={KAI_MEET_CARD.gradient.edge}
                  preserveAspectRatio="xMidYMid meet"
                />
              </div>
              <Image
                src="/images/kai-avatar-smile.png"
                alt="kAI — your SkinFit AI skin companion"
                width={835}
                height={1600}
                className="relative z-10 block h-[min(70vw,340px)] w-auto object-contain object-bottom drop-shadow-[0_20px_30px_rgba(30, 27, 49,0.25)] sm:h-[400px] md:h-[560px] lg:h-[640px]"
                priority
              />
            </motion.div>
          </motion.div>
        </div>
      </div>
    </motion.section>
  );
}
