"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";

export function DoctorNavLink({
  href,
  label,
  icon: Icon,
  collapsed = false,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  collapsed?: boolean;
}) {
  const pathname = usePathname();
  const active =
    href === "/doctor/patients"
      ? pathname === href || pathname.startsWith("/doctor/patients/")
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? label : undefined}
      className={`group flex items-center rounded-xl text-[13px] font-semibold transition ${
        collapsed ? "justify-center px-0 py-2.5" : "gap-2.5 px-3 py-2.5"
      } ${
        active
          ? "bg-[#2C3E6B]/10 text-[#2C3E6B]"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      }`}
    >
      <Icon
        className={`h-[18px] w-[18px] shrink-0 ${
          active ? "text-[#2C3E6B]" : "text-slate-400 group-hover:text-[#2C3E6B]"
        }`}
        aria-hidden
      />
      {collapsed ? (
        <span className="sr-only">{label}</span>
      ) : (
        <span>{label}</span>
      )}
    </Link>
  );
}
