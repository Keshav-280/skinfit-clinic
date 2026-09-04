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
import { OnboardingSignOutLink } from "@/components/onboarding/OnboardingLayoutShell";
import {
  KAI_INTRO_ATMOSPHERE,
  KAI_MEET_CARD,
  meetCardAuraField,
} from "@/src/lib/kaiMeetIntroCardVisual";

const easeOut = [0.22, 1, 0.36, 1] as const;

const AURA_DOTS = meetCardAuraField();

function DotFieldSvg({
  dots,
  className,
  color = "white",
  glow = false,
  preserveAspectRatio = "none",
}: {
  dots: typeof AURA_DOTS;
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
      transition={{ duration: 0.5, ease: easeOut }}
      className="relative mx-auto flex h-full min-h-0 w-full flex-col overflow-hidden"
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `linear-gradient(90deg, ${KAI_INTRO_ATMOSPHERE.left} 0%, ${KAI_INTRO_ATMOSPHERE.mid} 48%, ${KAI_INTRO_ATMOSPHERE.right} 100%)`,
        }}
        aria-hidden
      />
      <div className="relative z-20 flex min-h-10 shrink-0 items-center justify-between px-6 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-8 md:px-10 lg:pl-14 lg:pr-10">
        <p
          className="text-base font-semibold leading-none tracking-tight sm:text-lg"
          style={{ color: KAI_MEET_CARD.text.meet }}
        >
          Meet
        </p>
        <OnboardingSignOutLink />
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row md:items-stretch">
      <div className="relative z-10 flex shrink-0 flex-col px-6 pt-1 sm:px-8 md:max-w-[54%] md:flex-1 md:justify-center md:px-10 md:pt-2 lg:pl-14">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.35, ease: easeOut }}
        >
          <h1
            className="font-kai text-[clamp(2.85rem,16vw,4.75rem)] leading-[0.92] md:text-[clamp(4.25rem,8vw,6.5rem)]"
            style={{ color: KAI_MEET_CARD.text.meet }}
          >
            kAI
          </h1>
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.7, ease: easeOut }}
          className="mt-2 text-[11px] font-extrabold uppercase tracking-[0.28em] sm:text-xs"
          style={{ color: KAI_MEET_CARD.gradient.edge }}
        >
          Your skin companion.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1.05, ease: easeOut }}
          className="mt-3 min-h-[3.25rem] sm:min-h-[3.5rem] md:mt-5"
        >
          <AnimatePresence mode="wait">
            <motion.p
              key={lineIndex}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.22 }}
              className="inline-block max-w-sm rounded-2xl bg-white/70 px-3.5 py-2 text-sm font-medium leading-snug shadow-[0_4px_18px_-6px_rgba(30,27,49,0.25)] backdrop-blur-sm md:max-w-md md:px-4 md:py-2.5 md:text-base"
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

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1.35, ease: easeOut }}
          className="mt-3 flex flex-col gap-2 sm:flex-row md:mt-6"
        >
          <Link
            href="/preview/capture-guide"
            className="group inline-flex items-center justify-center gap-2 rounded-xl bg-[#1E1B31] px-4 py-2.5 text-sm font-bold text-white shadow-[0_10px_24px_-8px_rgba(30,27,49,0.4)] transition hover:bg-[#242A5F] hover:shadow-[0_14px_30px_-10px_rgba(30,27,49,0.45)]"
          >
            <Camera className="h-4 w-4" aria-hidden />
            Take scan first
            <ArrowRight
              className="h-3.5 w-3.5 transition group-hover:translate-x-0.5"
              aria-hidden
            />
          </Link>
          <Link
            href="/preview/questionnaire"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#1E1B31]/25 bg-white/70 px-4 py-2.5 text-sm font-bold text-[#1E1B31] backdrop-blur-sm transition hover:border-[#1E1B31]/40 hover:bg-white"
          >
            <ClipboardList className="h-4 w-4" aria-hidden />
            Fill questionnaire first
          </Link>
        </motion.div>
      </div>

      <div className="relative flex min-h-0 flex-1 items-end justify-center md:w-[46%]">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.08, ease: easeOut }}
          className="relative flex h-full w-full items-end justify-center"
        >
          <motion.div
            animate={{ y: [0, -5, 0] }}
            transition={{
              duration: 4.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="relative flex h-full max-h-full w-full items-end justify-center"
          >
            <div
              className="pointer-events-none absolute bottom-[8%] left-1/2 aspect-square w-[min(145%,34rem)] -translate-x-1/2 rounded-full md:w-[175%]"
              style={{
                background: `radial-gradient(circle, ${KAI_INTRO_ATMOSPHERE.glow} 0%, rgba(196, 210, 255, 0.22) 38%, transparent 70%)`,
              }}
            />
            <div className="pointer-events-none absolute bottom-[2%] left-1/2 aspect-square w-[min(155%,36rem)] -translate-x-1/2 md:w-[185%]">
              <DotFieldSvg
                dots={AURA_DOTS}
                className="h-full w-full blur-[0.6px]"
                color={KAI_INTRO_ATMOSPHERE.particleSoft}
                glow
                preserveAspectRatio="xMidYMid meet"
              />
              <DotFieldSvg
                dots={AURA_DOTS}
                className="absolute inset-0 h-full w-full"
                color={KAI_INTRO_ATMOSPHERE.particle}
                preserveAspectRatio="xMidYMid meet"
              />
            </div>
            <Image
              src="/images/kai-avatar-smile.png"
              alt="kAI - your SkinFit AI skin companion"
              width={835}
              height={1600}
              className="relative z-10 block h-full max-h-full w-auto object-contain object-bottom drop-shadow-[0_16px_24px_rgba(30,27,49,0.22)]"
              priority
            />
          </motion.div>
        </motion.div>
      </div>
      </div>
    </motion.section>
  );
}
