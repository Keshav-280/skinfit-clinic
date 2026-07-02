import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { DoctorAppointmentsBell } from "@/components/doctor/DoctorAppointmentsBell";
import { DoctorPatientChatBell } from "@/components/doctor/DoctorPatientChatBell";
import { DoctorScanBell } from "@/components/doctor/DoctorScanBell";
import { DoctorSosBell } from "@/components/doctor/DoctorSosBell";
import { DoctorPortalBrandLogo } from "@/components/doctor/DoctorPortalBrandLogo";
import { DoctorPortalSidebar } from "@/components/doctor/DoctorPortalSidebar";
import {
  doctorGlassHeaderClass,
  doctorPortalShellClass,
} from "@/src/lib/doctorPortalTheme";
import { GlobalRefreshButton } from "@/components/ui/GlobalRefreshButton";
import { getDoctorPortalUserId } from "@/src/lib/auth/doctor-access";
import {
  sanitizeDoctorPortalNext,
} from "@/src/lib/auth/doctor-portal-next";

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
    const headersList = await headers();
    const pathname = headersList.get("x-pathname") ?? "/doctor/patients";
    const next = encodeURIComponent(sanitizeDoctorPortalNext(pathname));
    redirect(`/doctor/login?next=${next}`);
  }

  return (
    <div
      data-doctor-portal
      className={`flex min-w-0 overflow-x-hidden ${doctorPortalShellClass}`}
    >
      <DoctorPortalSidebar />

      <div className="flex min-h-screen min-w-0 flex-1 flex-col overflow-x-hidden">
        <header
          className={`sticky top-0 z-40 flex w-full min-w-0 items-center gap-1 overflow-visible px-2 py-1 sm:gap-2 sm:px-4 sm:py-1.5 ${doctorGlassHeaderClass}`}
        >
          <DoctorPortalBrandLogo className="min-w-0" />

          <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1">
            <DoctorAppointmentsBell />
            <DoctorScanBell />
            <DoctorPatientChatBell />
            <DoctorSosBell />
            <GlobalRefreshButton compact />
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-3 pb-6 pt-4 sm:px-6 sm:pb-8 sm:pt-5">
          {children}
        </main>
      </div>
    </div>
  );
}
