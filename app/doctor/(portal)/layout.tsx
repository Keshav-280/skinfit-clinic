import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { UserRound, Users } from "lucide-react";
import { DoctorLogoutButton } from "@/components/doctor/DoctorLogoutButton";
import { DoctorAppointmentsBell } from "@/components/doctor/DoctorAppointmentsBell";
import { DoctorPatientChatBell } from "@/components/doctor/DoctorPatientChatBell";
import { DoctorSosBell } from "@/components/doctor/DoctorSosBell";
import { DoctorPortalBrandLogo } from "@/components/doctor/DoctorPortalBrandLogo";
import { DoctorPortalSidebar } from "@/components/doctor/DoctorPortalSidebar";
import {
  doctorGlassHeaderClass,
  doctorPortalShellClass,
} from "@/src/lib/doctorPortalTheme";
import { GlobalRefreshButton } from "@/components/ui/GlobalRefreshButton";
import { getDoctorPortalUserId } from "@/src/lib/auth/doctor-access";

export const metadata: Metadata = {
  title: {
    default: "Doctor Portal | SkinFit Clinic",
    template: "%s | SkinFit Clinic",
  },
  description:
    "SkinFit Clinic staff portal for dermatologists — manage patients, treatment plans, scans, and secure messaging.",
  robots: { index: false, follow: false },
};

export default async function DoctorPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const id = await getDoctorPortalUserId();
  if (!id) {
    redirect("/doctor/login");
  }

  return (
    <div
      data-doctor-portal
      className={`flex ${doctorPortalShellClass}`}
    >
      <DoctorPortalSidebar />

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header
          className={`sticky top-0 z-20 flex items-center gap-2 px-3 py-1 sm:gap-3 sm:px-5 sm:py-1.5 ${doctorGlassHeaderClass}`}
        >
          <DoctorPortalBrandLogo />

          <nav
            className="flex items-center gap-1 md:hidden"
            aria-label="Mobile navigation"
          >
            <Link
              href="/doctor/patients"
              className="rounded-lg p-2.5 text-slate-600 hover:bg-slate-100"
              aria-label="Patients"
            >
              <Users className="h-4 w-4" />
            </Link>
            <Link
              href="/doctor/profile"
              className="rounded-lg p-2.5 text-slate-600 hover:bg-slate-100"
              aria-label="Profile"
            >
              <UserRound className="h-4 w-4" />
            </Link>
          </nav>

          <div className="flex-1" />

          <div className="flex shrink-0 items-center gap-1">
            <DoctorAppointmentsBell />
            <DoctorPatientChatBell />
            <DoctorSosBell />
            <GlobalRefreshButton compact />
            <div className="md:hidden">
              <DoctorLogoutButton />
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-6 pt-4 sm:px-6 sm:pb-8 sm:pt-5">
          {children}
        </main>
      </div>
    </div>
  );
}
