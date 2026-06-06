"use client";

import { motion } from "framer-motion";
import { Bell, Sparkles } from "lucide-react";
import Link from "next/link";
import { WhyWeNeedScanPhotosCard } from "@/components/dashboard/WhyWeNeedScanPhotosCard";

type ScanQueuedConfirmationProps = {
  variant?: "dashboard" | "onboarding";
  onDone?: () => void;
};

export function ScanQueuedConfirmation({
  variant = "dashboard",
  onDone,
}: ScanQueuedConfirmationProps) {
  const isOnboarding = variant === "onboarding";

  const deliveryMessage = isOnboarding
    ? "Your kAI report will be ready soon — we'll notify you when it's done."
    : "Your report will be delivered soon — we'll notify you when it's ready.";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto w-full max-w-2xl"
    >
      <WhyWeNeedScanPhotosCard
        footer={
          <div className="text-center">
            <div
              className="mx-auto flex h-12 w-12 items-center justify-center rounded-full"
              style={{ backgroundColor: "rgba(224, 112, 136, 0.16)" }}
            >
              <Bell className="h-6 w-6" style={{ color: "#E07088" }} aria-hidden />
            </div>
            <h3 className="mt-3 text-lg font-bold text-[#2C3E6B]">You&apos;re all set</h3>
            <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-[#4B5563]">
              {deliveryMessage}
            </p>
            <p className="mt-2 flex items-center justify-center gap-1.5 text-xs font-medium text-[#6B7280]">
              <Sparkles className="h-3.5 w-3.5 text-[#2C3E6B]" aria-hidden />
              You can leave this screen — no need to wait here.
            </p>
            <div className="mx-auto mt-4 grid max-w-md grid-cols-2 gap-2.5">
              {isOnboarding ? (
                <>
                  <Link
                    href="/onboarding/baseline-report"
                    onClick={onDone}
                    className="rounded-xl bg-[#2C3E6B] py-3 text-sm font-semibold text-white shadow-md transition-colors hover:bg-[#3d5080]"
                  >
                    Continue
                  </Link>
                  <Link
                    href="/dashboard"
                    onClick={onDone}
                    className="rounded-xl border border-[#2C3E6B]/20 bg-white py-3 text-sm font-semibold text-[#2C3E6B] transition-colors hover:bg-white/90"
                  >
                    Go to dashboard
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/dashboard/history"
                    onClick={onDone}
                    className="rounded-xl bg-[#2C3E6B] py-3 text-sm font-semibold text-white shadow-md transition-colors hover:bg-[#3d5080]"
                  >
                    View scan history
                  </Link>
                  <Link
                    href="/dashboard"
                    onClick={onDone}
                    className="rounded-xl border border-[#2C3E6B]/20 bg-white py-3 text-sm font-semibold text-[#2C3E6B] transition-colors hover:bg-white/90"
                  >
                    Back to dashboard
                  </Link>
                </>
              )}
            </div>
          </div>
        }
      />
    </motion.div>
  );
}
