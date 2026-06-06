"use client";

import { motion } from "framer-motion";

const NAVY = "#2C3E6B";

export default function VisitDetailLoading() {
  return (
    <div className="relative flex min-h-[62vh] items-center justify-center overflow-hidden px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(1100px 520px at 50% -10%, rgba(44,62,107,0.10), transparent 60%), linear-gradient(180deg, #F4F7F1 0%, #E8EFE6 60%, #DCE8D4 100%)",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md rounded-[28px] border border-white/70 bg-white/80 p-7 shadow-[0_28px_70px_-32px_rgba(15,23,42,0.35)] backdrop-blur-xl"
      >
        <p className="text-center text-xl font-bold tracking-tight" style={{ color: NAVY }}>
          Loading visit details
        </p>
        <p className="mt-2 text-center text-sm leading-relaxed text-zinc-600">
          Fetching clinic notes and attachments.
        </p>

        <div className="mt-7 h-2 w-full overflow-hidden rounded-full bg-[#2C3E6B]/10">
          <motion.div
            initial={{ x: "-40%" }}
            animate={{ x: "120%" }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
            className="h-full w-2/5 rounded-full"
            style={{
              background:
                "linear-gradient(90deg, rgba(44,62,107,0.25) 0%, #2C3E6B 50%, rgba(44,62,107,0.25) 100%)",
            }}
          />
        </div>
      </motion.div>
    </div>
  );
}
