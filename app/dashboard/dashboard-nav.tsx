"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Bell, Camera, Home, Heart, MessageCircle, User, X } from "lucide-react";
import clsx from "clsx";
import { GLOBAL_LIVE_REFRESH_EVENT } from "@/src/lib/globalRefreshEvents";
import { SCHEDULE_BELL_REFRESH_EVENT } from "@/src/lib/scheduleBellEvents";

const links = [
  { href: "/dashboard/scan", label: "Diagnose", Icon: Camera },
  { href: "/dashboard", label: "Build", Icon: Home },
  { href: "/dashboard/schedules", label: "Maintain", Icon: Heart },
  { href: "/dashboard/chat?assistant=support", label: "Chat", Icon: MessageCircle },
] as const;

function isActive(href: string, pathname: string | null): boolean {
  if (!pathname) return false;
  const path = href.split("?")[0] ?? href;
  if (path === "/dashboard") {
    return pathname === "/dashboard" || pathname === "/dashboard/";
  }
  if (path === "/dashboard/scan") {
    return (
      pathname === "/dashboard/scan" ||
      pathname.startsWith("/dashboard/history") ||
      pathname.startsWith("/dashboard/scans")
    );
  }
  if (path === "/dashboard/schedules") {
    return (
      pathname === "/dashboard/schedules" ||
      pathname.startsWith("/dashboard/schedules/") ||
      pathname.startsWith("/dashboard/maintain")
    );
  }
  return pathname === path || pathname.startsWith(`${path}/`);
}

const linkBase =
  "rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2C3E6B]/30";

export function DashboardNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [scheduleBellCount, setScheduleBellCount] = useState(0);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  /** Mark schedule updates read after leaving Schedules. */
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
    <>
      {/* Desktop tab bar */}
      <nav
        className="hidden flex-wrap items-center justify-center gap-1 md:flex"
        aria-label="Dashboard"
      >
        {links.map(({ href, label, Icon }) => {
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
                  ? "bg-[#2C3E6B]/10 text-[#2C3E6B] font-semibold"
                  : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              {bell ? (
                <Bell className="h-3.5 w-3.5 shrink-0" aria-hidden />
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

      {/* Mobile bottom tab bar — portaled to body so it sits above all content */}
      {mounted
        ? createPortal(
            <nav
              className="fixed bottom-0 left-0 right-0 z-[100] flex border-t border-[#E5E7EB] bg-white/90 pb-safe backdrop-blur-md md:hidden"
              aria-label="Dashboard"
              style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
            >
              {links.map(({ href, label, Icon }) => {
                const active = isActive(href, pathname);
                const schedules = href === "/dashboard/schedules";
                const bell = schedules && scheduleBellCount > 0;
                return (
                  <Link
                    key={href}
                    href={href}
                    className="relative flex flex-1 flex-col items-center gap-1 py-3 transition-opacity active:opacity-60"
                    aria-current={active ? "page" : undefined}
                  >
                    <span
                      className={clsx(
                        "flex h-8 w-10 items-center justify-center rounded-xl transition-colors",
                        active ? "bg-[#2C3E6B]/10" : ""
                      )}
                    >
                      <Icon
                        className={clsx(
                          "h-5 w-5 shrink-0 transition-colors",
                          active ? "text-[#2C3E6B]" : "text-[#9CA3AF]"
                        )}
                        aria-hidden
                      />
                    </span>
                    <span
                      className={clsx(
                        "text-[10px] font-medium leading-none",
                        active ? "text-[#2C3E6B] font-semibold" : "text-[#9CA3AF]"
                      )}
                    >
                      {label}
                    </span>
                    {bell ? (
                      <span className="absolute right-[calc(50%-18px)] top-2 flex h-4 w-4 items-center justify-center rounded-full bg-[#2C3E6B] text-[9px] font-bold text-white">
                        {scheduleBellCount > 9 ? "9+" : scheduleBellCount}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
              {/* Profile tab */}
              <Link
                href="/dashboard/profile"
                className="relative flex flex-1 flex-col items-center gap-1 py-3 transition-opacity active:opacity-60"
                aria-label="Profile"
              >
                <span
                  className={clsx(
                    "flex h-8 w-10 items-center justify-center rounded-xl transition-colors",
                    isActive("/dashboard/profile", pathname) ? "bg-[#2C3E6B]/10" : ""
                  )}
                >
                  <User
                    className={clsx(
                      "h-5 w-5 shrink-0 transition-colors",
                      isActive("/dashboard/profile", pathname) ? "text-[#2C3E6B]" : "text-[#9CA3AF]"
                    )}
                    aria-hidden
                  />
                </span>
                <span
                  className={clsx(
                    "text-[10px] font-medium leading-none",
                    isActive("/dashboard/profile", pathname) ? "text-[#2C3E6B] font-semibold" : "text-[#9CA3AF]"
                  )}
                >
                  Profile
                </span>
              </Link>
            </nav>,
            document.body
          )
        : null}
    </>
  );
}
