"use client";

import { Stethoscope } from "lucide-react";
import { DoctorLogoutButton } from "@/components/doctor/DoctorLogoutButton";
import { DoctorPortalNav } from "@/components/doctor/DoctorPortalNav";
import { doctorGlassSidebarClass } from "@/components/doctor/DoctorUiPrimitives";

/** Sidebar is fixed collapsed (icon rail only). */
export function DoctorPortalSidebar() {
  const collapsed = true;

  return (
    <aside
      className={`sticky top-0 hidden h-screen w-[4.5rem] flex-shrink-0 flex-col md:flex ${doctorGlassSidebarClass}`}
      aria-label="Doctor portal navigation"
    >
      <div
        className={`flex items-center border-b border-white/30 py-3 ${
          collapsed ? "justify-center px-2" : "gap-2.5 px-4"
        }`}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#2C3E6B] shadow-sm shadow-[#2C3E6B]/15">
          <Stethoscope className="h-4 w-4 text-white" aria-hidden />
        </div>
      </div>

      <nav
        className={`mt-2 flex flex-1 flex-col gap-0.5 ${collapsed ? "px-2" : "px-3"}`}
        aria-label="Primary"
      >
        <DoctorPortalNav collapsed={collapsed} />
      </nav>

      <div
        className={`border-t border-white/30 py-3 ${collapsed ? "px-2" : "px-3"}`}
      >
        <DoctorLogoutButton collapsed={collapsed} />
      </div>
    </aside>
  );
}
