"use client";

import { motion } from "framer-motion";
import { Bell } from "lucide-react";
import Link from "next/link";
import { WhyWeNeedScanPhotosCard } from "@/components/dashboard/WhyWeNeedScanPhotosCard";
import { SKINFIT_THEME } from "@/src/lib/skinfitTheme";

const NAVY = SKINFIT_THEME.navy;

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
      className="mx-auto w-full max-w-4xl"
    >
      <WhyWeNeedScanPhotosCard
        footer={
          <div className="text-center">
            <div
              className="mx-auto flex h-12 w-12 items-center justify-center rounded-full"
              style={{ backgroundColor: "rgba(30, 27, 49, 0.12)" }}
            >
              <Bell className="h-6 w-6" style={{ color: NAVY }} aria-hidden />
            </div>
            <h3 className="mt-3 text-lg font-bold text-[#1E1B31]">You&apos;re all set</h3>
            <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-[#4B5563]">
              {deliveryMessage}
            </p>
            <div className="mx-auto mt-5 w-full max-w-[240px]">
              {isOnboarding ? (
                <div className="flex flex-col gap-2.5">
                  <Link
                    href="/onboarding/baseline-report"
                    onClick={onDone}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[#1E1B31] px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#5B66A1]"
                  >
                    Continue
                  </Link>
                  <Link
                    href="/dashboard"
                    onClick={onDone}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[#1E1B31]/25 bg-white px-4 text-sm font-semibold text-[#1E1B31] transition-colors hover:bg-[#f8fafc]"
                  >
                    Go to dashboard
                  </Link>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <Link
                    href="/dashboard/history"
                    onClick={onDone}
                    className="text-sm font-semibold text-[#1E1B31] underline-offset-4 transition hover:underline"
                  >
                    View scan history
                  </Link>
                  <Link
                    href="/dashboard"
                    onClick={onDone}
                    className="block w-full rounded-xl bg-[#1E1B31] py-3 text-sm font-semibold text-white shadow-md transition-colors hover:bg-[#5B66A1]"
                  >
                    Back to dashboard
                  </Link>
                </div>
              )}
            </div>
          </div>
        }
      />
    </motion.div>
  );
}
