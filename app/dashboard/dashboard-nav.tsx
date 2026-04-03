"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
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

const linkBase =
  "rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40";

export function DashboardNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    close();
  }, [pathname, close]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close]);

  return (
    <div className="flex min-w-0 flex-1 items-center justify-end md:justify-center">
      <nav
        className="hidden flex-wrap items-center justify-center gap-1 md:flex"
        aria-label="Dashboard"
      >
        {links.map(({ href, label }) => {
          const active = isActive(href, pathname);
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                linkBase,
                "px-3 py-2 lg:px-4",
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
      </nav>

      <button
        type="button"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 md:hidden"
        aria-expanded={open}
        aria-controls="dashboard-mobile-nav"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {open ? (
        <>
          <div
            className="fixed inset-0 z-[100] bg-slate-900/40 md:hidden"
            aria-hidden
            onClick={close}
          />
          <div
            id="dashboard-mobile-nav"
            className="fixed inset-y-0 right-0 z-[101] flex w-[min(20rem,calc(100vw-2.5rem))] max-w-full flex-col border-l border-slate-200 bg-white shadow-xl md:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Dashboard navigation"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <span className="font-semibold text-slate-900">Menu</span>
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
                aria-label="Close menu"
                onClick={close}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav
              className="flex flex-1 flex-col gap-1 overflow-y-auto p-3 pb-8"
              aria-label="Dashboard pages"
            >
              {links.map(({ href, label }) => {
                const active = isActive(href, pathname);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={close}
                    className={clsx(
                      linkBase,
                      "px-4 py-3.5",
                      active
                        ? "bg-[#E0F0ED] text-teal-800"
                        : "text-slate-700 hover:bg-slate-50"
                    )}
                    aria-current={active ? "page" : undefined}
                  >
                    {label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </>
      ) : null}
    </div>
  );
}
