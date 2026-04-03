import React from "react";
import Link from "next/link";
import { after } from "next/server";
import { Sparkles, User } from "lucide-react";
import { DashboardNav } from "./dashboard-nav";
import { LogoutButton } from "./logout-button";
import { DashboardClinicSupportBell } from "@/components/dashboard/DashboardClinicSupportBell";
import { getSessionUserId } from "@/src/lib/auth/get-session";
import { markPastAppointmentsCompleted } from "@/src/lib/markPastAppointmentsCompleted";
import { runAppointmentReminders } from "@/src/lib/runAppointmentReminders";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const userId = await getSessionUserId();
  if (userId) {
    // Don’t block HTML: run after response (uses platform waitUntil on Vercel).
    after(async () => {
      try {
        await Promise.all([
          markPastAppointmentsCompleted(),
          runAppointmentReminders(),
        ]);
      } catch (e) {
        console.error("dashboard appointment sync", e);
      }
    });
  }

  return (
    <div className="min-h-screen bg-[#FDF9F0]">
      {/* Premium Top Navbar */}
      <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 py-3 sm:gap-3 sm:px-6 sm:py-4">
          <Link
            href="/dashboard"
            className="flex min-w-0 shrink-0 items-center gap-2"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-teal-600 text-white shadow-md">
              <Sparkles className="h-4 w-4" />
            </div>
            <span className="truncate text-base font-bold tracking-tight text-slate-800 sm:text-lg">
              SkinnFit
            </span>
          </Link>

          <DashboardNav />

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <DashboardClinicSupportBell />
            <Link
              href="/dashboard/profile"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-teal-50 text-teal-600 transition-colors hover:bg-teal-100"
              title="Profile"
            >
              <User className="h-4 w-4" />
            </Link>
            <LogoutButton />
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="mx-auto max-w-lg px-4 py-6 pb-12 sm:max-w-xl md:max-w-3xl">
        {children}
      </main>
    </div>
  );
}
