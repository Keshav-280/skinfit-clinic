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
    <div className="min-h-screen bg-[#F2F9F2]">
      <nav className="sticky top-0 z-50 border-b border-[#E5E7EB] bg-white shadow-[0_2px_16px_rgba(45,62,107,0.06)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 py-3 sm:gap-3 sm:px-6 md:px-8 sm:py-4">
          <PatientPortalBrandLogo />

          <DashboardNav />

          <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
            <GlobalRefreshButton compact />
            <DashboardClinicSupportBell />
            <Link
              href="/dashboard/profile"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E5E7EB] bg-[#F2F9F2] text-[#2D3E6B] transition-colors hover:bg-white"
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
