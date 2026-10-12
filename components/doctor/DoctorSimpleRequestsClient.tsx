"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { dispatchGlobalLiveRefresh, GLOBAL_LIVE_REFRESH_EVENT } from "@/src/lib/globalRefreshEvents";
import { CLINIC } from "@/components/doctor/clinicUi";

type RequestItem = {
  id: string;
  patientId: string;
  patientName: string;
  patientEmail: string | null;
  preferredDateYmd: string;
  issue: string;
  daysAffected: number | null;
  timePreferences: string;
  status: "pending" | "confirmed" | "cancelled" | "declined";
  cancelledReason: string | null;
  createdAt: string;
};

function statusLabel(status: RequestItem["status"]) {
  switch (status) {
    case "pending":
      return "Pending";
    case "confirmed":
      return "Confirmed";
    case "declined":
      return "Declined";
    default:
      return "Cancelled";
  }
}

export function DoctorSimpleRequestsClient() {
  const [items, setItems] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/doctor/schedule-requests", {
        credentials: "include",
        cache: "no-store",
      });
      const data = (await res.json()) as {
        success?: boolean;
        items?: RequestItem[];
      };
      if (!res.ok || !data.success) {
        throw new Error("Could not load requests.");
      }
      setItems(data.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load requests.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const onRefresh = () => void load();
    window.addEventListener(GLOBAL_LIVE_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(GLOBAL_LIVE_REFRESH_EVENT, onRefresh);
  }, [load]);

  async function confirm(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/doctor/schedule-requests/${id}`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "confirm" }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Could not confirm.");
      setRejectingId(null);
      dispatchGlobalLiveRefresh();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not confirm.");
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id: string) {
    if (reason.trim().length < 2) {
      setError("Add a short reason before declining.");
      return;
    }
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/doctor/schedule-requests/${id}`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "reject", reason: reason.trim() }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Could not decline.");
      setRejectingId(null);
      setReason("");
      dispatchGlobalLiveRefresh();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not decline.");
    } finally {
      setBusyId(null);
    }
  }

  const pending = items.filter((i) => i.status === "pending");
  const rest = items.filter((i) => i.status !== "pending");

  return (
    <div className="space-y-6">
      <header>
        <h1 className={CLINIC.h1}>Appointment requests</h1>
        <p className={`mt-1 ${CLINIC.muted}`}>
          Requests from my.skinfitwellness.in. Confirm to book, or decline with a
          reason the patient will see.
        </p>
      </header>

      {error ? (
        <p className={CLINIC.noteError}>{error}</p>
      ) : null}

      {loading ? (
        <p className={CLINIC.muted}>Loading…</p>
      ) : pending.length === 0 && rest.length === 0 ? (
        <p className={`${CLINIC.card} px-4 py-10 text-center ${CLINIC.muted}`}>
          No appointment requests yet.
        </p>
      ) : (
        <>
          {pending.length > 0 ? (
            <section className="space-y-3">
              <h2 className={CLINIC.label}>Needs a decision ({pending.length})</h2>
              {pending.map((item) => (
                <RequestCard
                  key={item.id}
                  item={item}
                  busy={busyId === item.id}
                  rejecting={rejectingId === item.id}
                  reason={reason}
                  onReason={setReason}
                  onConfirm={() => void confirm(item.id)}
                  onStartReject={() => {
                    setRejectingId(item.id);
                    setReason("");
                  }}
                  onCancelReject={() => {
                    setRejectingId(null);
                    setReason("");
                  }}
                  onReject={() => void reject(item.id)}
                />
              ))}
            </section>
          ) : (
            <p className={`${CLINIC.card} px-4 py-8 text-center ${CLINIC.muted}`}>
              No pending requests.
            </p>
          )}

          {rest.length > 0 ? (
            <section className="space-y-3">
              <h2 className={CLINIC.label}>Recent</h2>
              {rest.map((item) => (
                <RequestCard key={item.id} item={item} readOnly />
              ))}
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

function RequestCard({
  item,
  busy,
  rejecting,
  reason,
  onReason,
  onConfirm,
  onStartReject,
  onCancelReject,
  onReject,
  readOnly,
}: {
  item: RequestItem;
  busy?: boolean;
  rejecting?: boolean;
  reason?: string;
  onReason?: (v: string) => void;
  onConfirm?: () => void;
  onStartReject?: () => void;
  onCancelReject?: () => void;
  onReject?: () => void;
  readOnly?: boolean;
}) {
  let dateLabel = item.preferredDateYmd;
  try {
    dateLabel = format(parseISO(`${item.preferredDateYmd}T12:00:00`), "EEE, d MMM yyyy");
  } catch {
    /* keep ymd */
  }

  let dayNum = "";
  let monthLabel = "";
  try {
    const d = parseISO(`${item.preferredDateYmd}T12:00:00`);
    dayNum = format(d, "d");
    monthLabel = format(d, "MMM");
  } catch {
    dayNum = "";
  }

  const chipClass =
    item.status === "pending"
      ? CLINIC.chipBlush
      : item.status === "confirmed"
        ? CLINIC.chip
        : CLINIC.chipSand;

  return (
    <article className={`${CLINIC.card} p-4 sm:p-5`}>
      <div className="flex gap-4">
        <div
          className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-[#F0EAE2]"
          aria-hidden
        >
          <span className="font-headline text-2xl font-semibold leading-none text-[#1E1B31]">
            {dayNum || "-"}
          </span>
          <span className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-[#5B66A1]">
            {monthLabel}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <Link
                href={`/clinic/patients/${item.patientId}`}
                className="text-base font-semibold text-[#1E1B31] hover:underline"
              >
                {item.patientName}
              </Link>
              {item.patientEmail ? (
                <p className="truncate text-xs text-[#5B66A1]">{item.patientEmail}</p>
              ) : null}
            </div>
            <span className={chipClass}>{statusLabel(item.status)}</span>
          </div>

          <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm text-[#1E1B31] sm:grid-cols-2">
            <div>
              <dt className={CLINIC.label}>Preferred date</dt>
              <dd className="mt-0.5">{dateLabel}</dd>
            </div>
            <div>
              <dt className={CLINIC.label}>Time</dt>
              <dd className="mt-0.5">{item.timePreferences}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className={CLINIC.label}>Reason</dt>
              <dd className="mt-0.5">{item.issue}</dd>
            </div>
            {item.cancelledReason ? (
              <div className="sm:col-span-2">
                <dt className={CLINIC.label}>Decline reason</dt>
                <dd className="mt-0.5">{item.cancelledReason}</dd>
              </div>
            ) : null}
          </dl>

          {!readOnly && item.status === "pending" ? (
            <div className="mt-4 space-y-2">
              {rejecting ? (
                <>
                  <textarea
                    value={reason}
                    onChange={(e) => onReason?.(e.target.value)}
                    rows={3}
                    placeholder="Reason the patient will see"
                    className={CLINIC.input}
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={onReject}
                      className={CLINIC.btnBlush}
                    >
                      {busy ? "Declining…" : "Decline request"}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={onCancelReject}
                      className={CLINIC.btnGhost}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={onConfirm}
                    className={CLINIC.btnPrimary}
                  >
                    {busy ? "Confirming…" : "Confirm"}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={onStartReject}
                    className={CLINIC.btnGhost}
                  >
                    Decline
                  </button>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}
