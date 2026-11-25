"use client";

import { useEffect, useState } from "react";
import { REMINDER_CHOICE_EVENT } from "@/components/dashboard/EmailReminderPrompt";
import { patientMuted, patientSectionTitle } from "@/src/lib/patientDashboardTheme";

type State = { available: boolean; email: string | null; on: boolean };

/** Profile switch for the weekly email reminder. Saves as soon as it is changed. */
export function EmailReminderToggle() {
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/patient/email-reminders")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setState({ available: Boolean(d.available), email: d.email, on: d.choice === true });
      })
      .catch(() => {});
    const onChoice = (e: Event) => {
      const on = Boolean((e as CustomEvent).detail);
      setState((s) => (s ? { ...s, on } : s));
    };
    window.addEventListener(REMINDER_CHOICE_EVENT, onChoice);
    return () => window.removeEventListener(REMINDER_CHOICE_EVENT, onChoice);
  }, []);

  async function change(on: boolean) {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/patient/email-reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optedIn: on }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setState((s) => (s ? { ...s, on } : s));
      setMessage("Saved");
    } catch {
      setMessage("Could not save that. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!state) return null;

  return (
    <section className="rounded-[22px] border border-[#E4E6F0] bg-white p-5 shadow-[0_8px_24px_rgba(30,27,49,0.06)]">
      <h2 className={patientSectionTitle}>Weekly email reminder</h2>
      {state.available ? (
        <>
          <p className={`mt-1 ${patientMuted}`}>
            Sent on Sunday at 10 am (India time) to {state.email}, only if your skin scan or weekly
            questionnaire is pending.
          </p>
          <label className="mt-4 flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-[#1E1B31]/30 text-[#1E1B31] focus:ring-[#1E1B31]"
              checked={state.on}
              disabled={busy}
              onChange={(e) => void change(e.target.checked)}
            />
            <span className="text-sm font-medium text-[#374151]">Email me a weekly reminder</span>
          </label>
          {message ? (
            <p className={`mt-2 ${patientMuted}`} role="status">
              {message}
            </p>
          ) : null}
        </>
      ) : (
        <p className={`mt-1 ${patientMuted}`}>
          Your account has no email address, so email reminders are not available.
        </p>
      )}
    </section>
  );
}
