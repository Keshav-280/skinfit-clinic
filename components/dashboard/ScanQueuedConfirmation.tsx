"use client";

import { motion } from "framer-motion";
import { Bell, Sparkles } from "lucide-react";
import Link from "next/link";

type ScanQueuedConfirmationProps = {
  variant?: "dashboard" | "onboarding";
  onDone?: () => void;
};

export function ScanQueuedConfirmation({
  variant = "dashboard",
  onDone,
}: ScanQueuedConfirmationProps) {
  const isOnboarding = variant === "onboarding";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-md space-y-6 rounded-[22px] border border-white/70 bg-white/50 p-8 text-center shadow-sm backdrop-blur-sm"
    >
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#2C3E6B]/10">
        <Bell className="h-8 w-8 text-[#2C3E6B]" aria-hidden />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-bold text-[#2C3E6B]">You&apos;re all set</h2>
        <p className="text-sm leading-relaxed text-[#4B5563]">
          {isOnboarding
            ? "Your kAI report will be ready soon — we'll notify you when it's done."
            : "Your report will be delivered soon — we'll notify you when it's ready."}
        </p>
      </div>
      <p className="flex items-center justify-center gap-1.5 text-xs font-medium text-[#6B7280]">
        <Sparkles className="h-3.5 w-3.5 text-[#2C3E6B]" aria-hidden />
        You can leave this screen — no need to wait here.
      </p>
      <div className="flex flex-col gap-3 pt-2">
        {isOnboarding ? (
          <>
            <Link
              href="/onboarding/baseline-report"
              onClick={onDone}
              className="rounded-xl bg-[#2C3E6B] py-3.5 text-sm font-semibold text-white shadow-md transition-colors hover:bg-[#3d5080]"
            >
              Continue
            </Link>
            <Link
              href="/dashboard"
              onClick={onDone}
              className="rounded-xl border border-[#2C3E6B]/20 bg-white/80 py-3.5 text-sm font-semibold text-[#2C3E6B] transition-colors hover:bg-white"
            >
              Go to dashboard
            </Link>
          </>
        ) : (
          <>
            <Link
              href="/dashboard/history"
              onClick={onDone}
              className="rounded-xl bg-[#2C3E6B] py-3.5 text-sm font-semibold text-white shadow-md transition-colors hover:bg-[#3d5080]"
            >
              View scan history
            </Link>
            <Link
              href="/dashboard"
              onClick={onDone}
              className="rounded-xl border border-[#2C3E6B]/20 bg-white/80 py-3.5 text-sm font-semibold text-[#2C3E6B] transition-colors hover:bg-white"
            >
              Back to dashboard
            </Link>
          </>
        )}
      </div>
    </motion.div>
  );
}
