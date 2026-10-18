"use client";

import { useState } from "react";
import {
  patientDashboardCard,
  patientMuted,
  patientSectionTitle,
} from "@/src/lib/patientDashboardTheme";

export function DeleteAccountSection() {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDelete() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/user/delete-account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE" }),
      });
      if (!res.ok) {
        setError(
          "We could not delete your account. Please try again or email info@skinfitwellness.in."
        );
        setBusy(false);
        return;
      }
      window.location.href = "/login";
    } catch {
      setError("Network error. Please try again.");
      setBusy(false);
    }
  }

  return (
    <section className={`${patientDashboardCard} p-5 sm:p-6`}>
      <h2 className={patientSectionTitle}>Delete account</h2>
      <p className={`mt-1 ${patientMuted}`}>
        Permanently delete your account and everything linked to it: scans, photos, reports,
        check-ins, rewards and chat. This cannot be undone.
      </p>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-4 rounded-full border border-[#B4232A]/40 px-5 py-2.5 text-sm font-semibold text-[#B4232A] transition hover:bg-[#B4232A]/5"
        >
          Delete my account
        </button>
      ) : (
        <div className="mt-4 space-y-3">
          <label htmlFor="del-confirm" className="block text-sm font-medium text-[#1E1B31]">
            Type DELETE to confirm
          </label>
          <input
            id="del-confirm"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            autoComplete="off"
            className="w-full rounded-xl border border-[#E5E7EB] bg-white px-4 py-3 text-base"
          />
          {error ? <p className="text-sm text-[#B4232A]">{error}</p> : null}
          <div className="flex gap-3">
            <button
              type="button"
              disabled={busy || confirmText !== "DELETE"}
              onClick={onDelete}
              className="rounded-full bg-[#B4232A] px-5 py-2.5 text-sm font-semibold text-white transition disabled:opacity-40"
            >
              {busy ? "Deleting…" : "Permanently delete"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setOpen(false);
                setConfirmText("");
                setError(null);
              }}
              className="rounded-full border border-[#E5E7EB] px-5 py-2.5 text-sm font-semibold text-[#1E1B31]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
