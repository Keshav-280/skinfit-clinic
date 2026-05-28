"use client";

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
      <nav
        className={`flex flex-1 flex-col gap-0.5 pt-2 ${collapsed ? "px-2" : "px-3"}`}
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
