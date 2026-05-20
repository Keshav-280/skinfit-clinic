"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Bell, Check } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { GLOBAL_LIVE_REFRESH_EVENT } from "@/src/lib/globalRefreshEvents";
import { doctorDropdownClass } from "@/components/doctor/DoctorUiPrimitives";

type SosItem = {
  patientId: string;
  messageId: string;
  patientName: string;
  preview: string;
  createdAt: string;
};

function parseAlertPreview(preview: string) {
  const lines = preview
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    return { title: "Patient alert", bullets: [] as string[] };
  }
  return {
    title: lines[0].replace(/^📋\s*/, ""),
    bullets: lines.slice(1),
  };
}

export function DoctorSosBell() {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<SosItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [ackingId, setAckingId] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/doctor/sos-summary", {
        credentials: "include",
        cache: "no-store",
      });
      const data = (await res.json()) as {
        success?: boolean;
        patientCount?: number;
        items?: SosItem[];
      };
      if (res.ok && data.success) {
        setCount(data.patientCount ?? 0);
        setItems(data.items ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const acknowledge = useCallback(
    async (messageId: string) => {
      setAckingId(messageId);
      try {
        const res = await fetch("/api/doctor/sos-summary/ack", {
          method: "POST",
          credentials: "include",
          cache: "no-store",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ chatMessageId: messageId }),
        });
        const data = (await res.json().catch(() => ({}))) as { success?: boolean };
        if (res.ok && data.success) {
          setItems((prev) => prev.filter((it) => it.messageId !== messageId));
          setCount((c) => Math.max(0, c - 1));
          void load();
        }
      } finally {
        setAckingId(null);
      }
    },
    [load]
  );

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 30_000);
    const onRefresh = () => void load();
    window.addEventListener(GLOBAL_LIVE_REFRESH_EVENT, onRefresh);
    return () => {
      window.clearInterval(id);
      window.removeEventListener(GLOBAL_LIVE_REFRESH_EVENT, onRefresh);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`relative flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
          open || count > 0
            ? "bg-[#2C3E6B]/10 text-[#2C3E6B]"
            : "text-slate-700 hover:bg-slate-100"
        }`}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`Alerts. ${count} need review.`}
      >
        <Bell className="h-4 w-4 shrink-0" aria-hidden />
        <span className="hidden sm:inline">Alerts</span>
        {count > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className={`absolute right-0 top-full z-50 mt-2 w-[min(calc(100vw-2rem),24rem)] overflow-hidden ${doctorDropdownClass}`}
          role="menu"
        >
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#2C3E6B]/10 text-[#2C3E6B]">
                <AlertTriangle className="h-4 w-4" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900">Alerts (14 days)</p>
                <p className="text-xs text-slate-600">
                  {count > 0
                    ? `${count} patient${count === 1 ? "" : "s"} need review`
                    : "All caught up"}
                </p>
              </div>
            </div>
      
          </div>

          {loading && items.length === 0 && count === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-500">Loading…</p>
          ) : count === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-500">
              No alerts waiting for review.
            </p>
          ) : (
            <ul className="max-h-80 space-y-2 overflow-y-auto p-2">
              {items.map((it) => {
                const parsed = parseAlertPreview(it.preview);
                const busy = ackingId === it.messageId;
                return (
                  <li
                    key={it.messageId}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-2.5"
                  >
                    <div className="flex gap-2.5">
                      <button
                        type="button"
                        disabled={busy}
                        className="flex shrink-0 flex-col items-center gap-1 rounded-lg px-1 py-0.5 transition hover:bg-[#2C3E6B]/5 disabled:opacity-50"
                        aria-label={`Mark alert from ${it.patientName} as reviewed`}
                        title="Mark reviewed"
                        onClick={(e) => {
                          e.stopPropagation();
                          void acknowledge(it.messageId);
                        }}
                      >
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#2C3E6B]/25 bg-white text-[#2C3E6B]">
                          {busy ? (
                            <span className="text-xs">…</span>
                          ) : (
                            <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                          )}
                        </span>
                        <span className="text-center text-[9px] font-medium text-slate-500">
                          Done
                        </span>
                      </button>

                      <Link
                        href={`/doctor/patients/${it.patientId}`}
                        className="min-w-0 flex-1 rounded-lg px-1 py-0.5 transition hover:bg-[#2C3E6B]/5"
                        onClick={() => setOpen(false)}
                        role="menuitem"
                      >
                        <p className="text-sm font-semibold text-[#2C3E6B]">
                          {it.patientName}
                        </p>
                        <p className="mt-0.5 text-xs font-medium leading-snug text-slate-800">
                          {parsed.title}
                        </p>
                        {parsed.bullets.length > 0 ? (
                          <ul className="mt-1.5 space-y-0.5">
                            {parsed.bullets.map((line) => (
                              <li
                                key={line}
                                className="flex gap-1.5 text-xs leading-snug text-slate-600"
                              >
                                <span
                                  className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#2C3E6B]/40"
                                  aria-hidden
                                />
                                <span>{line}</span>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                        <p className="mt-1.5 text-[10px] text-slate-400">
                          {formatDistanceToNow(new Date(it.createdAt), {
                            addSuffix: true,
                          })}
                        </p>
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="border-t border-slate-200 bg-white px-4 py-2.5">
            <Link
              href="/doctor/patients?sos=1"
              className="text-xs font-semibold text-[#2C3E6B] hover:underline"
              onClick={() => setOpen(false)}
            >
              View all patients with alerts →
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
