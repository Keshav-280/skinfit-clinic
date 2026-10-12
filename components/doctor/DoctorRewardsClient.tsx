"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Gift, Loader2, Search, X } from "lucide-react";
import { CLINIC } from "@/components/doctor/clinicUi";
import { canRedeemOnBill, pointsForSpend, REWARD_RULES } from "@/src/lib/rewards/rules";

type Hit = { id: string; name: string; email: string; phone: string | null; balance: number };
type Claim = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  claimedAt: string;
};
type Bill = {
  id: string;
  services: string;
  billAmount: number;
  pointsRedeemed: number;
  amountPaid: number;
  pointsEarned: number;
  voided: boolean;
  createdAt: string;
};
type HistoryRow = { id: string; points: number; source: string; note: string | null; createdAt: string };
type PatientPayload = {
  patient: { id: string; name: string; email: string; phone: string | null };
  summary: {
    balance: number;
    referralCode: string;
    reviewClaim: "none" | "pending" | "approved" | "rejected";
    history: HistoryRow[];
  };
  bills: Bill[];
};

const INPUT = CLINIC.input;
const LABEL = "mb-1.5 block text-xs font-bold uppercase tracking-wide text-[#5B66A1]";

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const when = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as { message?: string };
  return { ok: res.ok, json };
}

