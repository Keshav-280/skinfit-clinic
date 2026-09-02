import React from "react";
import { after } from "next/server";
import { PatientPortalBrandLogo } from "@/components/dashboard/PatientPortalBrandLogo";
import { DashboardNav } from "./dashboard-nav";
import { DashboardClinicSupportBell } from "@/components/dashboard/DashboardClinicSupportBell";
import { DashboardInboxProvider } from "@/components/dashboard/DashboardInboxContext";
import { ScanJobReadyNotifier } from "@/components/dashboard/ScanJobReadyNotifier";
import { ProfileNavBadge } from "@/components/dashboard/ProfileNavBadge";
import { AddToHomeScreenPrompt } from "@/components/dashboard/AddToHomeScreenPrompt";
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
    <div className="min-h-screen bg-[#FAF8F5]">
      <nav className="sticky top-0 z-50 border-b border-[#E5E7EB] bg-white/80 shadow-[0_2px_16px_rgba(30, 27, 49,0.06)] backdrop-blur-md pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 py-3 sm:gap-3 sm:px-6 md:px-8 sm:py-4">
          <PatientPortalBrandLogo />

          <DashboardNav />

          <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
            <DashboardClinicSupportBell />
            <ProfileNavBadge />
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-6 pb-24 md:pb-12 md:px-8">
        <AddToHomeScreenPrompt />
        {children}
      </main>
      <ScanJobReadyNotifier />
    </div>
    </DashboardInboxProvider>
  );
}
