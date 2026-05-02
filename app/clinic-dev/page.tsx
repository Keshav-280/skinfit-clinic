"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  Calendar,
  Check,
  FileText,
  LayoutGrid,
  MessageCircle,
  Plus,
  RefreshCcw,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { formatSlotTimeRange } from "@/src/lib/slotTimeHm";

type DoctorRow = { id: string; name: string; email: string };

type SlotRow = {
  id: string;
  slotDate: string;
  slotTimeHm: string;
  slotEndTimeHm: string | null;
  title: string;
};

type PendingRequestRow = {
  requestId: string;
  patientId: string;
  patient: { name: string; email: string };
  issue: string;
  why: string | null;
  slot: {
    id: string;
    slotDate: string;
    slotTimeHm: string;
    slotEndTimeHm: string | null;
    title: string;
  };
  status: string;
  cancelledReason: string | null;
};

type RubyInboxThreadRow = {
  threadId: string;
  patientId: string;
  patientName: string;
  patientEmail: string;
  lastMessageAt: string | null;
};

type RubyChatMsg = {
  id: string;
  sender: string;
  text: string;
  createdAt: string;
};

type SectionId = "slots" | "requests" | "inbox";

const SECTIONS: { id: SectionId; label: string; hint: string }[] = [
  { id: "slots", label: "Slots", hint: "Create or remove doctor times" },
  { id: "requests", label: "Pending", hint: "Approve or cancel requests" },
  { id: "inbox", label: "Dr. Ruby inbox", hint: "Patient chats & replies" },
];

