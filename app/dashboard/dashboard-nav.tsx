"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/history", label: "Treatment History" },
  { href: "/dashboard/scan", label: "AI Scan" },
  { href: "/dashboard/schedules", label: "Schedules" },
  { href: "/dashboard/wellness", label: "Overall Wellness" },
  { href: "/dashboard/chat", label: "Chat With Us" },
] as const;

function isActive(href: string, pathname: string | null): boolean {
  if (!pathname) return false;
  if (href === "/dashboard") {
    const isRoot =
      pathname === "/dashboard" || pathname === "/dashboard/";
    if (!isRoot) return false;
    return true;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <div className="hidden items-center gap-1 md:flex">
      {links.map(({ href, label }) => {
        const active = isActive(href, pathname);
        return (
          <Link
            key={href}
            href={href}
            className={clsx(
              "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-[#E0F0ED] text-teal-700"
                : "text-slate-600 hover:bg-slate-100 hover:text-teal-600"
            )}
            aria-current={active ? "page" : undefined}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
