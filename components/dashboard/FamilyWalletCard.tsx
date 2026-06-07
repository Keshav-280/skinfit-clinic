"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CreditCard,
  Loader2,
  Plus,
  ShieldCheck,
  Trash2,
  Users,
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
      year: "numeric",
    });
  } catch {
    return iso;
  }
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
      <section className="flex min-h-[140px] items-center justify-center rounded-[22px] border border-white/70 bg-gradient-to-br from-[#2C3E6B] to-[#1a2544] p-6 text-white shadow-[0_12px_40px_rgba(44,62,107,0.22)]">
        <Loader2 className="h-6 w-6 animate-spin opacity-80" aria-hidden />
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

  return (
    <section className="overflow-hidden rounded-[22px] border border-white/70 shadow-[0_12px_40px_rgba(44,62,107,0.18)]">
      <div className="relative bg-gradient-to-br from-[#2C3E6B] via-[#344875] to-[#1a2544] p-5 text-white sm:p-6">
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/3 h-24 w-24 rounded-full bg-[#4CAF50]/20 blur-2xl" />

        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-white/75">
              <CreditCard className="h-4 w-4" aria-hidden />
              <span className="text-[11px] font-bold uppercase tracking-[0.14em]">
                SkinFit Family Card
              </span>
            </div>
            <p className="mt-3 text-4xl font-extrabold tracking-tight sm:text-[2.75rem]">
              {formatCredits(data.balanceCredits)}
              <span className="ml-2 text-lg font-semibold text-white/70">credits</span>
            </p>
            <p className="mt-1 text-sm text-white/70">
              {data.isOwner
                ? "Top up at the clinic — shared with linked family"
                : `Shared card · held by ${data.ownerName}`}
            </p>
          </div>
          <div className="rounded-2xl border border-white/20 bg-white/10 px-3 py-2 backdrop-blur-sm">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-white/80">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              Clinic verified
            </div>
            <p className="mt-0.5 text-xs text-white/65">Offline top-up · portal deduct</p>
          </div>
        </div>
      </div>

      <div className="space-y-4 bg-white/90 p-4 backdrop-blur-sm sm:p-5">
        {error ? (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        ) : null}
        {otpHint && !error ? (
          <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {otpHint}
          </p>
        ) : null}

        <div>
          <div className="mb-2 flex items-center gap-2">
            <Users className="h-4 w-4 text-[#2C3E6B]" aria-hidden />
            <h3 className="text-sm font-bold text-[#1F2A44]">Family members</h3>
          </div>
          <ul className="space-y-2">
            {data.members.map((m) => (
              <li
                key={m.userId}
                className="flex items-center justify-between gap-2 rounded-xl border border-[#E8EFE6] bg-[#F8FBF7] px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#1F2A44]">
                    {m.name}
                    {m.role === "owner" ? (
                      <span className="ml-2 rounded-full bg-[#2C3E6B]/10 px-2 py-0.5 text-[10px] font-bold uppercase text-[#2C3E6B]">
                        Holder
                      </span>
                    ) : null}
                  </p>
                  <p className="truncate text-xs text-[#64748B]">{m.email}</p>
                </div>
                {data.isOwner && m.role === "member" ? (
                  <button
                    type="button"
                    onClick={() => void removeMember(m.userId)}
                    className="shrink-0 rounded-lg p-2 text-[#64748B] transition hover:bg-red-50 hover:text-red-600"
                    aria-label={`Remove ${m.name}`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>

        {data.isOwner ? (
          <div className="rounded-xl border border-dashed border-[#2C3E6B]/25 bg-[#F2F9F2]/60 p-3 sm:p-4">
            <p className="mb-3 text-xs font-semibold text-[#2C3E6B]">
              Link a family member by email (they must already have a SkinFit account)
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => {
                  setInviteEmail(e.target.value);
                  setOtpSent(false);
                }}
                placeholder="family@email.com"
                disabled={inviteBusy}
                className="min-w-0 flex-1 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#2C3E6B]/40 focus:ring-2 focus:ring-[#2C3E6B]/15"
              />
              <button
                type="button"
                onClick={() => void sendOtp()}
                disabled={inviteBusy || !inviteEmail.trim() || resendSeconds > 0}
                className="shrink-0 rounded-lg bg-[#2C3E6B]/10 px-4 py-2.5 text-sm font-semibold text-[#2C3E6B] transition hover:bg-[#2C3E6B]/15 disabled:opacity-50"
              >
                {inviteBusy ? "…" : resendSeconds > 0 ? `${resendSeconds}s` : "Send OTP"}
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
                  placeholder="6-digit code from their email"
                  disabled={inviteBusy}
                  className="min-w-0 flex-1 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#2C3E6B]/40 focus:ring-2 focus:ring-[#2C3E6B]/15"
                />
                <button
                  type="button"
                  onClick={() => void verifyAndLink()}
                  disabled={inviteBusy || otp.length < 6}
                  className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#2C3E6B] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#243456] disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  Link member
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-xs leading-relaxed text-[#64748B]">
            Credits are shared from {data.ownerName}&apos;s family card. Visit the
            clinic to use credits — staff will deduct after confirming your visit.
          </p>
        )}

        {data.recentTransactions.length > 0 ? (
          <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-[#64748B]">
              Recent activity
            </h3>
            <ul className="space-y-1.5">
              {data.recentTransactions.map((tx) => (
                <li
                  key={tx.id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-[#F8FAFC] px-3 py-2 text-xs"
                >
                  <div className="min-w-0">
                    <span className="font-semibold capitalize text-[#1F2A44]">
                      {tx.type}
                    </span>
                    {tx.patientName ? (
                      <span className="text-[#64748B]"> · {tx.patientName}</span>
                    ) : null}
                    {tx.note ? (
                      <p className="truncate text-[#94A3B8]">{tx.note}</p>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-right">
                    <span
                      className={
                        tx.amountCredits >= 0
                          ? "font-bold text-emerald-600"
                          : "font-bold text-[#1F2A44]"
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
          </div>
        ) : null}
      </div>
    </section>
  );
}
