import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DoctorLogoutButton } from "@/components/doctor/DoctorLogoutButton";
import { getDoctorPortalUserId } from "@/src/lib/auth/doctor-access";
import { doctorPortalShellClass } from "@/src/lib/doctorPortalTheme";

export const metadata: Metadata = {
  title: "Medixora reports | SkinFit Wellness",
  robots: { index: false, follow: false },
};

/** The clinic's upload portal: only the patient list, the scanner and the reports. */
export default async function MedixoraReportsLayout({ children }: { children: React.ReactNode }) {
  if (!(await getDoctorPortalUserId())) {
    redirect("/clinic/login?next=%2Fmedixora-reports");
  }
  return (
    <div data-clinic-portal className={doctorPortalShellClass}>
      <header className="sticky top-0 z-40 flex w-full items-center gap-4 bg-[#1E1B31] px-4 py-2.5 sm:px-6">
        <Link href="/medixora-reports" aria-label="SkinFit Wellness">
          <Image src="/branding/skinfit-wellness-logo.svg" alt="SkinFit Wellness" width={560} height={135} priority className="h-7 w-auto brightness-0 invert" />
        </Link>
        <span className="text-sm font-semibold text-[#AEB9E8]">Medixora reports</span>
        <div className="ml-auto flex items-center gap-3">
          <Link href="/clinic/requests" className="text-sm font-semibold text-[#AEB9E8] hover:text-white">
            Clinic portal
          </Link>
          <DoctorLogoutButton compact tone="dark" loginHref="/clinic/login?next=%2Fmedixora-reports" />
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl px-4 py-6">{children}</main>
    </div>
  );
}
