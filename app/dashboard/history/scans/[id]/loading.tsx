"use client";

import { motion } from "framer-motion";

const NAVY = "#1E1B31";

export default function ScanReportLoading() {
  return (
    <div className="relative min-h-[80vh] overflow-hidden px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(1100px 520px at 50% -10%, rgba(30, 27, 49,0.10), transparent 60%), linear-gradient(180deg, #FAF8F5 0%, #F0EAE2 60%, #DCCFC0 100%)",
        }}
      />

      <div className="mx-auto flex w-full max-w-[420px] flex-col items-center">
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full overflow-hidden rounded-[28px] border border-white/70 bg-white/65 p-7 shadow-[0_28px_70px_-32px_rgba(15,23,42,0.35)] backdrop-blur-xl"
        >
          <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent" />

          <h1 className="text-center text-[22px] font-bold tracking-tight" style={{ color: NAVY }}>
            Preparing your report
          </h1>
          <p className="mt-2 text-center text-[13.5px] leading-relaxed text-zinc-600">
            kAI is laying out your scan details and images.
          </p>

          <div className="mt-7 space-y-3.5">
            <SkeletonRow w="65%" />
            <SkeletonRow w="92%" />
            <SkeletonRow w="78%" />
          </div>

          <div className="mt-7 grid grid-cols-3 gap-2.5">
            <SkeletonChip />
            <SkeletonChip />
            <SkeletonChip />
          </div>

          <div className="mt-7 h-2 w-full overflow-hidden rounded-full bg-zinc-200/70">
            <motion.div
              initial={{ x: "-40%" }}
              animate={{ x: "120%" }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
              className="h-full w-2/5 rounded-full"
              style={{
                background:
                  "linear-gradient(90deg, rgba(30, 27, 49,0.25) 0%, #1E1B31 50%, rgba(30, 27, 49,0.25) 100%)",
              }}
            />
          </div>

          <p className="mt-5 flex items-center justify-center gap-1.5 text-[11.5px] font-medium text-zinc-500">
            <span
              className="inline-block h-1.5 w-1.5 animate-pulse rounded-full"
              style={{ background: NAVY }}
            />
            This usually takes only a few seconds
          </p>
        </motion.div>
      </div>
    </div>
  );
}

function SkeletonRow({ w }: { w: string }) {
  return (
    <div className="relative h-3 overflow-hidden rounded-full bg-zinc-200/60">
      <motion.div
        animate={{ x: ["-100%", "100%"] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        className="absolute inset-y-0 w-1/2"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.85) 50%, transparent 100%)",
        }}
      />
      <div className="h-full rounded-full bg-zinc-300/40" style={{ width: w }} />
    </div>
  );
}

function SkeletonChip() {
  return (
    <div className="relative h-16 overflow-hidden rounded-xl bg-zinc-200/55">
      <motion.div
        animate={{ x: ["-100%", "100%"] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        className="absolute inset-y-0 w-1/2"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.8) 50%, transparent 100%)",
        }}
      />
    </div>
  );
}
