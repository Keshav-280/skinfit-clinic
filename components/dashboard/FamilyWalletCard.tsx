"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ChevronDown,
  CreditCard,
  Loader2,
  Plus,
  ShieldCheck,
  Trash2,
  UserPlus,
} from "lucide-react";
import type { FamilyWalletSnapshot } from "@/src/lib/familyWallet";

function formatCredits(n: number) {
  return new Intl.NumberFormat("en-IN").format(n);
}

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
    });
  } catch {
    return iso;
  }
}

function memberInitial(name: string) {
  return (name.trim()[0] ?? "?").toUpperCase();
}

export function FamilyWalletCard() {
  const [data, setData] = useState<FamilyWalletSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [inviteEmail, setInviteEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpHint, setOtpHint] = useState<string | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [showInvite, setShowInvite] = useState(false);
  const [showActivity, setShowActivity] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/user/family-wallet", { credentials: "include" });
      const json = (await res.json().catch(() => ({}))) as FamilyWalletSnapshot & {
        message?: string;
      };
      if (!res.ok) {
        setError(json.message ?? "Could not load family card.");
        return;
      }
      setData(json);
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const t = window.setTimeout(() => setResendSeconds((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [resendSeconds]);

  async function sendOtp() {
    setInviteBusy(true);
    setOtpHint(null);
    setError(null);
    try {
      const res = await fetch("/api/user/family-wallet/invite/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        message?: string;
        cooldownSeconds?: number;
        retryAfterSeconds?: number;
      };
      if (!res.ok) {
        setError(json.message ?? "Could not send code.");
        if (json.retryAfterSeconds) setResendSeconds(json.retryAfterSeconds);
        return;
      }
      setOtpSent(true);
      setOtp("");
      setOtpHint(json.message ?? "Code sent.");
      setResendSeconds(json.cooldownSeconds ?? 60);
    } catch {
      setError("Network error.");
    } finally {
      setInviteBusy(false);
    }
  }

  async function verifyAndLink() {
    setInviteBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/user/family-wallet/invite/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), otp: otp.trim() }),
      });
      const json = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        setError(json.message ?? "Could not link member.");
        return;
      }
      setInviteEmail("");
      setOtp("");
      setOtpSent(false);
      setShowInvite(false);
      setOtpHint(json.message ?? "Member linked.");
      await load();
    } catch {
      setError("Network error.");
    } finally {
      setInviteBusy(false);
    }
  }

  async function removeMember(memberUserId: string) {
    if (!window.confirm("Remove this family member from your card?")) return;
    setError(null);
    try {
      const res = await fetch(`/api/user/family-wallet/members/${memberUserId}`, {
        method: "DELETE",
      });
      const json = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        setError(json.message ?? "Could not remove member.");
        return;
      }
      await load();
    } catch {
      setError("Network error.");
    }
  }

  if (loading) {
    return (
      <section className="flex min-h-[100px] items-center justify-center rounded-[22px] border border-white/70 bg-white/40 p-5 shadow-[0_8px_30px_rgba(30, 27, 49,0.06)] backdrop-blur-sm">
        <Loader2 className="h-5 w-5 animate-spin text-[#1E1B31]/60" aria-hidden />
      </section>
    );
  }

  if (!data) {
    return (
      <section className="rounded-[22px] border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        {error ?? "Family card unavailable."}
      </section>
    );
  }

  const otherMembers = data.members.filter((m) => m.role !== "owner");
  const hasActivity = data.recentTransactions.length > 0;

  return (
    <section className="rounded-[22px] border border-white/70 bg-white/40 p-4 shadow-[0_8px_30px_rgba(30, 27, 49,0.06)] backdrop-blur-sm sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[#1E1B31] text-white shadow-sm">
          <CreditCard className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#64748B]">
              Family card
            </p>
            <span className="inline-flex items-center gap-1 rounded-full bg-[#1E1B31]/8 px-2 py-0.5 text-[10px] font-semibold text-[#1E1B31]">
              <ShieldCheck className="h-3 w-3" aria-hidden />
              Clinic verified
            </span>
          </div>
          <p className="mt-1 text-2xl font-extrabold tracking-tight text-[#1F2A44]">
            {formatCredits(data.balanceCredits)}
            <span className="ml-1.5 text-sm font-semibold text-[#64748B]">credits</span>
          </p>
          {!data.isOwner ? (
            <p className="mt-0.5 text-xs text-[#64748B]">Held by {data.ownerName}</p>
          ) : null}
        </div>
      </div>

      {(error || otpHint) && (
        <div className="mt-3">
          {error ? (
            <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-800">
              {error}
            </p>
          ) : null}
          {otpHint && !error ? (
            <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              {otpHint}
            </p>
          ) : null}
        </div>
      )}

      <div className="mt-4 border-t border-[#F0EAE2]/80 pt-4">
        <p className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#64748B]">
          Members · {data.members.length}
        </p>
        <ul className="space-y-1.5">
          {data.members.map((m) => (
            <li
              key={m.userId}
              className="flex items-center gap-2.5 rounded-[14px] border border-white/70 bg-white/45 px-2.5 py-2"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1E1B31]/10 text-xs font-bold text-[#1E1B31]">
                {memberInitial(m.name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[#1F2A44]">
                  {m.name}
                  {m.role === "owner" ? (
                    <span className="ml-1.5 text-[10px] font-bold uppercase text-[#64748B]">
                      · Holder
                    </span>
                  ) : null}
                </p>
                <p className="truncate text-xs text-[#64748B]">{m.email}</p>
              </div>
              {data.isOwner && m.role === "member" ? (
                <button
                  type="button"
                  onClick={() => void removeMember(m.userId)}
                  className="shrink-0 rounded-lg p-1.5 text-[#94A3B8] transition hover:bg-red-50 hover:text-red-600"
                  aria-label={`Remove ${m.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </div>

      {data.isOwner ? (
        <div className="mt-3">
          {!showInvite ? (
            <button
              type="button"
              onClick={() => {
                setShowInvite(true);
                setOtpHint(null);
                setError(null);
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#1E1B31]/15 bg-white/60 px-3 py-1.5 text-xs font-semibold text-[#1E1B31] transition hover:bg-[#1E1B31]/5"
            >
              <UserPlus className="h-3.5 w-3.5" aria-hidden />
              {otherMembers.length === 0 ? "Add family member" : "Link another member"}
            </button>
          ) : (
            <div className="rounded-[14px] border border-[#E5E7EB] bg-white/60 p-3">
              <p className="mb-2 text-xs text-[#64748B]">
                They need an existing SkinFit account. We&apos;ll email them a code.
              </p>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => {
                  setInviteEmail(e.target.value);
                  setOtpSent(false);
                }}
                placeholder="family@email.com"
                disabled={inviteBusy}
                className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#1F2A44] placeholder:text-[#94A3B8] outline-none focus:border-[#1E1B31]/40 focus:ring-2 focus:ring-[#1E1B31]/10"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void sendOtp()}
                  disabled={inviteBusy || !inviteEmail.trim() || resendSeconds > 0}
                  className="rounded-lg bg-[#1E1B31] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#242A5F] disabled:opacity-50"
                >
                  {inviteBusy ? "…" : resendSeconds > 0 ? `Resend in ${resendSeconds}s` : "Send code"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowInvite(false);
                    setOtpSent(false);
                    setInviteEmail("");
                    setOtp("");
                  }}
                  className="rounded-lg px-3 py-2 text-xs font-semibold text-[#64748B] transition hover:bg-[#F1F5F9]"
                >
                  Cancel
                </button>
              </div>
              {otpSent ? (
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otp}
                    onChange={(e) =>
                      setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    placeholder="6-digit code"
                    disabled={inviteBusy}
                    className="min-w-0 flex-1 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#1F2A44] placeholder:text-[#94A3B8] outline-none focus:border-[#1E1B31]/40 focus:ring-2 focus:ring-[#1E1B31]/10"
                  />
                  <button
                    type="button"
                    onClick={() => void verifyAndLink()}
                    disabled={inviteBusy || otp.length < 6}
                    className="inline-flex shrink-0 items-center justify-center gap-1 rounded-lg bg-[#1E1B31] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#242A5F] disabled:opacity-50"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden />
                    Link
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>
      ) : (
        <p className="mt-3 text-xs leading-relaxed text-[#64748B]">
          Visit the clinic to use shared credits — staff deduct after your visit.
        </p>
      )}

      {hasActivity ? (
        <div className="mt-3 border-t border-[#F0EAE2]/80 pt-3">
          <button
            type="button"
            onClick={() => setShowActivity((v) => !v)}
            className="flex w-full items-center justify-between gap-2 text-left text-xs font-semibold text-[#64748B] transition hover:text-[#1F2A44]"
          >
            <span>Recent activity</span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 transition ${showActivity ? "rotate-180" : ""}`}
              aria-hidden
            />
          </button>
          {showActivity ? (
            <ul className="mt-2 space-y-1">
              {data.recentTransactions.map((tx) => (
                <li
                  key={tx.id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-white/50 px-2.5 py-1.5 text-xs"
                >
                  <div className="min-w-0">
                    <span className="font-medium capitalize text-[#1F2A44]">{tx.type}</span>
                    {tx.patientName ? (
                      <span className="text-[#94A3B8]"> · {tx.patientName}</span>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-right">
                    <span
                      className={
                        tx.amountCredits >= 0
                          ? "font-semibold text-emerald-600"
                          : "font-semibold text-[#1F2A44]"
                      }
                    >
                      {tx.amountCredits >= 0 ? "+" : ""}
                      {formatCredits(tx.amountCredits)}
                    </span>
                    <p className="text-[10px] text-[#94A3B8]">{formatWhen(tx.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
