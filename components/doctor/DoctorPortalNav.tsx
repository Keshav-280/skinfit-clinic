"use client";

import { CreditCard, FileText, UserRound, Users } from "lucide-react";
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
        href="/doctor/skinfit-report-generator"
        label="Report generator"
        icon={FileText}
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