export default function ClinicDevPage() {
  const [section, setSection] = useState<SectionId>("slots");
  const [doctors, setDoctors] = useState<DoctorRow[]>([]);
  const [doctorId, setDoctorId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [slotDate, setSlotDate] = useState<string>(() => {
    const n = new Date();
    return n.toISOString().slice(0, 10);
  });
  const [slotTimeHm, setSlotTimeHm] = useState<string>("10:30");
  /** Empty = omit on save (new row → no custom end; update → keep existing end). */
  const [slotEndTimeHm, setSlotEndTimeHm] = useState<string>("");
  const [slotTitle, setSlotTitle] = useState<string>("Consultation");
  const [slotResult, setSlotResult] = useState<string | null>(null);

  const [slots, setSlots] = useState<SlotRow[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  /** Shown to patients in Clinic Support when deleting a slot that had bookings/requests. */
  const [deleteSlotReason, setDeleteSlotReason] = useState("");

  const [pending, setPending] = useState<PendingRequestRow[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);

  const [rubyThreads, setRubyThreads] = useState<RubyInboxThreadRow[]>([]);
  const [rubyThreadsLoading, setRubyThreadsLoading] = useState(false);
  const [rubyPatientId, setRubyPatientId] = useState<string | null>(null);
  const [rubyMessages, setRubyMessages] = useState<RubyChatMsg[]>([]);
  const [rubyMessagesLoading, setRubyMessagesLoading] = useState(false);
  const [rubyReply, setRubyReply] = useState("");
  const [rubySending, setRubySending] = useState(false);

  const [kaiScanId, setKaiScanId] = useState("");
  const [kaiRows, setKaiRows] = useState<
    Array<{
      id: string;
      paramKey: string;
      value: number | null;
      source: string;
    }>
  >([]);
  const [kaiLoading, setKaiLoading] = useState(false);
  const [kaiEdits, setKaiEdits] = useState<Record<string, string>>({});

  async function loadDoctors() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/clinic/doctors");
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !Array.isArray(data.doctors)) {
        throw new Error(data.error || "Failed to load doctors");
      }
      setDoctors(data.doctors);
      setDoctorId((prev) => prev || data.doctors[0]?.id || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load doctors");
    } finally {
      setLoading(false);
    }
  }

  const refreshSlots = useCallback(async () => {
    if (!doctorId) return;
    setSlotsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/clinic-dev/appointments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "listSlots", doctorId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok || !Array.isArray(data.slots)) {
        throw new Error(data.error || "Failed to load slots");
      }
      setSlots(data.slots as SlotRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load slots");
    } finally {
      setSlotsLoading(false);
    }
  }, [doctorId]);

  async function upsertSlot() {
    if (!doctorId) return;
    setError(null);
    setSlotResult(null);
    setLoading(true);
    try {
      const upsertBody: Record<string, unknown> = {
        action: "upsertSlot",
        doctorId,
        slotDate,
        slotTimeHm,
        title: slotTitle,
      };
      const endTrim = slotEndTimeHm.trim();
      if (endTrim) upsertBody.slotEndTimeHm = endTrim;

      const res = await fetch("/api/clinic-dev/appointments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(upsertBody),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to upsert slot");
      }
      setSlotResult(`Slot saved · id ${data.doctorSlotId ?? "—"}`);
      await refreshSlots();
      await refreshPending();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to upsert slot");
    } finally {
      setLoading(false);
    }
  }

  async function clearStoredSlotEnd() {
    if (!doctorId) return;
    setError(null);
    setSlotResult(null);
    setLoading(true);
    try {
      const res = await fetch("/api/clinic-dev/appointments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "upsertSlot",
          doctorId,
          slotDate,
          slotTimeHm,
          title: slotTitle,
          slotEndTimeHm: null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to clear end time");
      }
      setSlotEndTimeHm("");
      setSlotResult(`Custom end cleared · id ${data.doctorSlotId ?? "—"}`);
      await refreshSlots();
      await refreshPending();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to clear end time");
    } finally {
      setLoading(false);
    }
  }

  async function deleteSlot(slotId: string) {
    if (!doctorId) return;
    if (
      !window.confirm(
        "Remove this slot? Patients with a booking or pending request get a Clinic Support message, and the slot disappears from calendars."
      )
    ) {
      return;
    }
    setError(null);
    setDeletingId(slotId);
    try {
      const res = await fetch("/api/clinic-dev/appointments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "deleteSlot",
          doctorId,
          doctorSlotId: slotId,
          ...(deleteSlotReason.trim() ? { reason: deleteSlotReason.trim() } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to delete slot");
      }
      await refreshSlots();
      await refreshPending();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete slot");
    } finally {
      setDeletingId(null);
    }
  }

  const refreshPending = useCallback(async () => {
    if (!doctorId) return;
    setPendingLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/clinic-dev/appointments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "listPending", doctorId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok || !Array.isArray(data.requests)) {
        throw new Error(data.error || "Failed to load pending requests");
      }
      setPending(data.requests as PendingRequestRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load pending requests");
    } finally {
      setPendingLoading(false);
    }
  }, [doctorId]);

  const refreshRubyThreads = useCallback(async () => {
    setRubyThreadsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/clinic-dev/doctor-chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "listThreads" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok || !Array.isArray(data.threads)) {
        throw new Error(data.error || "Failed to load Dr. Ruby inbox");
      }
      setRubyThreads(data.threads as RubyInboxThreadRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load inbox");
    } finally {
      setRubyThreadsLoading(false);
    }
  }, []);

  const loadRubyMessages = useCallback(async (patientId: string) => {
    setRubyMessagesLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/clinic-dev/doctor-chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "messages", patientId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok || !Array.isArray(data.messages)) {
        throw new Error(data.error || "Failed to load messages");
      }
      setRubyMessages(data.messages as RubyChatMsg[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load messages");
      setRubyMessages([]);
    } finally {
      setRubyMessagesLoading(false);
    }
  }, []);

  async function sendRubyReply() {
    if (!rubyPatientId || !rubyReply.trim() || rubySending) return;
    setRubySending(true);
    setError(null);
    try {
      const res = await fetch("/api/clinic-dev/doctor-chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "reply",
          patientId: rubyPatientId,
          text: rubyReply.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Reply failed");
      }
      setRubyReply("");
      await loadRubyMessages(rubyPatientId);
      await refreshRubyThreads();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reply failed");
    } finally {
      setRubySending(false);
    }
  }

  useEffect(() => {
    if (section === "inbox") void refreshRubyThreads();
  }, [section, refreshRubyThreads]);

  useEffect(() => {
    if (section !== "inbox" || !rubyPatientId) return;
    void loadRubyMessages(rubyPatientId);
  }, [section, rubyPatientId, loadRubyMessages]);

  async function approveRequest(requestId: string) {
    setError(null);
    setPendingLoading(true);
    try {
      const res = await fetch("/api/clinic-dev/appointments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "approveRequest", doctorId, requestId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        const details =
          typeof data === "object" && data
            ? JSON.stringify(data, null, 2)
            : String(data);
        throw new Error(`Approve failed (status=${res.status}). ${details}`);
      }
      await refreshPending();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approve failed");
      setPendingLoading(false);
    }
  }

  async function cancelRequest(requestId: string) {
    const reason = window.prompt("Cancellation reason (short):", "Doctor unavailable");
    if (!reason) return;
    setError(null);
    setPendingLoading(true);
    try {
      const res = await fetch("/api/clinic-dev/appointments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "cancelRequest",
          doctorId,
          requestId,
          reason,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        const details =
          typeof data === "object" && data
            ? JSON.stringify(data, null, 2)
            : String(data);
        throw new Error(`Cancel failed (status=${res.status}). ${details}`);
      }
      await refreshPending();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cancel failed");
      setPendingLoading(false);
    }
  }

  useEffect(() => {
    void loadDoctors();
  }, []);

  useEffect(() => {
    if (doctorId) {
      void refreshPending();
      void refreshSlots();
    }
  }, [doctorId, refreshPending, refreshSlots]);

  const todayLabel = useMemo(() => format(new Date(), "EEE, MMM d"), []);

  const doctorName = doctors.find((d) => d.id === doctorId)?.name ?? "Doctor";

  return (
    <div className="min-h-screen bg-[#FDF9F0] text-slate-800">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">
              Internal
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
              Clinic dev console
            </h1>
            <p className="mt-1 max-w-xl text-sm text-slate-600">
              Test slots and approvals without Postman. Today is {todayLabel}.
            </p>
          </div>
          <label className="flex min-w-[220px] flex-col gap-1 text-sm font-medium text-slate-700">
            Active doctor
            <select
              value={doctorId}
              onChange={(e) => setDoctorId(e.target.value)}
              disabled={loading}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 shadow-sm outline-none ring-teal-500/0 transition focus:border-teal-300 focus:ring-2 focus:ring-teal-500/20"
            >
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
        </header>

        {error ? (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900"
          >
            {error}
          </div>
        ) : null}

        <nav
          className="mb-6 flex flex-wrap gap-2 rounded-2xl border border-slate-200/80 bg-white/90 p-1.5 shadow-sm"
          aria-label="Sections"
        >
          {SECTIONS.map((s) => {
            const on = section === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSection(s.id)}
                className={`flex min-w-[7rem] flex-1 flex-col items-start rounded-xl px-3 py-2 text-left transition sm:flex-none sm:min-w-[9rem] ${
                  on
                    ? "bg-teal-600 text-white shadow-md shadow-teal-600/20"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <span className="text-sm font-semibold">{s.label}</span>
                <span
                  className={`mt-0.5 text-[11px] leading-tight ${
                    on ? "text-teal-100" : "text-slate-500"
                  }`}
                >
                  {s.hint}
                </span>
              </button>
            );
          })}
        </nav>

        {section === "slots" ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-slate-900">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                  <Plus className="h-4 w-4" aria-hidden />
                </span>
                <div>
                  <h2 className="text-base font-semibold">Add or update a slot</h2>
                  <p className="text-xs text-slate-500">
                    Same date+start time updates the title. Leave end blank on update to keep the
                    stored end time.
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Date
                    <input
                      type="date"
                      value={slotDate}
                      onChange={(e) => setSlotDate(e.target.value)}
                      disabled={loading}
                      className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-300 focus:ring-2 focus:ring-teal-500/15"
                    />
                  </label>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Start
                    <input
                      type="time"
                      value={slotTimeHm}
                      onChange={(e) => setSlotTimeHm(e.target.value)}
                      disabled={loading}
                      className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-300 focus:ring-2 focus:ring-teal-500/15"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-end">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    End (optional)
                    <input
                      type="time"
                      value={slotEndTimeHm}
                      onChange={(e) => setSlotEndTimeHm(e.target.value)}
                      disabled={loading}
                      className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-300 focus:ring-2 focus:ring-teal-500/15"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => void clearStoredSlotEnd()}
                    disabled={loading || !doctorId}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Clear stored end (default length)
                  </button>
                </div>

                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Title
                  <input
                    type="text"
                    value={slotTitle}
                    onChange={(e) => setSlotTitle(e.target.value)}
                    disabled={loading}
                    placeholder="Consultation"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-300 focus:ring-2 focus:ring-teal-500/15"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => void upsertSlot()}
                  disabled={loading || !doctorId}
                  className="w-full rounded-xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? "Saving…" : "Save slot"}
                </button>

                {slotResult ? (
                  <p className="text-xs text-teal-800">{slotResult}</p>
                ) : null}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-slate-900">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                    <Calendar className="h-4 w-4" aria-hidden />
                  </span>
                  <div>
                    <h2 className="text-base font-semibold">Slots for {doctorName}</h2>
                    <p className="text-xs text-slate-500">
                      Remove any row to delete that time. Set a reason below for patients who booked this slot.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void refreshSlots()}
                  disabled={slotsLoading || !doctorId}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  <RefreshCcw className={`h-3.5 w-3.5 ${slotsLoading ? "animate-spin" : ""}`} />
                  Refresh
                </button>
              </div>

              <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Patient-facing reason (optional)
                <textarea
                  value={deleteSlotReason}
                  onChange={(e) => setDeleteSlotReason(e.target.value)}
                  disabled={!!deletingId || !doctorId}
                  rows={2}
                  placeholder="e.g. Doctor unavailable — we’ll reopen this week."
                  className="mt-1.5 w-full resize-y rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-teal-300 focus:ring-2 focus:ring-teal-500/15"
                />
                <span className="mt-1 block font-normal normal-case text-slate-400">
                  Sent in Clinic Support when the slot had a booking or request. Leave blank for a default message.
                </span>
              </label>

              <div className="mt-4 max-h-[min(420px,55vh)] overflow-auto rounded-xl border border-slate-100">
                {slotsLoading && slots.length === 0 ? (
                  <p className="p-4 text-sm text-slate-500">Loading slots…</p>
                ) : slots.length === 0 ? (
                  <p className="p-4 text-sm text-slate-500">No slots yet. Add one on the left.</p>
                ) : (
                  <table className="w-full border-collapse text-left text-sm">
                    <thead className="sticky top-0 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-3 py-2.5">Date</th>
                        <th className="px-3 py-2.5">When</th>
                        <th className="px-3 py-2.5">Title</th>
                        <th className="w-px px-3 py-2.5 text-right"> </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {slots.map((s) => (
                        <tr key={s.id} className="bg-white hover:bg-slate-50/80">
                          <td className="whitespace-nowrap px-3 py-2.5 font-medium text-slate-800">
                            {s.slotDate}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">
                            {formatSlotTimeRange(s.slotTimeHm, s.slotEndTimeHm)}
                          </td>
                          <td className="max-w-[10rem] truncate px-3 py-2.5 text-slate-600" title={s.title}>
                            {s.title}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => void deleteSlot(s.id)}
                              disabled={deletingId === s.id || !doctorId}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-rose-600 transition hover:bg-rose-50 disabled:opacity-40"
                              title="Remove slot"
                              aria-label={`Remove slot ${s.slotDate} ${formatSlotTimeRange(
                                s.slotTimeHm,
                                s.slotEndTimeHm
                              )}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          </div>
        ) : null}

        {section === "requests" ? (
          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-slate-900">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-800">
                  <LayoutGrid className="h-4 w-4" aria-hidden />
                </span>
                <div>
                  <h2 className="text-base font-semibold">Pending requests</h2>
                  <p className="text-xs text-slate-500">Approve or cancel for the selected doctor.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void refreshPending()}
                disabled={pendingLoading || !doctorId}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCcw className={`h-3.5 w-3.5 ${pendingLoading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {pendingLoading && pending.length === 0 ? (
                <p className="text-sm text-slate-500">Loading…</p>
              ) : pending.length === 0 ? (
                <p className="text-sm text-slate-500">No pending requests.</p>
              ) : null}

              {pending.map((r) => (
                <div
                  key={r.requestId}
                  className="flex flex-col gap-3 rounded-xl border border-slate-100 bg-slate-50/40 p-4 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-semibold text-teal-900">
                        <FileText className="h-3.5 w-3.5" aria-hidden />
                        Pending
                      </span>
                      <span className="text-xs text-slate-500">
                        {r.slot.slotDate} ·{" "}
                        {formatSlotTimeRange(r.slot.slotTimeHm, r.slot.slotEndTimeHm)}
                      </span>
                    </div>
                    <p className="mt-2 truncate text-sm font-semibold text-slate-900">{r.patient.name}</p>
                    <p className="text-xs text-slate-500">{r.patient.email}</p>
                    <p className="mt-2 text-xs text-slate-600">
                      <span className="font-semibold text-slate-800">Issue:</span> {r.issue}
                    </p>
                    {r.why ? (
                      <p className="text-xs text-slate-600">
                        <span className="font-semibold text-slate-800">Why:</span> {r.why}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void approveRequest(r.requestId)}
                      disabled={pendingLoading}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                    >
                      <Check className="h-4 w-4" aria-hidden />
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => void cancelRequest(r.requestId)}
                      disabled={pendingLoading}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
                    >
                      <X className="h-4 w-4" aria-hidden />
                      Cancel
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {section === "inbox" ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,280px)_1fr]">
            <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                    <MessageCircle className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold">Patients</h2>
                    <p className="text-xs text-slate-500">Dr. Ruby chat threads</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void refreshRubyThreads()}
                  disabled={rubyThreadsLoading}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  <RefreshCcw
                    className={`h-3.5 w-3.5 ${rubyThreadsLoading ? "animate-spin" : ""}`}
                  />
                  Refresh
                </button>
              </div>
              <div className="mt-3 max-h-[min(520px,60vh)] overflow-y-auto rounded-xl border border-slate-100">
                {rubyThreadsLoading && rubyThreads.length === 0 ? (
                  <p className="p-3 text-sm text-slate-500">Loading…</p>
                ) : rubyThreads.length === 0 ? (
                  <p className="p-3 text-sm text-slate-500">
                    No Dr. Ruby threads yet. They appear after a patient opens Chat → Dr. Ruby
                    Sachdev and sends a message.
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {rubyThreads.map((t) => (
                      <li key={t.threadId}>
                        <button
                          type="button"
                          onClick={() => setRubyPatientId(t.patientId)}
                          className={`w-full px-3 py-2.5 text-left text-sm transition hover:bg-slate-50 ${
                            rubyPatientId === t.patientId ? "bg-teal-50/80" : ""
                          }`}
                        >
                          <p className="truncate font-medium text-slate-900">{t.patientName}</p>
                          <p className="truncate text-xs text-slate-500">{t.patientEmail}</p>
                          {t.lastMessageAt ? (
                            <p className="mt-0.5 text-[10px] text-slate-400">
                              {format(new Date(t.lastMessageAt), "MMM d, h:mm a")}
                            </p>
                          ) : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            <section className="flex min-h-[min(520px,60vh)] flex-col rounded-2xl border border-slate-200/80 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-4 py-3">
                <h2 className="text-base font-semibold text-slate-900">Conversation</h2>
                <p className="text-xs text-slate-500">
                  {rubyPatientId
                    ? "Replies are stored as Dr. Ruby. The patient sees them in Chat → Dr. Ruby Sachdev."
                    : "Select a patient."}
                </p>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/50 p-4">
                {!rubyPatientId ? (
                  <p className="text-sm text-slate-500">Choose someone from the list.</p>
                ) : rubyMessagesLoading ? (
                  <p className="text-sm text-slate-500">Loading messages…</p>
                ) : rubyMessages.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No messages yet. You can still send a first reply — it will create the thread for
                    this patient.
                  </p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {rubyMessages.map((m) => (
                      <div
                        key={m.id}
                        className={`flex ${
                          m.sender === "patient" ? "justify-end" : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm ${
                            m.sender === "patient"
                              ? "bg-teal-600 text-white"
                              : m.sender === "doctor"
                                ? "border border-slate-200 bg-white text-slate-800 shadow-sm"
                                : "border border-slate-200 bg-white text-slate-600 shadow-sm"
                          }`}
                        >
                          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide opacity-80">
                            {m.sender === "patient"
                              ? "Patient"
                              : m.sender === "doctor"
                                ? "Dr. Ruby"
                                : m.sender}
                          </span>
                          <p className="whitespace-pre-wrap">{m.text}</p>
                          <p
                            className={`mt-1 text-[10px] ${
                              m.sender === "patient" ? "text-teal-100" : "text-slate-400"
                            }`}
                          >
                            {format(new Date(m.createdAt), "MMM d, yyyy · h:mm a")}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="border-t border-slate-100 p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <textarea
                    value={rubyReply}
                    onChange={(e) => setRubyReply(e.target.value)}
                    disabled={!rubyPatientId || rubySending}
                    rows={3}
                    placeholder={
                      rubyPatientId ? "Type a reply as Dr. Ruby…" : "Select a patient first"
                    }
                    className="min-h-[44px] flex-1 resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-300 focus:ring-2 focus:ring-teal-500/15"
                  />
                  <button
                    type="button"
                    onClick={() => void sendRubyReply()}
                    disabled={!rubyPatientId || !rubyReply.trim() || rubySending}
                    className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:opacity-50 sm:min-w-[6rem]"
                  >
                    <Send className="h-4 w-4" aria-hidden />
                    {rubySending ? "Sending…" : "Send"}
                  </button>
                </div>
              </div>
            </section>
          </div>
        ) : null}

        <section className="mt-10 rounded-2xl border border-amber-200/80 bg-amber-50/40 p-4 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Fill pending kAI parameters</h2>
          <p className="mt-1 text-xs text-slate-600">
            Load a patient scan by numeric id. Pending / doctor rows are editable; AI rows are
            read-only.
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="flex flex-col text-xs font-medium text-slate-600">
              Scan id
              <input
                value={kaiScanId}
                onChange={(e) => setKaiScanId(e.target.value)}
                className="mt-1 w-32 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
              />
            </label>
            <button
              type="button"
              className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-white"
              disabled={kaiLoading}
              onClick={async () => {
                const id = Number.parseInt(kaiScanId, 10);
                if (!Number.isFinite(id) || id < 1) return;
                setKaiLoading(true);
                setError(null);
                try {
                  const res = await fetch("/api/clinic-dev/parameters", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ action: "list", scanId: id }),
                  });
                  const data = await res.json().catch(() => ({}));
                  if (!res.ok || !data.ok || !Array.isArray(data.rows)) {
                    throw new Error(data.error || "Load failed");
                  }
                  setKaiRows(data.rows);
                  const ed: Record<string, string> = {};
                  for (const r of data.rows as typeof kaiRows) {
                    if (r.value != null) ed[r.paramKey] = String(r.value);
                  }
                  setKaiEdits(ed);
                } catch (e) {
                  setError(e instanceof Error ? e.message : "kAI load failed");
                } finally {
                  setKaiLoading(false);
                }
              }}
            >
              {kaiLoading ? "Loading…" : "Load"}
            </button>
            <button
              type="button"
              className="rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold text-white"
              disabled={kaiLoading || kaiRows.length === 0}
              onClick={async () => {
                const id = Number.parseInt(kaiScanId, 10);
                if (!Number.isFinite(id) || id < 1) return;
                setKaiLoading(true);
                setError(null);
                try {
                  const rows = kaiRows
                    .filter((r) => r.source !== "ai")
                    .map((r) => ({
                      paramKey: r.paramKey,
                      value: Number.parseInt(kaiEdits[r.paramKey] ?? "", 10),
                    }))
                    .filter((r) => Number.isFinite(r.value));
                  const res = await fetch("/api/clinic-dev/parameters", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ action: "save", scanId: id, rows }),
                  });
                  const data = await res.json().catch(() => ({}));
                  if (!res.ok || !data.ok || !Array.isArray(data.rows)) {
                    throw new Error(data.error || "Save failed");
                  }
                  setKaiRows(data.rows);
                } catch (e) {
                  setError(e instanceof Error ? e.message : "kAI save failed");
                } finally {
                  setKaiLoading(false);
                }
              }}
            >
              Save pending / doctor
            </button>
          </div>
          {kaiRows.length > 0 ? (
            <ul className="mt-4 max-h-80 space-y-2 overflow-y-auto text-sm">
              {kaiRows.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2"
                >
                  <span className="w-36 font-mono text-xs text-slate-700">{r.paramKey}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                      r.source === "ai"
                        ? "bg-slate-100 text-slate-600"
                        : r.source === "pending"
                          ? "bg-amber-100 text-amber-900"
                          : "bg-teal-100 text-teal-900"
                    }`}
                  >
                    {r.source}
                  </span>
                  {r.source === "ai" ? (
                    <span className="text-slate-800">{r.value ?? "—"}</span>
                  ) : (
                    <input
                      className="w-20 rounded border border-slate-200 px-2 py-1 text-sm"
                      value={kaiEdits[r.paramKey] ?? ""}
                      onChange={(e) =>
                        setKaiEdits((prev) => ({
                          ...prev,
                          [r.paramKey]: e.target.value,
                        }))
                      }
                    />
                  )}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>
    </div>
  );
}
