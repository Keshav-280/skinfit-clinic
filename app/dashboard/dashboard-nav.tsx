"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Bell, Loader2, Menu, X } from "lucide-react";
import clsx from "clsx";
import { GLOBAL_LIVE_REFRESH_EVENT } from "@/src/lib/globalRefreshEvents";
import { SCHEDULE_BELL_REFRESH_EVENT } from "@/src/lib/scheduleBellEvents";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/history", label: "Treatment History" },
  { href: "/dashboard/scan", label: "AI Scan" },
  { href: "/dashboard/schedules", label: "Schedules" },
  { href: "/dashboard/wellness", label: "Overall Wellness" },
  { href: "/dashboard/chat?assistant=support", label: "Chat With Us" },
  { href: "/dashboard/profile", label: "Profile" },
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
  "rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40";

export function DashboardNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sosBusy, setSosBusy] = useState(false);
  const [sosHint, setSosHint] = useState<string | null>(null);
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
    if (!sosHint) return;
    const t = window.setTimeout(() => setSosHint(null), 3200);
    return () => window.clearTimeout(t);
  }, [sosHint]);

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

  const triggerSos = useCallback(async () => {
    if (sosBusy) return;
    const detail = window.prompt(
      "SOS alert: describe symptoms briefly (redness, swelling, pain, etc).",
      ""
    );
    if (detail === null) return;
    const text = detail.trim()
      ? `SOS: ${detail.trim()}`
      : "SOS: Adverse reaction after treatment. Need urgent doctor help.";

    setSosHint(null);
    setSosBusy(true);
    try {
      const res = await fetch("/api/chat/plain/message", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assistantId: "doctor",
          isUrgent: true,
          text,
        }),
      });
      const j = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !j.success) {
        setSosHint(j.error ?? "Could not send SOS alert.");
        return;
      }
      setSosHint("SOS sent to doctor. Opened doctor chat.");
      setOpen(false);
      router.push("/dashboard/chat?assistant=doctor");
    } catch {
      setSosHint("Network error. Please try SOS again.");
    } finally {
      setSosBusy(false);
    }
  }, [router, sosBusy]);

  return (
    <div className="flex min-w-0 flex-1 items-center justify-end md:justify-center">
      <nav
        className="hidden flex-wrap items-center justify-center gap-1 md:flex"
        aria-label="Dashboard"
      >
        <button
          type="button"
          onClick={() => void triggerSos()}
          disabled={sosBusy}
          className="mr-1 inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60 lg:px-4"
          title="Urgent: notify doctor immediately"
        >
          {sosBusy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <AlertTriangle className="h-4 w-4" />
          )}
          Urgent
        </button>
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
                  ? "bg-[#E0F0ED] text-teal-700"
                  : "text-slate-600 hover:bg-slate-100 hover:text-teal-600"
              )}
              aria-current={active ? "page" : undefined}
            >
              {bell ? (
                <Bell
                  className="h-3.5 w-3.5 shrink-0 text-teal-700"
                  aria-hidden
                />
              ) : null}
              <span>{label}</span>
              {bell ? (
                <span className="inline-flex min-h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-teal-600 px-1 text-[10px] font-bold leading-none text-white">
                  {scheduleBellCount > 9 ? "9+" : scheduleBellCount}
                </span>
              ) : null}
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
              <button
                type="button"
                onClick={() => void triggerSos()}
                disabled={sosBusy}
                className="mb-2 inline-flex items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                title="Urgent: notify doctor immediately"
              >
                {sosBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <AlertTriangle className="h-4 w-4" />
                )}
                Urgent SOS
              </button>
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
                        ? "bg-[#E0F0ED] text-teal-800"
                        : "text-slate-700 hover:bg-slate-50"
                    )}
                    aria-current={active ? "page" : undefined}
                  >
                    {bell ? (
                      <Bell className="h-4 w-4 shrink-0 text-teal-800" aria-hidden />
                    ) : null}
                    <span className="flex-1">{label}</span>
                    {bell ? (
                      <span className="inline-flex min-h-[1.25rem] min-w-[1.25rem] items-center justify-center rounded-full bg-teal-600 px-1.5 text-[11px] font-bold text-white">
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
      {sosHint ? (
        <p className="fixed bottom-3 left-1/2 z-[110] -translate-x-1/2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm">
          {sosHint}
        </p>
      ) : null}
    </div>
  );
}
