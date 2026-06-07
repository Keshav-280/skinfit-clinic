"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  CreditCard,
  Loader2,
  Search,
  Users,
} from "lucide-react";
import type { FamilyWalletSnapshot } from "@/src/lib/familyWallet";
import { doctorCardClass } from "@/components/doctor/DoctorUiPrimitives";

type SearchPatient = {
  id: string;
  name: string;
  email: string;
  balanceCredits: number;
};

type WalletPayload = {
  patient: { id: string; name: string; email: string };
  wallet: FamilyWalletSnapshot;
};

export function DoctorClinicWalletClient({
  initialPatientId,
}: {
  initialPatientId?: string;
}) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchPatient[]>([]);
  const [selected, setSelected] = useState<WalletPayload | null>(null);
  const [loadingWallet, setLoadingWallet] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState("");
  const [deductAmount, setDeductAmount] = useState("");
  const [note, setNote] = useState("");
  const [confirmDeduct, setConfirmDeduct] = useState(false);

  const loadWallet = useCallback(async (patientId: string) => {
    setLoadingWallet(true);
    setError(null);
    try {
      const res = await fetch(`/api/doctor/clinic-wallet/patients/${patientId}`);
      const json = (await res.json().catch(() => ({}))) as WalletPayload & {
        message?: string;
      };
      if (!res.ok) {
        setError(json.message ?? "Could not load wallet.");
        setSelected(null);
        return;
      }
      setSelected(json);
    } catch {
      setError("Network error.");
    } finally {
      setLoadingWallet(false);
    }
  }, []);

  useEffect(() => {
    if (initialPatientId) void loadWallet(initialPatientId);
  }, [initialPatientId, loadWallet]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = window.setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/doctor/clinic-wallet/search?q=${encodeURIComponent(query.trim())}`
        );
        const json = (await res.json().catch(() => ({}))) as {
          patients?: SearchPatient[];
        };
        setResults(json.patients ?? []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 280);
    return () => window.clearTimeout(t);
  }, [query]);

  async function topUp() {
    if (!selected) return;
    const amount = Math.round(Number(topUpAmount));
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a valid top-up amount.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/doctor/clinic-wallet/patients/${selected.patient.id}/topup`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amountCredits: amount, note }),
        }
      );
      const json = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        setError(json.message ?? "Top-up failed.");
        return;
      }
      setTopUpAmount("");
      setNote("");
      await loadWallet(selected.patient.id);
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function deduct() {
    if (!selected) return;
    const amount = Math.round(Number(deductAmount));
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a valid deduction amount.");
      return;
    }
    if (!confirmDeduct) {
      setError("Confirm the clinic visit deduction below.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/doctor/clinic-wallet/patients/${selected.patient.id}/deduct`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amountCredits: amount,
            note,
            confirm: true,
          }),
        }
      );
      const json = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        setError(json.message ?? "Deduction failed.");
        return;
      }
      setDeductAmount("");
      setNote("");
      setConfirmDeduct(false);
      await loadWallet(selected.patient.id);
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  const wallet = selected?.wallet;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-[1.65rem]">
          Clinic wallet
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Top up family credits after offline payment, or deduct when a patient
          (or linked family member) visits the clinic.
        </p>
      </div>

      <div className={`${doctorCardClass} p-4 sm:p-5`}>
        <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
          Find patient
        </label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name or email…"
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-[#2C3E6B]/40 focus:ring-2 focus:ring-[#2C3E6B]/10"
          />
        </div>
        {searching ? (
          <p className="mt-2 flex items-center gap-2 text-xs text-slate-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…
          </p>
        ) : null}
        {results.length > 0 ? (
          <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-100 bg-slate-50/50">
            {results.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setResults([]);
                    void loadWallet(p.id);
                  }}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition hover:bg-white"
                >
                  <span>
                    <span className="font-semibold text-slate-800">{p.name}</span>
                    <span className="block text-xs text-slate-500">{p.email}</span>
                  </span>
                  <span className="shrink-0 text-xs font-bold text-[#2C3E6B]">
                    {p.balanceCredits} cr
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      {loadingWallet ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-[#2C3E6B]" />
        </div>
      ) : wallet && selected ? (
        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className={`${doctorCardClass} overflow-hidden`}>
            <div className="bg-gradient-to-br from-[#2C3E6B] to-[#1a2544] p-5 text-white">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-white/70">
                    Family card balance
                  </p>
                  <p className="mt-2 text-4xl font-extrabold">
                    {wallet.balanceCredits}
                    <span className="ml-2 text-base font-medium text-white/70">
                      credits
                    </span>
                  </p>
                  <p className="mt-2 text-sm text-white/75">
                    Viewing for{" "}
                    <Link
                      href={`/doctor/patients/${selected.patient.id}`}
                      className="font-semibold underline-offset-2 hover:underline"
                    >
                      {selected.patient.name}
                    </Link>
                  </p>
                  <p className="text-xs text-white/60">
                    Holder: {wallet.ownerName}
                    {!wallet.isOwner && selected.patient.id !== wallet.members.find((m) => m.role === "owner")?.userId
                      ? " · linked member"
                      : null}
                  </p>
                </div>
                <CreditCard className="h-8 w-8 shrink-0 text-white/40" aria-hidden />
              </div>
            </div>

            <div className="p-4 sm:p-5">
              <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-700">
                <Users className="h-4 w-4" aria-hidden />
                Linked family
              </div>
              <ul className="space-y-2">
                {wallet.members.map((m) => (
                  <li
                    key={m.userId}
                    className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm"
                  >
                    <span>
                      {m.name}
                      <span className="block text-xs text-slate-500">{m.email}</span>
                    </span>
                    <span className="text-[10px] font-bold uppercase text-slate-400">
                      {m.role}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="space-y-4">
            <div className={`${doctorCardClass} p-4 sm:p-5`}>
              <div className="mb-3 flex items-center gap-2 font-bold text-emerald-700">
                <ArrowUpCircle className="h-5 w-5" aria-hidden />
                Top up (offline payment)
              </div>
              <input
                type="number"
                min={1}
                step={1}
                value={topUpAmount}
                onChange={(e) => setTopUpAmount(e.target.value)}
                placeholder="Amount in credits"
                className="mb-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              />
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional note (receipt #, package…)"
                className="mb-3 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => void topUp()}
                className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
              >
                {busy ? "Saving…" : "Add credits"}
              </button>
            </div>

            <div className={`${doctorCardClass} border-amber-200/80 p-4 sm:p-5`}>
              <div className="mb-3 flex items-center gap-2 font-bold text-amber-800">
                <ArrowDownCircle className="h-5 w-5" aria-hidden />
                Deduct (clinic visit)
              </div>
              <input
                type="number"
                min={1}
                step={1}
                value={deductAmount}
                onChange={(e) => setDeductAmount(e.target.value)}
                placeholder="Amount to deduct"
                className="mb-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              />
              <label className="mb-3 flex items-start gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={confirmDeduct}
                  onChange={(e) => setConfirmDeduct(e.target.checked)}
                  className="mt-1"
                />
                <span>
                  I confirm this patient visited the clinic and the deduction
                  amount is correct.
                </span>
              </label>
              <button
                type="button"
                disabled={busy || !confirmDeduct}
                onClick={() => void deduct()}
                className="w-full rounded-xl bg-[#2C3E6B] py-2.5 text-sm font-bold text-white transition hover:bg-[#243456] disabled:opacity-50"
              >
                {busy ? "Saving…" : "Deduct credits"}
              </button>
            </div>
          </div>

          {wallet.recentTransactions.length > 0 ? (
            <div className={`${doctorCardClass} p-4 sm:p-5 lg:col-span-2`}>
              <h3 className="mb-3 text-sm font-bold text-slate-700">
                Recent transactions
              </h3>
              <ul className="divide-y divide-slate-100 text-sm">
                {wallet.recentTransactions.map((tx) => (
                  <li
                    key={tx.id}
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <div>
                      <span className="font-semibold capitalize">{tx.type}</span>
                      {tx.patientName ? (
                        <span className="text-slate-500"> · {tx.patientName}</span>
                      ) : null}
                      {tx.note ? (
                        <p className="text-xs text-slate-400">{tx.note}</p>
                      ) : null}
                    </div>
                    <span
                      className={
                        tx.amountCredits >= 0
                          ? "font-bold text-emerald-600"
                          : "font-bold text-slate-800"
                      }
                    >
                      {tx.amountCredits >= 0 ? "+" : ""}
                      {tx.amountCredits}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : (
        <div className={`${doctorCardClass} py-16 text-center`}>
          <CreditCard className="mx-auto h-10 w-10 text-slate-300" aria-hidden />
          <p className="mt-3 text-sm text-slate-500">
            Search for a patient to manage their family card.
          </p>
        </div>
      )}
    </div>
  );
}
