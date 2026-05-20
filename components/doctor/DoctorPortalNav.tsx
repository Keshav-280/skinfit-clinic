"use client";

import { UserRound, Users } from "lucide-react";
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
        href="/doctor/profile"
        label="Profile"
        icon={UserRound}
        collapsed={collapsed}
      />
    </>
  );
}
