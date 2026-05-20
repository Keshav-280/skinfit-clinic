"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Calendar } from "lucide-react";
import { format } from "date-fns";
import { GLOBAL_LIVE_REFRESH_EVENT } from "@/src/lib/globalRefreshEvents";

type Item = {
  appointmentId: string;
  patientId: string;
  patientName: string;
  dateTime: string;
  type: string;
};

export function DoctorAppointmentsBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/doctor/upcoming-appointments", {
        credentials: "include",
      });
      const data = (await res.json()) as {
        success?: boolean;
        items?: Item[];
      };
      if (res.ok && data.success) {
        setItems(data.items ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 120_000);
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

  const count = items.length;

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative flex items-center gap-1.5 rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-100"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`Upcoming appointments. ${count} in the next 14 days.`}
      >
        <Calendar className="h-4 w-4 shrink-0" aria-hidden />
        <span className="hidden sm:inline">Upcoming</span>
        {count > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#2C3E6B] px-1 text-[10px] font-bold text-white">
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className="absolute right-0 top-full z-50 mt-1 w-[min(calc(100vw-2rem),22rem)] rounded-xl border border-slate-200 bg-white py-2 shadow-lg"
          role="menu"
        >
          <div className="border-b border-slate-100 px-3 pb-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Next 14 days
            </p>
           
          </div>
          {loading && items.length === 0 ? (
            <p className="px-3 py-4 text-sm text-slate-500">Loading…</p>
          ) : count === 0 ? (
            <p className="px-3 py-4 text-sm text-slate-500">
              No scheduled appointments in this window.
            </p>
          ) : (
            <ul className="max-h-72 overflow-y-auto">
              {items.map((it) => (
                <li
                  key={it.appointmentId}
                  className="border-b border-slate-50 px-2 py-2 last:border-0"
                >
                  <Link
                    href={`/doctor/patients/${it.patientId}`}
                    className="block rounded-md px-1 py-0.5 hover:bg-teal-50"
                    onClick={() => setOpen(false)}
                    role="menuitem"
                  >
                    <span className="text-sm font-semibold text-slate-900">
                      {it.patientName}
                    </span>
                    <p className="mt-0.5 text-xs text-slate-600">
                      {format(new Date(it.dateTime), "EEE d MMM, p")} · {it.type}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
