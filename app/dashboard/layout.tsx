import React from "react";
import Link from "next/link";
import { after } from "next/server";
import { User } from "lucide-react";
import { PatientPortalBrandLogo } from "@/components/dashboard/PatientPortalBrandLogo";
import { DashboardNav } from "./dashboard-nav";
import { LogoutButton } from "./logout-button";
import { DashboardClinicSupportBell } from "@/components/dashboard/DashboardClinicSupportBell";
import { DashboardInboxProvider } from "@/components/dashboard/DashboardInboxContext";
import { ScanJobReadyNotifier } from "@/components/dashboard/ScanJobReadyNotifier";
import { GlobalRefreshButton } from "@/components/ui/GlobalRefreshButton";
import { getSessionUserId } from "@/src/lib/auth/get-session";
import { markPastAppointmentsCompleted } from "@/src/lib/markPastAppointmentsCompleted";
import { runAppointmentReminders } from "@/src/lib/runAppointmentReminders";
import { runRoutineReminders } from "@/src/lib/runRoutineReminders";
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
          runRoutineReminders(),
        ]);
      } catch (e) {
        console.error("dashboard reminder sync", e);
      }
    });
  }

  return (
    <DashboardInboxProvider>
    <div className="min-h-screen bg-gradient-to-b from-[#D6E4D0] via-[#E0EADA] to-[#EAF0E6]">
      {/* Glass Navbar */}
      <nav className="sticky top-0 z-50 border-b border-white/25 bg-white/30 shadow-[0_4px_30px_rgba(0,0,0,0.04)] backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 py-3 sm:gap-3 sm:px-6 md:px-8 sm:py-4">
          <PatientPortalBrandLogo />

          <DashboardNav />

          <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
            <GlobalRefreshButton compact />
            <DashboardClinicSupportBell />
            <Link
              href="/dashboard/profile"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/60 bg-white/50 text-[#2C3E6B] backdrop-blur-sm transition-colors hover:bg-white/80"
              title="Profile"
            >
              <User className="h-4 w-4" />
            </Link>
            <LogoutButton />
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-6 pb-12 md:px-8">
        {children}
      </main>
      <ScanJobReadyNotifier />
    </div>
    </DashboardInboxProvider>
  );
}
