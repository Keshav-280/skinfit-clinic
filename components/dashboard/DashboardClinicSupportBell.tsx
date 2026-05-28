"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useDashboardInbox } from "@/components/dashboard/DashboardInboxContext";

export function DashboardClinicSupportBell() {
  const { bellTotal: count, typesFull } = useDashboardInbox();

  const label =
    count >= 100
      ? `Many new alerts${typesFull ? ` — ${typesFull}` : ""}`
      : count > 0
        ? `${count} new${typesFull ? `: ${typesFull}` : ""}`
        : "Notifications — open to see chat, scan reports, and voice alerts";

  return (
    <Link
      href="/dashboard/notifications"
      className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/60 bg-white/50 text-[#2C3E6B]/70 backdrop-blur-sm transition-colors hover:bg-white/80 hover:text-[#2C3E6B]"
      title={label}
      aria-label={label}
    >
      <Bell className="h-4 w-4" />
      {count > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white">
          {count >= 100 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}
