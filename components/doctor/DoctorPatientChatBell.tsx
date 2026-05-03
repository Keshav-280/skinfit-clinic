"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { DOCTOR_PATIENT_CHAT_INBOX_REFRESH_EVENT } from "@/src/lib/doctorPatientChatInbox";

type ChatItem = {
  patientId: string;
  messageId: string;
  patientName: string;
  preview: string;
  createdAt: string;
};

export function DoctorPatientChatBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/doctor/patient-chat-inbox", { credentials: "include" });
      const data = (await res.json()) as {
        success?: boolean;
        count?: number;
        items?: ChatItem[];
      };
      if (res.ok && data.success) {
        setCount(typeof data.count === "number" ? data.count : (data.items?.length ?? 0));
        setItems(data.items ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 45_000);
    const onRefresh = () => void load();
    window.addEventListener(DOCTOR_PATIENT_CHAT_INBOX_REFRESH_EVENT, onRefresh);
    return () => {
      window.clearInterval(id);
      window.removeEventListener(DOCTOR_PATIENT_CHAT_INBOX_REFRESH_EVENT, onRefresh);
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
        className="relative flex items-center gap-1.5 rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-100"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`Patient chat. ${count} conversation${count === 1 ? "" : "s"} awaiting reply.`}
      >
        <MessageCircle className="h-4 w-4 shrink-0" aria-hidden />
        <span className="hidden sm:inline">Messages</span>
        {count > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-teal-600 px-1 text-[10px] font-bold text-white">
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
              Patient chat
            </p>
            <p className="mt-0.5 text-xs text-slate-600">
              Latest message in each thread is from the patient (not SOS — those stay under{" "}
              <strong className="font-semibold text-slate-800">Alerts</strong>). Opening a thread or
              replying clears the badge until the patient sends something newer. Push is also sent to
              doctor accounts when a patient posts.
            </p>
          </div>
          {loading && items.length === 0 && count === 0 ? (
            <p className="px-3 py-4 text-sm text-slate-500">Loading…</p>
          ) : count === 0 ? (
            <p className="px-3 py-4 text-sm text-slate-500">
              No open patient messages. You&apos;re caught up.
            </p>
          ) : (
            <ul className="max-h-72 overflow-y-auto">
              {items.map((it) => (
                <li
                  key={it.messageId}
                  className="border-b border-slate-50 px-2 py-2 last:border-0"
                >
                  <Link
                    href={`/doctor/patients/${it.patientId}#doctor-patient-chat`}
                    className="block min-w-0 rounded-md px-1 py-0.5 hover:bg-teal-50"
                    onClick={(e) => {
                      e.preventDefault();
                      setOpen(false);
                      void (async () => {
                        try {
                          await fetch("/api/doctor/patient-chat-inbox/seen", {
                            method: "POST",
                            credentials: "include",
                            headers: { "content-type": "application/json" },
                            body: JSON.stringify({ patientId: it.patientId }),
                          });
                        } finally {
                          window.dispatchEvent(
                            new Event(DOCTOR_PATIENT_CHAT_INBOX_REFRESH_EVENT)
                          );
                          router.push(
                            `/doctor/patients/${it.patientId}#doctor-patient-chat`
                          );
                        }
                      })();
                    }}
                    role="menuitem"
                  >
                    <div className="flex items-center gap-1.5">
                      <MessageCircle className="h-3.5 w-3.5 shrink-0 text-teal-600" aria-hidden />
                      <span className="text-sm font-semibold text-slate-900">{it.patientName}</span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">{it.preview}</p>
                    <p className="mt-1 text-[10px] text-slate-400">
                      {formatDistanceToNow(new Date(it.createdAt), { addSuffix: true })}
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
