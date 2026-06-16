"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ScanFace } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { doctorDropdownClass } from "@/components/doctor/DoctorUiPrimitives";
import { DOCTOR_SCAN_INBOX_REFRESH_EVENT } from "@/src/lib/doctorScanInboxEvents";
import { GLOBAL_LIVE_REFRESH_EVENT } from "@/src/lib/globalRefreshEvents";

type ScanItem = {
  scanId: number;
  patientId: string;
  patientName: string;
  preview: string;
  createdAt: string;
};

export function DoctorScanBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<ScanItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/doctor/scan-inbox", { credentials: "include" });
      const data = (await res.json()) as {
        success?: boolean;
        count?: number;
        items?: ScanItem[];
      };
      if (res.ok && data.success) {
        setCount(typeof data.count === "number" ? data.count : (data.items?.length ?? 0));
        setItems(data.items ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const markAllSeen = useCallback(async () => {
    if (count === 0 || markingAll) return;
    setMarkingAll(true);
    try {
      const res = await fetch("/api/doctor/scan-inbox/seen", {
        method: "POST",
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean };
      if (res.ok && data.ok) {
        setCount(0);
        setItems([]);
        window.dispatchEvent(new Event(DOCTOR_SCAN_INBOX_REFRESH_EVENT));
      }
    } finally {
      setMarkingAll(false);
    }
  }, [count, markingAll]);

  const openScan = useCallback(
    async (item: ScanItem) => {
      setOpen(false);
      try {
        await fetch("/api/doctor/scan-inbox/seen", {
          method: "POST",
          credentials: "include",
        });
      } finally {
        window.dispatchEvent(new Event(DOCTOR_SCAN_INBOX_REFRESH_EVENT));
        router.push(
          `/doctor/patients/${encodeURIComponent(item.patientId)}?scanId=${item.scanId}`
        );
      }
    },
    [router]
  );

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 45_000);
    const onRefresh = () => void load();
    window.addEventListener(DOCTOR_SCAN_INBOX_REFRESH_EVENT, onRefresh);
    window.addEventListener(GLOBAL_LIVE_REFRESH_EVENT, onRefresh);
    return () => {
      window.clearInterval(id);
      window.removeEventListener(DOCTOR_SCAN_INBOX_REFRESH_EVENT, onRefresh);
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
        aria-label={`Patient scans. ${count} new.`}
      >
        <ScanFace className="h-4 w-4 shrink-0" aria-hidden />
        <span className="hidden sm:inline">Scans</span>
        {count > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#2C3E6B] px-1 text-[10px] font-bold text-white">
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
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#2C3E6B]/10 text-[#2C3E6B]">
                  <ScanFace className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">Patient scans</p>
                  <p className="text-xs text-slate-600">
                    {count > 0
                      ? `${count} new scan${count === 1 ? "" : "s"} to review`
                      : "All caught up"}
                  </p>
                </div>
              </div>
              {count > 0 ? (
                <button
                  type="button"
                  disabled={markingAll}
                  onClick={() => void markAllSeen()}
                  className="shrink-0 rounded-lg border border-[#2C3E6B]/25 bg-white px-2.5 py-1 text-[11px] font-semibold text-[#2C3E6B] transition hover:bg-[#2C3E6B]/5 disabled:opacity-50"
                >
                  {markingAll ? "…" : "Seen all"}
                </button>
              ) : null}
            </div>
          </div>

          {loading && items.length === 0 && count === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-500">Loading…</p>
          ) : count === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-500">No new patient scans.</p>
          ) : (
            <ul className="max-h-80 space-y-2 overflow-y-auto p-2">
              {items.map((it) => (
                <li key={`${it.patientId}-${it.scanId}`}>
                  <button
                    type="button"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-[#2C3E6B]/25 hover:bg-white"
                    role="menuitem"
                    onClick={() => void openScan(it)}
                  >
                    <p className="text-sm font-semibold text-[#2C3E6B]">{it.patientName}</p>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-700">
                      {it.preview}
                    </p>
                    <p className="mt-1.5 text-[10px] text-slate-400">
                      {formatDistanceToNow(new Date(it.createdAt), { addSuffix: true })}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
