"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

const INK = "#1E1B31";
const FACE = "#FAF8F5";

const BREATH = {
  duration: 8,
  repeat: Infinity,
  ease: [0.42, 0, 0.58, 1] as const,
  times: [0, 0.42, 0.52, 1],
};

export function ScanAnalysingBreath() {
  const [phase, setPhase] = useState<"in" | "out">("in");

  useEffect(() => {
    const id = window.setInterval(() => {
      setPhase((p) => (p === "in" ? "out" : "in"));
    }, 4000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="relative flex min-h-[calc(100dvh-8.5rem)] w-full flex-1 flex-col overflow-hidden bg-[#FAF8F5]">
      <div className="relative z-10 px-6 pt-10 text-center sm:pt-12">
        <motion.p
          key={phase}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="font-headline text-[1.75rem] font-bold tracking-tight text-[#1E1B31] sm:text-3xl"
        >
          {phase === "in" ? "Breathe in" : "Breathe out"}
        </motion.p>
        <p className="mt-2 text-sm text-[#6B7280] sm:text-base">
          kAI is analysing your skin. This takes about 20 seconds.
        </p>
      </div>

      <motion.div
        className="pointer-events-none absolute bottom-0 left-1/2 z-0 -translate-x-1/2"
        style={{
          width: "190vw",
          maxWidth: "none",
          backgroundColor: INK,
          borderTopLeftRadius: "50% 100%",
          borderTopRightRadius: "50% 100%",
        }}
        animate={{ height: ["34vh", "68vh", "68vh", "34vh"] }}
        transition={BREATH}
        aria-hidden
      />

      <motion.div
        className="pointer-events-none absolute left-1/2 z-10 -translate-x-1/2"
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
