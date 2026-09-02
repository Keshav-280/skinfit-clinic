"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

/** Brighter than ink so the arc reads as navy, not near-black. */
const ARC = "#323A80";
const FACE = "#FAF8F5";
const PAGE_H = "calc(100dvh - 8.5rem)";

const BREATH = {
  duration: 8,
  repeat: Infinity,
  ease: [0.42, 0, 0.58, 1] as const,
  times: [0, 0.42, 0.52, 1],
};

function BreathCopy({
  phase,
  headlineClass,
  subClass,
}: {
  phase: "in" | "out";
  headlineClass: string;
  subClass: string;
}) {
  return (
    <>
      <motion.p
        key={phase}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className={`font-headline text-[1.75rem] font-bold tracking-tight sm:text-3xl ${headlineClass}`}
      >
        {phase === "in" ? "Breathe in" : "Breathe out"}
      </motion.p>
      <p className={`mt-2 text-sm sm:text-base ${subClass}`}>
        kAI is analysing your skin. This takes about 20 seconds.
      </p>
    </>
  );
}

export function ScanAnalysingBreath() {
  const [phase, setPhase] = useState<"in" | "out">("in");
  const rootRef = useRef<HTMLDivElement>(null);
  const [rootSize, setRootSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const id = window.setInterval(() => {
      setPhase((p) => (p === "in" ? "out" : "in"));
    }, 4000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const sync = () =>
      setRootSize({ w: el.clientWidth, h: el.clientHeight });
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={rootRef}
      className="relative flex h-full min-h-[calc(100dvh-8.5rem)] w-full flex-1 flex-col overflow-hidden bg-[#FAF8F5]"
    >
      <div className="relative px-6 pt-10 text-center sm:pt-12">
        <BreathCopy
          phase={phase}
          headlineClass="text-[#1E1B31]"
          subClass="text-[#6B7280]"
        />
      </div>

      <motion.div
        className="pointer-events-none absolute bottom-0 left-1/2 z-[1] overflow-hidden -translate-x-1/2"
        style={{
          width: "190vw",
          maxWidth: "none",
          backgroundColor: ARC,
          borderTopLeftRadius: "50% 100%",
          borderTopRightRadius: "50% 100%",
        }}
        animate={{ height: ["34vh", "68vh", "68vh", "34vh"] }}
        transition={BREATH}
        aria-hidden
      >
        <div
          className="absolute left-1/2 px-6 pt-10 text-center sm:pt-12"
          style={{
            bottom: 0,
            width: rootSize.w || "100vw",
            height: rootSize.h || PAGE_H,
            transform: "translateX(-50%)",
          }}
        >
          <BreathCopy
            phase={phase}
            headlineClass="text-[#FAF8F5]"
            subClass="text-[#FAF8F5]/75"
          />
        </div>
      </motion.div>

      <motion.div
        className="pointer-events-none absolute left-1/2 z-[2] -translate-x-1/2"
        animate={{
          bottom: ["calc(34vh - 4.25rem)", "calc(68vh - 5rem)", "calc(68vh - 5rem)", "calc(34vh - 4.25rem)"],
          scale: [0.78, 1.12, 1.12, 0.78],
        }}
        transition={BREATH}
        aria-hidden
      >
        <svg width="112" height="88" viewBox="0 0 112 88" fill="none">
          <path
            d="M22 34 Q36 46 50 34"
            stroke={FACE}
            strokeWidth="4.5"
            strokeLinecap="round"
          />
          <path
            d="M62 34 Q76 46 90 34"
            stroke={FACE}
            strokeWidth="4.5"
            strokeLinecap="round"
          />
          <motion.path
            stroke={FACE}
            strokeWidth="4.5"
            strokeLinecap="round"
            fill="none"
            animate={{
              d: [
                "M40 58 Q56 62 72 58",
                "M28 54 Q56 78 84 54",
                "M28 54 Q56 78 84 54",
                "M40 58 Q56 62 72 58",
              ],
            }}
            transition={BREATH}
          />
        </svg>
      </motion.div>
    </div>
  );
}
