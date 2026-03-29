"use client";

import { motion } from "framer-motion";

export default function WellnessPage() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="flex min-h-[60vh] items-center justify-center"
    >
      <div className="w-full max-w-md rounded-[22px] border border-zinc-100 bg-white px-8 py-12 text-center shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="text-2xl font-bold tracking-tight text-teal-700 md:text-3xl"
        >
          Coming Soon
        </motion.p>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="mt-3 text-sm text-zinc-600"
        >
          Holistic health tracking is currently in development.
        </motion.p>
      </div>
    </motion.div>
  );
}
