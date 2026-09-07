import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { DoctorLogoutButton } from "@/components/doctor/DoctorLogoutButton";
import {
  doctorGlassHeaderClass,
  doctorPortalShellClass,
} from "@/src/lib/doctorPortalTheme";
import { getDoctorPortalUserId } from "@/src/lib/auth/doctor-access";
import { sanitizeOpsPortalNext } from "@/src/lib/auth/ops-portal-next";

export const metadata: Metadata = {
  title: {
    default: "Ops Portal | SkinFit Wellness",
    template: "%s | SkinFit Wellness",
  },
  description:
    "Website signups, logins, scans, and questionnaire completion.",
  robots: { index: false, follow: false },
};

export default async function OpsPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const id = await getDoctorPortalUserId();
  if (!id) {
    const headersList = await headers();
    const pathname = headersList.get("x-pathname") ?? "/ops/overview";
    const next = encodeURIComponent(sanitizeOpsPortalNext(pathname));
    redirect(`/ops/login?next=${next}`);
  }

  return (
    <div data-ops-portal className={doctorPortalShellClass}>
      <header
        className={`sticky top-0 z-40 flex w-full items-center gap-3 px-3 py-2 sm:px-6 ${doctorGlassHeaderClass}`}
      >
        <Link
          href="/ops/overview"
          className="inline-flex shrink-0 items-center"
          aria-label="SkinFit Wellness ops portal"
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
        <p className="text-sm font-semibold text-[#1E1B31]/70">Ops</p>
        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/clinic/requests"
            className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-[#1E1B31]/70 hover:bg-[#1E1B31]/8 sm:inline-flex"
          >
            Clinic
          </Link>
          <DoctorLogoutButton compact loginHref="/ops/login" />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-10 pt-6 sm:px-6">
        {children}
      </main>
    </div>
  );
}
