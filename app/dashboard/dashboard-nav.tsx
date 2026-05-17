"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Bell, Menu, X } from "lucide-react";
import clsx from "clsx";
import { GLOBAL_LIVE_REFRESH_EVENT } from "@/src/lib/globalRefreshEvents";
import { SCHEDULE_BELL_REFRESH_EVENT } from "@/src/lib/scheduleBellEvents";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/scan", label: "AI Scan" },
  { href: "/dashboard/schedules", label: "Schedules" },
  { href: "/dashboard/chat?assistant=support", label: "Chat With Us" },
] as const;

function isActive(href: string, pathname: string | null): boolean {
  if (!pathname) return false;
  const path = href.split("?")[0] ?? href;
  if (path === "/dashboard") {
    const isRoot =
      pathname === "/dashboard" || pathname === "/dashboard/";
    if (!isRoot) return false;
    return true;
  }
  return pathname === path || pathname.startsWith(`${path}/`);
}

const linkBase =
  "rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2C3E6B]/30";

export function DashboardNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scheduleBellCount, setScheduleBellCount] = useState(0);

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

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch("/api/patient/schedule-bell", {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok || cancelled) return;
        const j = (await res.json()) as { count?: number };
        setScheduleBellCount(
          typeof j.count === "number" && j.count > 0 ? j.count : 0
        );
      } catch {
        /* ignore */
      }
    };
    void tick();
    const onBellRefresh = () => void tick();
    const onGlobalRefresh = () => void tick();
    const onFocus = () => void tick();
    const onVisible = () => {
      if (document.visibilityState === "visible") void tick();
    };
    window.addEventListener(SCHEDULE_BELL_REFRESH_EVENT, onBellRefresh);
    window.addEventListener(GLOBAL_LIVE_REFRESH_EVENT, onGlobalRefresh);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    const id = window.setInterval(() => void tick(), 15_000);
    return () => {
      cancelled = true;
      window.removeEventListener(SCHEDULE_BELL_REFRESH_EVENT, onBellRefresh);
      window.removeEventListener(GLOBAL_LIVE_REFRESH_EVENT, onGlobalRefresh);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(id);
    };
  }, [pathname]);

  /** Mark schedule updates read after leaving Schedules (not on entry — avoids hiding the bell before the patient sees it). */
  useEffect(() => {
    if (!pathname?.startsWith("/dashboard/schedules")) return;
    return () => {
      void fetch("/api/patient/schedule-crm-digest", {
        method: "POST",
        credentials: "include",
      }).catch(() => {});
    };
  }, [pathname]);

  return (
    <div className="flex min-w-0 flex-1 items-center justify-end md:justify-center">
      <nav
        className="hidden flex-wrap items-center justify-center gap-1 md:flex"
        aria-label="Dashboard"
      >
        {links.map(({ href, label }) => {
          const active = isActive(href, pathname);
          const schedules = href === "/dashboard/schedules";
          const bell = schedules && scheduleBellCount > 0;
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                linkBase,
                "inline-flex items-center gap-1.5 px-3 py-2 lg:px-4",
                active
                  ? "bg-white/40 text-[#2C3E6B] font-semibold backdrop-blur-sm"
                  : "text-[#2C3E6B]/70 hover:bg-white/40 hover:text-[#2C3E6B]"
              )}
              aria-current={active ? "page" : undefined}
            >
              {bell ? (
                <Bell
                  className="h-3.5 w-3.5 shrink-0 text-[#2C3E6B]"
                  aria-hidden
                />
              ) : null}
              <span>{label}</span>
              {bell ? (
                <span className="inline-flex min-h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-[#2C3E6B] px-1 text-[10px] font-bold leading-none text-white">
                  {scheduleBellCount > 9 ? "9+" : scheduleBellCount}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <button
        type="button"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[#2C3E6B] hover:bg-white/50 md:hidden"
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
            className="fixed inset-0 z-[100] bg-[#2C3E6B]/20 backdrop-blur-sm md:hidden"
            aria-hidden
            onClick={close}
          />
          <div
            id="dashboard-mobile-nav"
            className="fixed inset-y-0 right-0 z-[101] flex w-[min(20rem,calc(100vw-2.5rem))] max-w-full flex-col border-l border-white/30 bg-white/80 shadow-xl backdrop-blur-xl md:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Dashboard navigation"
          >
            <div className="flex items-center justify-between border-b border-white/40 px-4 py-3">
              <span className="font-bold text-[#2C3E6B]">Menu</span>
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-lg text-[#2C3E6B] hover:bg-white/50"
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
                const schedules = href === "/dashboard/schedules";
                const bell = schedules && scheduleBellCount > 0;
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={close}
                    className={clsx(
                      linkBase,
                      "inline-flex items-center gap-2 px-4 py-3.5",
                      active
                        ? "bg-white/40 text-[#2C3E6B] font-semibold"
                        : "text-[#2C3E6B]/70 hover:bg-white/40"
                    )}
                    aria-current={active ? "page" : undefined}
                  >
                    {bell ? (
                      <Bell className="h-4 w-4 shrink-0 text-[#2C3E6B]" aria-hidden />
                    ) : null}
                    <span className="flex-1">{label}</span>
                    {bell ? (
                      <span className="inline-flex min-h-[1.25rem] min-w-[1.25rem] items-center justify-center rounded-full bg-[#2C3E6B] px-1.5 text-[11px] font-bold text-white">
                        {scheduleBellCount > 9 ? "9+" : scheduleBellCount}
                      </span>
                    ) : null}
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
