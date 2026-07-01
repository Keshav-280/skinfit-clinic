"use client";

import { CreditCard, FileStack, UserRound, Users } from "lucide-react";
import { DoctorNavLink } from "@/components/doctor/DoctorNavLink";

/** Sidebar nav — client-only so Lucide icons are not passed from a Server Component. */
export function DoctorPortalNav({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <>
      <DoctorNavLink
        href="/doctor/patients"
        label="Patients"
        icon={Users}
        collapsed={collapsed}
      />
      <DoctorNavLink
        href="/doctor/clinic-wallet"
        label="Clinic wallet"
        icon={CreditCard}
        collapsed={collapsed}
      />
      <DoctorNavLink
        href="/doctor/clinic-reports"
        label="Clinic reports"
        icon={FileStack}
        collapsed={collapsed}
      />
      <DoctorNavLink
        href="/doctor/profile"
        label="Profile"
        icon={UserRound}
        collapsed={collapsed}
      />
    </>
  );
}
