"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { dispatchGlobalLiveRefresh, GLOBAL_LIVE_REFRESH_EVENT } from "@/src/lib/globalRefreshEvents";

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
        <h1 className="font-headline text-2xl font-bold text-[#1E1B31]">
          Appointment requests
        </h1>
        <p className="mt-1 text-sm text-[#1E1B31]/60">
          Requests from my.skinfitwellness.in. Confirm to book, or decline with a
          reason the patient will see.
        </p>
      </header>

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-[#1E1B31]/55">Loading…</p>
      ) : pending.length === 0 && rest.length === 0 ? (
        <p className="rounded-2xl bg-[#E8E7DE] px-4 py-8 text-center text-sm text-[#1E1B31]/60">
          No appointment requests yet.
        </p>
      ) : (
        <>
          {pending.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wide text-[#1E1B31]/50">
                Needs a decision ({pending.length})
              </h2>
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
            <p className="rounded-2xl bg-[#E8E7DE] px-4 py-6 text-center text-sm text-[#1E1B31]/60">
              No pending requests.
            </p>
          )}

          {rest.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wide text-[#1E1B31]/50">
                Recent
              </h2>
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

  return (
    <article className="rounded-2xl bg-white p-4 shadow-[0_1px_3px_rgba(72,64,48,0.07)]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link
            href={`/clinic/patients/${item.patientId}`}
            className="text-base font-bold text-[#1E1B31] hover:underline"
          >
            {item.patientName}
          </Link>
          {item.patientEmail ? (
            <p className="text-xs text-[#1E1B31]/50">{item.patientEmail}</p>
          ) : null}
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
            item.status === "pending"
              ? "bg-amber-100 text-amber-900"
              : item.status === "confirmed"
                ? "bg-emerald-100 text-emerald-900"
                : "bg-zinc-100 text-zinc-600"
          }`}
        >
          {statusLabel(item.status)}
        </span>
      </div>
      <dl className="mt-3 grid gap-1.5 text-sm text-[#1E1B31]">
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#1E1B31]/45">
            Preferred date
          </dt>
          <dd>{dateLabel}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#1E1B31]/45">
            Time
          </dt>
          <dd>{item.timePreferences}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#1E1B31]/45">
            Reason
          </dt>
          <dd>{item.issue}</dd>
        </div>
        {item.cancelledReason ? (
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#1E1B31]/45">
              Decline reason
            </dt>
            <dd>{item.cancelledReason}</dd>
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
                className="w-full rounded-xl border border-[#1E1B31]/15 bg-[#FAF8F5] px-3 py-2 text-sm outline-none focus:border-[#1E1B31]/40"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={onReject}
                  className="rounded-lg bg-rose-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {busy ? "Declining…" : "Decline request"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={onCancelReject}
                  className="rounded-lg px-3 py-2 text-sm font-semibold text-[#1E1B31]/70 hover:bg-[#1E1B31]/8"
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
                className="rounded-lg bg-[#1E1B31] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy ? "Confirming…" : "Confirm"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onStartReject}
                className="rounded-lg border border-[#1E1B31]/15 px-3 py-2 text-sm font-semibold text-[#1E1B31] hover:bg-[#FAF8F5] disabled:opacity-50"
              >
                Decline
              </button>
            </div>
          )}
        </div>
      ) : null}
    </article>
  );
}
