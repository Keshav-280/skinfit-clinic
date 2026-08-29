"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  CheckCircle2,
  Clock3,
  FileText,
  Phone,
  Send,
  XCircle,
} from "lucide-react";
import { formatSlotTimeRange } from "@/src/lib/slotTimeHm";
import { validateNationalPhone } from "@/src/lib/auth/phone";
import { patientHasPhoneOnFile } from "@/src/lib/ensurePatientPhoneForBooking";

type DoctorRow = { id: string; name: string; email: string };

type DoctorCalendarSlot = {
  id: string;
  title: string;
  slotDate: string; // YYYY-MM-DD
  slotTimeHm: string; // HH:mm
  slotEndTimeHm?: string | null;
  status:
    | "available"
    | "requested"
    | "held"
    | "booked"
    | "cancelled"
    | "completed";
  bookedByMe: boolean;
  appointmentId: string | null;
  cancelledReason?: string | null;
};

function ymdToday() {
  const n = new Date();
  return n.toISOString().slice(0, 10);
}

function ymdAddDays(ymd: string, days: number) {
  const d = new Date(`${ymd}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function DoctorCalendarPatientSection() {
  const [doctors, setDoctors] = useState<DoctorRow[]>([]);
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [slots, setSlots] = useState<DoctorCalendarSlot[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [requestSlot, setRequestSlot] = useState<DoctorCalendarSlot | null>(null);
  const [issue, setIssue] = useState("");
  const [why, setWhy] = useState("");
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [patientHasPhone, setPatientHasPhone] = useState(true);
  const [bookingPhoneCountryCode, setBookingPhoneCountryCode] = useState("+91");
  const [bookingPhone, setBookingPhone] = useState("");

  const range = useMemo(() => {
    const from = ymdToday();
    const to = ymdAddDays(from, 14);
    return { from, to };
  }, []);

  async function refreshCalendar(nextDoctorId: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/calendar/patient/doctor/${encodeURIComponent(
          nextDoctorId
        )}?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(
          range.to
        )}`,
        { credentials: "include" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !Array.isArray(data.slots)) {
        throw new Error(data.error || "Failed to load doctor calendar");
      }
      setSlots(data.slots as DoctorCalendarSlot[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load calendar");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      setError(null);
      try {
        const [doctorsRes, profileRes] = await Promise.all([
          fetch("/api/clinic/doctors", { credentials: "include" }),
          fetch("/api/user/profile", { credentials: "include" }),
        ]);
        const data = await doctorsRes.json().catch(() => ({}));
        if (!doctorsRes.ok || !Array.isArray(data.doctors)) {
          throw new Error(data.error || "Failed to load doctors");
        }
        const profileData = (await profileRes.json().catch(() => ({}))) as {
          user?: { phone?: string | null; phoneCountryCode?: string | null };
        };
        if (!alive) return;
        setDoctors(data.doctors as DoctorRow[]);
        setDoctorId((prev) => prev ?? (data.doctors[0]?.id ?? null));
        const phone = profileData.user?.phone ?? null;
        const cc = profileData.user?.phoneCountryCode ?? "+91";
        setPatientHasPhone(patientHasPhoneOnFile(phone));
        setBookingPhoneCountryCode(cc);
        setBookingPhone(phone ?? "");
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Failed to load doctors");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!doctorId) return;
    void refreshCalendar(doctorId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctorId, range.from, range.to]);

  useEffect(() => {
    if (!doctorId) return;
    const id = setInterval(() => {
      void refreshCalendar(doctorId);
    }, 25_000);
    return () => clearInterval(id);
  }, [doctorId, range.from, range.to]);

  const groupedByDate = useMemo(() => {
    const map = new Map<string, DoctorCalendarSlot[]>();
    for (const s of slots) {
      const list = map.get(s.slotDate) ?? [];
      list.push(s);
      map.set(s.slotDate, list);
    }
    for (const [, list] of map) {
      list.sort((a, b) => a.slotTimeHm.localeCompare(b.slotTimeHm));
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [slots]);

  function openRequest(slot: DoctorCalendarSlot) {
    setRequestSlot(slot);
    // Keep it short by default; patient can edit.
    setIssue("Skin concern");
    setWhy("");
    setRequestModalOpen(true);
  }

  async function submitRequest() {
    if (!requestSlot || !doctorId) return;
    if (!issue.trim()) {
      setError("Please enter a short issue.");
      return;
    }
    if (!patientHasPhone) {
      const phoneCheck = validateNationalPhone(bookingPhone);
      if (!phoneCheck.ok) {
        setError(phoneCheck.message);
        return;
      }
    }
    setRequestSubmitting(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        doctorId,
        doctorSlotId: requestSlot.id,
        issue: issue.trim(),
        why: why.trim() ? why.trim() : undefined,
      };
      if (!patientHasPhone) {
        payload.phone = bookingPhone.trim();
        payload.phoneCountryCode = bookingPhoneCountryCode.trim() || "+91";
      }
      const res = await fetch("/api/appointments/requests", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = data.error as string | undefined;
        if (err === "PHONE_REQUIRED") {
          throw new Error(
            typeof data.message === "string"
              ? data.message
              : "Add your phone number below or in Profile before booking."
          );
        }
        if (err === "INVALID_PHONE") {
          throw new Error(
            typeof data.message === "string"
              ? data.message
              : "Enter a valid phone number."
          );
        }
        if (res.status === 409 && err === "SLOT_REQUEST_PENDING") {
          throw new Error(
            "Another patient already requested this slot. It will open again if the clinic declines."
          );
        }
        if (res.status === 409 && err === "SLOT_ALREADY_BOOKED") {
          throw new Error("This time is already booked.");
        }
        throw new Error(err || "Request failed");
      }
      if (!(data.request?.id || data.duplicated)) {
        throw new Error("Request failed");
      }
      if (!patientHasPhone) {
        setPatientHasPhone(true);
      }
      setRequestModalOpen(false);
      setRequestSlot(null);
      await refreshCalendar(doctorId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setRequestSubmitting(false);
    }
  }

  return (
    <div className="rounded-[22px] border border-zinc-100 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.06)] md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-zinc-900">Doctor calendar</h2>
          <p className="text-sm text-zinc-600">
            Pick a doctor and request an appointment (approval handled by clinic).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-zinc-700">Doctor</label>
          <select
            value={doctorId ?? ""}
            onChange={(e) => setDoctorId(e.target.value)}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none focus:border-[#1E1B31] focus:ring-2 focus:ring-[#1E1B31]/20"
            disabled={loading || doctors.length === 0}
          >
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="mt-4">
        {loading ? (
          <div className="py-6 text-sm text-zinc-600">Loading slots…</div>
        ) : groupedByDate.length === 0 ? (
          <div className="py-6 text-sm text-zinc-600">
            No slots yet. Clinic will feed slots via Postman.
          </div>
        ) : (
          <div className="space-y-4">
            {groupedByDate.map(([ymd, daySlots]) => {
              const dateLabel = format(new Date(`${ymd}T00:00:00`), "MMM d, yyyy");
              return (
                <div key={ymd} className="rounded-xl border border-zinc-100 bg-zinc-50/50 p-4">
                  <p className="mb-3 text-sm font-semibold text-zinc-800">{dateLabel}</p>
                  <div className="space-y-2">
                    {daySlots.map((s) => (
                      <div
                        key={s.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-3 py-2"
                      >
                        <div className="min-w-[180px]">
                          <p className="text-sm font-semibold text-zinc-900">
                            {formatSlotTimeRange(s.slotTimeHm, s.slotEndTimeHm)} ·{" "}
                            {s.title}
                          </p>
                          {s.cancelledReason ? (
                            <p className="text-xs text-zinc-600">
                              Cancelled: {s.cancelledReason}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2">
                          {s.status === "available" ? (
                            <>
                              <Clock3 className="h-4 w-4 text-[#1E1B31]" aria-hidden />
                              <button
                                type="button"
                                onClick={() => openRequest(s)}
                                className="rounded-full bg-[#1E1B31] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#F8EDEE]0"
                              >
                                Request
                              </button>
                            </>
                          ) : s.status === "requested" ? (
                            <>
                              <FileText className="h-4 w-4 text-zinc-600" aria-hidden />
                              <span className="text-xs font-semibold text-zinc-700">
                                Requested
                              </span>
                            </>
                          ) : s.status === "held" ? (
                            <>
                              <Clock3 className="h-4 w-4 text-zinc-500" aria-hidden />
                              <span className="text-xs font-semibold text-zinc-600">
                                Pending review
                              </span>
                            </>
                          ) : s.status === "booked" ? (
                            s.bookedByMe ? (
                              <>
                                <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />
                                <span className="text-xs font-semibold text-emerald-700">
                                  Your visit
                                </span>
                              </>
                            ) : (
                              <>
                                <Clock3 className="h-4 w-4 text-zinc-400" aria-hidden />
                                <span className="text-xs font-semibold text-zinc-500">
                                  Unavailable
                                </span>
                              </>
                            )
                          ) : s.status === "completed" ? (
                            <>
                              <CheckCircle2 className="h-4 w-4 text-sky-600" aria-hidden />
                              <span className="text-xs font-semibold text-sky-700">
                                Completed
                              </span>
                            </>
                          ) : (
                            <>
                              <XCircle className="h-4 w-4 text-rose-600" aria-hidden />
                              <span className="text-xs font-semibold text-rose-700">
                                Cancelled
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {requestModalOpen && requestSlot ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-[22px] border border-white bg-white p-5 shadow-[0_30px_80px_rgba(0,0,0,0.25)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-zinc-900">
                  Request appointment
                </h3>
                <p className="mt-1 text-sm text-zinc-600">
                  {requestSlot.slotDate} ·{" "}
                  {formatSlotTimeRange(
                    requestSlot.slotTimeHm,
                    requestSlot.slotEndTimeHm
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setRequestModalOpen(false);
                  setRequestSlot(null);
                }}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
              >
                Close
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {!patientHasPhone ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <div className="flex items-start gap-2">
                    <Phone className="mt-0.5 h-5 w-5 shrink-0 text-amber-800" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-amber-950">
                        Phone number required
                      </p>
                      <p className="mt-0.5 text-xs leading-snug text-amber-900/90">
                        Enter your number here or{" "}
                        <Link
                          href="/dashboard/profile"
                          className="font-semibold text-amber-950 underline"
                        >
                          add it in Profile
                        </Link>
                        .
                      </p>
                      <div className="mt-3 flex gap-2">
                        <input
                          type="text"
                          inputMode="tel"
                          value={bookingPhoneCountryCode}
                          onChange={(e) => setBookingPhoneCountryCode(e.target.value)}
                          disabled={requestSubmitting}
                          className="w-[5.5rem] shrink-0 rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-center text-sm text-slate-900 outline-none focus:border-[#1E1B31] focus:ring-2 focus:ring-[#1E1B31]/20"
                          placeholder="+91"
                          aria-label="Country code"
                        />
                        <input
                          type="tel"
                          inputMode="numeric"
                          value={bookingPhone}
                          onChange={(e) => setBookingPhone(e.target.value)}
                          disabled={requestSubmitting}
                          className="min-w-0 flex-1 rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#1E1B31] focus:ring-2 focus:ring-[#1E1B31]/20"
                          placeholder="10-digit mobile"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Issue (short)
                </label>
                <input
                  value={issue}
                  onChange={(e) => setIssue(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#1E1B31] focus:ring-2 focus:ring-[#1E1B31]/20"
                  placeholder="e.g. Acne on cheeks"
                  disabled={requestSubmitting}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Why? (keep it short)
                </label>
                <input
                  value={why}
                  onChange={(e) => setWhy(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#1E1B31] focus:ring-2 focus:ring-[#1E1B31]/20"
                  placeholder="e.g. Been 2 weeks"
                  disabled={requestSubmitting}
                />
              </div>

              {error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {error}
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => void submitRequest()}
                disabled={requestSubmitting}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-[#1E1B31] px-5 py-3 text-base font-medium text-white shadow-sm transition-colors hover:bg-[#242A5F] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Send className="h-4 w-4" aria-hidden />
                {requestSubmitting ? "Sending…" : "Send request"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

