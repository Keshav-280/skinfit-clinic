"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellOff } from "lucide-react";
import { doctorHeaderBellBtnClass } from "@/components/doctor/DoctorUiPrimitives";
import {
  claimRequestAlert,
  dispatchClinicRequestInbox,
  readRequestAlertsEnabled,
  readSeenRequestIds,
  writeRequestAlertsEnabled,
  writeSeenRequestIds,
  type ClinicRequestAlertItem,
} from "@/src/lib/clinicRequestAlert";
import {
  playClinicRequestAlertSound,
  unlockClinicRequestAlertSound,
} from "@/src/lib/clinicRequestAlertSound";
import { dispatchGlobalLiveRefresh } from "@/src/lib/globalRefreshEvents";

type ToastItem = ClinicRequestAlertItem & { shownAt: number };

const POLL_MS = 10_000;

function notificationPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || typeof Notification === "undefined") {
    return "unsupported";
  }
  return Notification.permission;
}

export function ClinicRequestAlertController({
  inboxHref,
  compact = false,
}: {
  inboxHref: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(false);
  const [permission, setPermission] = useState<
    NotificationPermission | "unsupported"
  >("default");
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const hydratedRef = useRef(false);
  const seenRef = useRef<Set<string>>(new Set());
  const titleTimerRef = useRef<number | null>(null);
  const baseTitleRef = useRef<string | null>(null);

  useEffect(() => {
    setEnabled(readRequestAlertsEnabled());
    setPermission(notificationPermission());
    seenRef.current = readSeenRequestIds();
  }, []);

  const flashTitle = useCallback((label: string) => {
    if (typeof document === "undefined") return;
    if (!baseTitleRef.current) baseTitleRef.current = document.title;
    document.title = label;
    if (titleTimerRef.current != null) {
      window.clearTimeout(titleTimerRef.current);
    }
    titleTimerRef.current = window.setTimeout(() => {
      if (baseTitleRef.current) document.title = baseTitleRef.current;
      titleTimerRef.current = null;
    }, 10_000);
  }, []);

  const showDesktopNotification = useCallback(
    (items: ClinicRequestAlertItem[]) => {
      if (notificationPermission() !== "granted") return;
      const newest = items[0];
      if (!newest) return;
      const title =
        items.length === 1
          ? "New visit request"
          : `${items.length} new visit requests`;
      const body =
        items.length === 1
          ? `${newest.patientName} · ${newest.preferredDateYmd} · ${newest.issue}`
          : items.map((i) => i.patientName).join(", ");
      try {
        const n = new Notification(title, {
          body,
          icon: "/brand/icon-192.png",
          tag: `clinic-request:${newest.id}`,
          requireInteraction: true,
          silent: false,
        });
        n.onclick = () => {
          window.focus();
          router.push(inboxHref);
          n.close();
        };
      } catch {
        /* unsupported payload */
      }
    },
    [inboxHref, router]
  );

  const announce = useCallback(
    async (items: ClinicRequestAlertItem[]) => {
      const fresh = items.filter((item) => claimRequestAlert(item.id));
      if (fresh.length === 0) return;
      await playClinicRequestAlertSound();
      showDesktopNotification(fresh);
      flashTitle(
        fresh.length === 1 ? "● New visit request" : "● New visit requests"
      );
      setToasts((cur) => [
        ...fresh.map((item) => ({ ...item, shownAt: Date.now() })),
        ...cur,
      ].slice(0, 4));
      dispatchGlobalLiveRefresh();
    },
    [flashTitle, showDesktopNotification]
  );

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/doctor/schedule-requests", {
        credentials: "include",
        cache: "no-store",
      });
      const data = (await res.json()) as {
        success?: boolean;
        pendingCount?: number;
        items?: ClinicRequestAlertItem[];
      };
      if (!res.ok || data.success === false) return;

      const pending = (data.items ?? []).filter(
        (item) => item.status === "pending"
      );
      dispatchClinicRequestInbox({
        pendingCount: data.pendingCount ?? pending.length,
        newItems: [],
      });

      const pendingIds = pending.map((item) => item.id);
      if (!hydratedRef.current) {
        hydratedRef.current = true;
        pendingIds.forEach((id) => seenRef.current.add(id));
        writeSeenRequestIds(seenRef.current);
        return;
      }

      const newcomers = pending.filter((item) => !seenRef.current.has(item.id));
      pendingIds.forEach((id) => seenRef.current.add(id));
      writeSeenRequestIds(seenRef.current);

      if (newcomers.length > 0 && readRequestAlertsEnabled()) {
        await announce(newcomers);
      }
    } catch {
      /* keep last */
    }
  }, [announce]);

  useEffect(() => {
    void poll();
    const id = window.setInterval(() => void poll(), POLL_MS);
    return () => window.clearInterval(id);
  }, [poll]);

  useEffect(() => {
    if (toasts.length === 0) return;
    const id = window.setInterval(() => {
      const cutoff = Date.now() - 12_000;
      setToasts((cur) => cur.filter((t) => t.shownAt > cutoff));
    }, 1000);
    return () => window.clearInterval(id);
  }, [toasts.length]);

  async function toggle() {
    if (enabled) {
      writeRequestAlertsEnabled(false);
      setEnabled(false);
      return;
    }

    await unlockClinicRequestAlertSound();
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      const next = await Notification.requestPermission();
      setPermission(next);
    } else {
      setPermission(notificationPermission());
    }

    writeRequestAlertsEnabled(true);
    setEnabled(true);
    hydratedRef.current = true;
    await playClinicRequestAlertSound();
    void poll();
  }

  const label = enabled ? "Request alerts on" : "Enable request alerts";
  const hint =
    enabled && permission === "denied"
      ? "Sound is on. Desktop banners are blocked in the browser."
      : enabled
        ? "You will hear a chime and see a desktop alert for new patient requests."
        : "Turn on to get a sound and desktop notification when a patient requests a visit.";

  return (
    <>
      <button
        type="button"
        onClick={() => void toggle()}
        title={hint}
        aria-pressed={enabled}
        aria-label={label}
        className={
          compact
            ? `inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                enabled
                  ? "bg-[#1E1B31] text-white"
                  : "text-[#1E1B31]/70 hover:bg-[#1E1B31]/8"
              }`
            : `${doctorHeaderBellBtnClass} ${
                enabled
                  ? "bg-[#1E1B31]/10 text-[#1E1B31]"
                  : "text-slate-700 hover:bg-slate-100"
              }`
        }
      >
        {enabled ? (
          <Bell className="h-4 w-4 shrink-0" aria-hidden />
        ) : (
          <BellOff className="h-4 w-4 shrink-0" aria-hidden />
        )}
        <span className={compact ? "hidden sm:inline" : "hidden sm:inline"}>
          {enabled ? "Alerts on" : "Alerts"}
        </span>
      </button>

      {toasts.length > 0 ? (
        <div className="pointer-events-none fixed right-3 top-16 z-[80] flex w-[min(calc(100vw-1.5rem),22rem)] flex-col gap-2">
          {toasts.map((toast) => (
            <button
              key={`${toast.id}-${toast.shownAt}`}
              type="button"
              className="pointer-events-auto rounded-xl border border-[#1E1B31]/15 bg-white px-3 py-2.5 text-left shadow-[0_8px_28px_rgba(30,27,49,0.14)]"
              onClick={() => {
                setToasts((cur) => cur.filter((t) => t.id !== toast.id));
                router.push(inboxHref);
              }}
            >
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#1E1B31]/50">
                New visit request
              </p>
              <p className="mt-0.5 text-sm font-semibold text-[#1E1B31]">
                {toast.patientName}
              </p>
              <p className="mt-0.5 text-xs text-[#1E1B31]/60">
                {toast.preferredDateYmd} · {toast.issue}
              </p>
            </button>
          ))}
        </div>
      ) : null}
    </>
  );
}
