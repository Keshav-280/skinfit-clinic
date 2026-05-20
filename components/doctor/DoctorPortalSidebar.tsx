"use client";

import { useCallback, useEffect, useState } from "react";
import { PanelLeftClose, PanelLeftOpen, Stethoscope } from "lucide-react";
import { DoctorLogoutButton } from "@/components/doctor/DoctorLogoutButton";
import { DoctorPortalNav } from "@/components/doctor/DoctorPortalNav";
import { doctorGlassSidebarClass } from "@/components/doctor/DoctorUiPrimitives";

const STORAGE_KEY = "skinfit.doctorSidebarCollapsed";

export function DoctorPortalSidebar() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return (
    <aside
      className={`sticky top-0 hidden h-screen flex-shrink-0 flex-col transition-[width] duration-200 ease-out md:flex ${doctorGlassSidebarClass} ${
        collapsed ? "w-[4.5rem]" : "w-[240px]"
      }`}
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
        {!collapsed ? (
          <div className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-bold leading-tight text-slate-900">
              SkinFit Clinic
            </span>
            <span className="text-[11px] font-medium text-slate-500">Staff portal</span>
          </div>
        ) : null}
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

      <button
        type="button"
        onClick={toggle}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className={`mx-2 mb-3 flex items-center justify-center gap-2 rounded-xl border border-white/40 bg-white/30 py-2 text-slate-600 transition hover:bg-white/55 hover:text-[#2C3E6B] ${
          collapsed ? "px-0" : "px-3 text-xs font-semibold"
        }`}
      >
        {collapsed ? (
          <PanelLeftOpen className="h-4 w-4 shrink-0" aria-hidden />
        ) : (
          <>
            <PanelLeftClose className="h-4 w-4 shrink-0" aria-hidden />
            <span>Collapse</span>
          </>
        )}
      </button>
    </aside>
  );
}
