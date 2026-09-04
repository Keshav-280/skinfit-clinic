import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { DoctorSimpleNav } from "@/components/doctor/DoctorSimpleNav";
import { ClinicRequestAlertController } from "@/components/doctor/ClinicRequestAlertController";
import { DoctorLogoutButton } from "@/components/doctor/DoctorLogoutButton";
import {
  doctorGlassHeaderClass,
  doctorPortalShellClass,
} from "@/src/lib/doctorPortalTheme";
import { getDoctorPortalUserId } from "@/src/lib/auth/doctor-access";
import { sanitizeClinicPortalNext } from "@/src/lib/auth/clinic-portal-next";

export const metadata: Metadata = {
  title: {
    default: "Clinic Portal | SkinFit Wellness",
    template: "%s | SkinFit Wellness",
  },
  description:
    "Minimal SkinFit clinic portal — appointment requests, patients, chat, and reports.",
  robots: { index: false, follow: false },
};

export default async function ClinicPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const id = await getDoctorPortalUserId();
  if (!id) {
    const headersList = await headers();
    const pathname = headersList.get("x-pathname") ?? "/clinic/requests";
    const next = encodeURIComponent(sanitizeClinicPortalNext(pathname));
    redirect(`/clinic/login?next=${next}`);
  }

  return (
    <div data-clinic-portal className={doctorPortalShellClass}>
      <header
        className={`sticky top-0 z-40 flex w-full items-center gap-3 px-3 py-2 sm:px-6 ${doctorGlassHeaderClass}`}
      >
        <Link
          href="/clinic/requests"
          className="inline-flex shrink-0 items-center"
          aria-label="SkinFit Wellness clinic portal"
        >
          <Image
            src="/branding/skinfit-wellness-logo.svg"
            alt="SkinFit Wellness"
            width={560}
            height={135}
            priority
            className="h-6 w-auto max-w-[6rem] object-contain object-left sm:h-8 sm:max-w-[11rem]"
          />
        </Link>
        <DoctorSimpleNav />
        <div className="ml-auto flex items-center gap-1">
          <ClinicRequestAlertController
            inboxHref="/clinic/requests"
            compact
          />
          <DoctorLogoutButton compact loginHref="/clinic/login" />
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-10 pt-6 sm:px-6">
        {children}
      </main>
    </div>
  );
}