export function DoctorRewardsClient({
  initialPatientId,
  embedded = false,
}: {
  initialPatientId?: string;
  embedded?: boolean;
}) {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [claimBusy, setClaimBusy] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [hits, setHits] = useState<Hit[]>([]);
  const [selected, setSelected] = useState<PatientPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [services, setServices] = useState("");
  const [billAmount, setBillAmount] = useState("");
  const [usePoints, setUsePoints] = useState("");
  const [saving, setSaving] = useState(false);

  const [reviewBusy, setReviewBusy] = useState(false);
  const [adjPoints, setAdjPoints] = useState("");
  const [adjReason, setAdjReason] = useState("");
  const [adjBusy, setAdjBusy] = useState(false);

  const loadClaims = useCallback(async () => {
    try {
      const res = await fetch("/api/doctor/rewards/review-claims", { cache: "no-store" });
      if (res.ok) setClaims(((await res.json()) as { claims: Claim[] }).claims);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void loadClaims();
  }, [loadClaims]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      return;
    }
    const t = window.setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/doctor/rewards/search?q=${encodeURIComponent(q)}`);
        const json = (await res.json().catch(() => ({}))) as { patients?: Hit[] };
        setHits(json.patients ?? []);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => window.clearTimeout(t);
  }, [query]);

  const loadPatient = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/doctor/rewards/patients/${id}`, { cache: "no-store" });
      const json = (await res.json().catch(() => ({}))) as PatientPayload & { message?: string };
      if (!res.ok) {
        setError(json.message ?? "Could not load patient.");
        setSelected(null);
        return;
      }
      setSelected(json);
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialPatientId) void loadPatient(initialPatientId);
  }, [initialPatientId, loadPatient]);

  function pick(h: Hit) {
    setQuery("");
    setHits([]);
    setNotice(null);
    setServices("");
    setBillAmount("");
    setUsePoints("");
    void loadPatient(h.id);
  }

  async function decide(claimId: string, action: "approve" | "reject") {
    setClaimBusy(claimId);
    setError(null);
    const { ok, json } = await postJson(`/api/doctor/rewards/review-claims/${claimId}`, { action });
    setClaimBusy(null);
    if (!ok) setError(json.message ?? "Could not update the claim.");
    else setNotice(action === "approve" ? `Approved: ${REWARD_RULES.googleReviewPoints} points added.` : "Claim rejected.");
    await loadClaims();
    if (selected) await loadPatient(selected.patient.id);
  }

  const bill = Number(billAmount);
  const billValid = Number.isInteger(bill) && bill > 0;
  const redeemAllowed = billValid && canRedeemOnBill(bill);
  const redeemNum = usePoints === "" ? 0 : Number(usePoints);
  const maxUsable = selected && billValid ? Math.min(selected.summary.balance, bill) : 0;
  const paying = billValid ? bill - (Number.isInteger(redeemNum) ? redeemNum : 0) : 0;
  const willEarn = billValid && paying > 0 ? pointsForSpend(paying) : 0;

  async function saveBill(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    const { ok, json } = await postJson("/api/doctor/rewards/bills", {
      patientId: selected.patient.id,
      services,
      billAmount: bill,
      pointsRedeemed: redeemNum || 0,
    });
    setSaving(false);
    if (!ok) {
      setError(json.message ?? "Could not save the bill.");
      return;
    }
    setNotice(
      `Bill saved. ${redeemNum > 0 ? `${redeemNum} points used. ` : ""}${willEarn > 0 ? `${willEarn} points earned.` : ""}`
    );
    setServices("");
    setBillAmount("");
    setUsePoints("");
    await loadPatient(selected.patient.id);
  }

  async function markReview() {
    if (!selected) return;
    setReviewBusy(true);
    setError(null);
    setNotice(null);
    const { ok, json } = await postJson(
      `/api/doctor/rewards/patients/${selected.patient.id}/google-review`,
      {}
    );
    setReviewBusy(false);
    if (!ok) {
      setError(json.message ?? "Could not save.");
    } else {
      setNotice(`Google review confirmed: ${REWARD_RULES.googleReviewPoints} points added.`);
    }
    await loadPatient(selected.patient.id);
    await loadClaims();
  }

  async function voidBill(id: string) {
    if (!selected) return;
    if (!window.confirm("Void this bill? The points it earned will be removed and any points used will be returned.")) return;
    setError(null);
    const { ok, json } = await postJson(`/api/doctor/rewards/bills/${id}/void`, {});
    if (!ok) setError(json.message ?? "Could not void the bill.");
    else setNotice("Bill voided.");
    await loadPatient(selected.patient.id);
  }

  async function adjust(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setAdjBusy(true);
    setError(null);
    setNotice(null);
    const { ok, json } = await postJson("/api/doctor/rewards/adjust", {
      patientId: selected.patient.id,
      points: Number(adjPoints),
      reason: adjReason,
    });
    setAdjBusy(false);
    if (!ok) {
      setError(json.message ?? "Could not adjust points.");
      return;
    }
    setNotice("Points adjusted.");
    setAdjPoints("");
    setAdjReason("");
    await loadPatient(selected.patient.id);
  }

  return (
    <div className="space-y-6">
      {!embedded ? (
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#1E1B31] sm:text-[1.65rem]">
          Patient rewards
        </h1>
        <p className="mt-1 text-sm text-[#5B66A1]">
          1 point = ₹1. Patients earn 0.5% of what they pay, and can use points on bills of{" "}
          {inr(REWARD_RULES.minBillToRedeem)} or more.
        </p>
      </div>

      ) : null}

      {error ? (
        <p role="alert" className="rounded-xl bg-[#F8EDEE] px-4 py-3 text-sm text-[#1E1B31]">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="rounded-xl bg-[#E8ECFC] px-4 py-3 text-sm text-[#1E1B31]">
          {notice}
        </p>
      ) : null}

      {!embedded ? (
        <>
      <div className={`${CLINIC.card} p-4 sm:p-5`}>
        <h2 className="text-sm font-bold text-[#1E1B31]">
          Google reviews waiting for approval{claims.length ? ` (${claims.length})` : ""}
        </h2>
        <p className="mt-0.5 text-xs text-[#5B66A1]">
          Check the review on Google, then approve to give {REWARD_RULES.googleReviewPoints} points.
        </p>
        {claims.length === 0 ? (
          <p className="mt-3 text-sm text-[#5B66A1]">Nothing waiting.</p>
        ) : (
          <ul className="mt-3 divide-y divide-[#E4E6F0]">
            {claims.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#1E1B31]">{c.name}</p>
                  <p className="text-xs text-[#5B66A1]">
                    {[c.phone, c.email].filter(Boolean).join("  |  ")} &middot; claimed {when(c.claimedAt)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={claimBusy === c.id}
                    onClick={() => void decide(c.id, "approve")}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#1E1B31] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    <Check className="h-3.5 w-3.5" /> Approve
                  </button>
                  <button
                    type="button"
                    disabled={claimBusy === c.id}
                    onClick={() => void decide(c.id, "reject")}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#E4E6F0] px-3 py-2 text-xs font-semibold text-[#1E1B31]/80 disabled:opacity-50"
                  >
                    <X className="h-3.5 w-3.5" /> Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={`${CLINIC.card} p-4 sm:p-5`}>
        <label className={LABEL} htmlFor="rewards-search">
          Find a patient
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5B66A1]" />
          <input
            id="rewards-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name, email or mobile number"
            className={`${INPUT} pl-10`}
          />
        </div>
        {searching ? (
          <p className="mt-2 flex items-center gap-2 text-xs text-[#5B66A1]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…
          </p>
        ) : null}
        {hits.length > 0 ? (
          <ul className="mt-2 divide-y divide-[#E4E6F0] rounded-xl border border-[#E4E6F0] bg-[#FAF8F5]">
            {hits.map((h) => (
              <li key={h.id}>
                <button
                  type="button"
                  onClick={() => pick(h)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition hover:bg-[#FAF8F5]"
                >
                  <span className="min-w-0">
                    <span className="font-semibold text-[#1E1B31]">{h.name}</span>
                    <span className="block truncate text-xs text-[#5B66A1]">
                      {[h.phone, h.email].filter(Boolean).join("  |  ")}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-bold text-[#1E1B31]">{h.balance} pts</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

        </>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-[#1E1B31]" />
        </div>
      ) : null}

      {selected && !loading ? (
        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-5">
            <div className={`${CLINIC.card} overflow-hidden`}>
              <div className="bg-[#1E1B31] p-5 text-white">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white/70">
                  <Gift className="h-4 w-4" /> {selected.patient.name}
                </p>
                <p className="mt-2 text-4xl font-extrabold">
                  {selected.summary.balance.toLocaleString("en-IN")}
                  <span className="ml-2 text-base font-medium text-white/70">points</span>
                </p>
                <p className="mt-1 text-xs text-white/60">
                  {[selected.patient.phone, selected.patient.email].filter(Boolean).join("  |  ")} &middot; code{" "}
                  {selected.summary.referralCode}
                </p>
              </div>

              <form onSubmit={saveBill} className="space-y-4 p-5">
                <h3 className="text-sm font-bold text-[#1E1B31]">Record a visit</h3>
                <div>
                  <label className={LABEL} htmlFor="r-services">
                    Service / treatment
                  </label>
                  <input
                    id="r-services"
                    value={services}
                    onChange={(e) => setServices(e.target.value)}
                    maxLength={500}
                    placeholder="e.g. Hydrafacial, PRP session"
                    className={INPUT}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={LABEL} htmlFor="r-amount">
                      Total bill (₹)
                    </label>
                    <input
                      id="r-amount"
                      inputMode="numeric"
                      value={billAmount}
                      onChange={(e) => {
                        setBillAmount(e.target.value.replace(/\D/g, ""));
                        setUsePoints("");
                      }}
                      placeholder="0"
                      className={INPUT}
                    />
                  </div>
                  <div>
                    <label className={LABEL} htmlFor="r-use">
                      Points to use
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="r-use"
                        inputMode="numeric"
                        disabled={!redeemAllowed || selected.summary.balance === 0}
                        value={usePoints}
                        onChange={(e) =>
                          setUsePoints(
                            String(Math.min(maxUsable, Number(e.target.value.replace(/\D/g, "") || 0))).replace(/^0$/, "")
                          )
                        }
                        placeholder="0"
                        className={`${INPUT} disabled:bg-[#FAF8F5]`}
                      />
                      <button
                        type="button"
                        disabled={!redeemAllowed || maxUsable <= 0}
                        onClick={() => setUsePoints(String(maxUsable))}
                        className="shrink-0 rounded-xl border border-[#E4E6F0] px-3 text-xs font-semibold text-[#1E1B31]/80 disabled:opacity-40"
                      >
                        Use max
                      </button>
                    </div>
                    {billValid && !redeemAllowed ? (
                      <p className="mt-1 text-[11px] text-[#5B66A1]">
                        Points need a bill of {inr(REWARD_RULES.minBillToRedeem)} or more.
                      </p>
                    ) : null}
                  </div>
                </div>

                {billValid ? (
                  <div className="rounded-xl bg-[#FAF8F5] px-4 py-3 text-sm text-[#1E1B31]/80">
                    Patient pays <strong>{inr(paying)}</strong>
                    {redeemNum > 0 ? ` (after ${inr(redeemNum)} in points)` : ""}. They will earn{" "}
                    <strong>{willEarn} points</strong>.
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={saving || !services.trim() || !billValid}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#1E1B31] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Save bill
                </button>
              </form>
            </div>

            <div className={`${CLINIC.card} flex flex-wrap items-center justify-between gap-3 p-5`}>
              <div>
                <h3 className="text-sm font-bold text-[#1E1B31]">Google review</h3>
                <p className="mt-0.5 text-xs text-[#5B66A1]">
                  {selected.summary.reviewClaim === "approved"
                    ? `Confirmed. ${REWARD_RULES.googleReviewPoints} points given.`
                    : selected.summary.reviewClaim === "pending"
                      ? "The patient says they posted a review. Check it on Google, then confirm."
                      : `Not confirmed yet. Confirming gives ${REWARD_RULES.googleReviewPoints} points.`}
                </p>
              </div>
              {selected.summary.reviewClaim !== "approved" ? (
                <button
                  type="button"
                  disabled={reviewBusy}
                  onClick={() => void markReview()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#1E1B31] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  <Check className="h-4 w-4" />
                  {reviewBusy ? "Saving…" : "Mark review as done"}
                </button>
              ) : null}
            </div>

            <div className={`${CLINIC.card} p-5`}>
              <h3 className="text-sm font-bold text-[#1E1B31]">Recent bills</h3>
              {selected.bills.length === 0 ? (
                <p className="mt-2 text-sm text-[#5B66A1]">No bills recorded yet.</p>
              ) : (
                <ul className="mt-2 divide-y divide-[#E4E6F0]">
                  {selected.bills.map((b) => (
                    <li key={b.id} className="flex items-start justify-between gap-3 py-3">
                      <div className={`min-w-0 ${b.voided ? "opacity-50" : ""}`}>
                        <p className="text-sm font-semibold text-[#1E1B31]">
                          {b.services}
                          {b.voided ? " (voided)" : ""}
                        </p>
                        <p className="text-xs text-[#5B66A1]">
                          {when(b.createdAt)} &middot; bill {inr(b.billAmount)}
                          {b.pointsRedeemed ? ` · ${b.pointsRedeemed} pts used` : ""} &middot; earned{" "}
                          {b.pointsEarned} pts
                        </p>
                      </div>
                      {!b.voided ? (
                        <button
                          type="button"
                          onClick={() => void voidBill(b.id)}
                          className="shrink-0 text-xs font-semibold text-[#A05E6D] hover:underline"
                        >
                          Void
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="space-y-5">
            <form onSubmit={adjust} className={`${CLINIC.card} space-y-3 p-5`}>
              <h3 className="text-sm font-bold text-[#1E1B31]">Adjust points</h3>
              <p className="text-xs text-[#5B66A1]">
                For corrections only. Use a minus sign to remove points. Every change is logged with your name.
              </p>
              <input
                value={adjPoints}
                onChange={(e) => setAdjPoints(e.target.value.replace(/[^\d-]/g, ""))}
                placeholder="e.g. 50 or -50"
                className={INPUT}
              />
              <input
                value={adjReason}
                onChange={(e) => setAdjReason(e.target.value)}
                maxLength={200}
                placeholder="Reason"
                className={INPUT}
              />
              <button
                type="submit"
                disabled={adjBusy || !adjPoints || !adjReason.trim()}
                className="rounded-xl border border-[#E4E6F0] px-4 py-2 text-sm font-semibold text-[#1E1B31] disabled:opacity-50"
              >
                {adjBusy ? "Saving…" : "Apply"}
              </button>
            </form>

            <div className={`${CLINIC.card} p-5`}>
              <h3 className="text-sm font-bold text-[#1E1B31]">Points history</h3>
              {selected.summary.history.length === 0 ? (
                <p className="mt-2 text-sm text-[#5B66A1]">No points yet.</p>
              ) : (
                <ul className="mt-2 divide-y divide-[#E4E6F0]">
                  {selected.summary.history.map((h) => (
                    <li key={h.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#1E1B31]">
                          {h.note ?? h.source.replace(/_/g, " ")}
                        </p>
                        <p className="text-xs text-[#5B66A1]">{when(h.createdAt)}</p>
                      </div>
                      <span className={`text-sm font-bold ${h.points > 0 ? "text-[#242A5F]" : "text-[#A05E6D]"}`}>
                        {h.points > 0 ? "+" : ""}
                        {h.points}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
