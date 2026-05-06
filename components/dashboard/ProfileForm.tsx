"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { SessionUserProfile } from "@/src/lib/auth/get-session";
import {
  APPOINTMENT_REMINDER_HOURS_DEFAULT,
  APPOINTMENT_REMINDER_HOURS_MAX,
} from "@/src/lib/appointmentReminder";

type Props = {
  initial: SessionUserProfile;
};

export function ProfileForm({ initial }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [email, setEmail] = useState(initial.email);
  const [phoneCountryCode, setPhoneCountryCode] = useState(
    initial.phoneCountryCode ?? "+91"
  );
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [age, setAge] = useState(
    initial.age != null ? String(initial.age) : ""
  );
  const [gender, setGender] = useState(initial.gender ?? "");
  const [skinType, setSkinType] = useState(initial.skinType ?? "");
  const [primaryGoal, setPrimaryGoal] = useState(initial.primaryGoal ?? "");
  const [reminderHoursBefore, setReminderHoursBefore] = useState(
    String(
      initial.appointmentReminderHoursBefore ?? APPOINTMENT_REMINDER_HOURS_DEFAULT
    )
  );
  const [timezone, setTimezone] = useState(initial.timezone ?? "Asia/Kolkata");
  const [routineRemindersEnabled, setRoutineRemindersEnabled] = useState(
    initial.routineRemindersEnabled ?? true
  );
  const [routineAmReminderHm, setRoutineAmReminderHm] = useState(
    initial.routineAmReminderHm ?? "08:30"
  );
  const [routinePmReminderHm, setRoutinePmReminderHm] = useState(
    initial.routinePmReminderHm ?? "22:00"
  );
  const [cycleTrackingEnabled, setCycleTrackingEnabled] = useState(
    initial.cycleTrackingEnabled ?? false
  );
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setTimezone(initial.timezone ?? "Asia/Kolkata");
    setRoutineRemindersEnabled(initial.routineRemindersEnabled ?? true);
    setRoutineAmReminderHm(initial.routineAmReminderHm ?? "08:30");
    setRoutinePmReminderHm(initial.routinePmReminderHm ?? "22:00");
  }, [
    initial.timezone,
    initial.routineRemindersEnabled,
    initial.routineAmReminderHm,
    initial.routinePmReminderHm,
  ]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    if (newPassword || currentPassword) {
      if (newPassword !== confirmPassword) {
        setError("New password and confirmation do not match.");
        return;
      }
    }

    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        email: email.trim(),
        phoneCountryCode: phoneCountryCode.trim() || "+91",
        phone: phone.trim(),
        gender: gender || null,
        skinType: skinType.trim() || null,
        primaryGoal: primaryGoal.trim() || null,
      };
      const ageTrim = age.trim();
      if (ageTrim === "") {
        body.age = null;
      } else {
        const n = Number.parseInt(ageTrim, 10);
        if (!Number.isFinite(n) || n < 1 || n > 120) {
          setError("Age must be between 1 and 120, or leave blank.");
          setLoading(false);
          return;
        }
        body.age = n;
      }

      const rh = Number.parseInt(reminderHoursBefore.trim(), 10);
      if (
        !Number.isFinite(rh) ||
        rh < 0 ||
        rh > APPOINTMENT_REMINDER_HOURS_MAX
      ) {
        setError(
          `Reminder time must be 0 (off) or 1–${APPOINTMENT_REMINDER_HOURS_MAX} hours before your visit.`
        );
        setLoading(false);
        return;
      }
      body.appointmentReminderHoursBefore = rh;

      body.timezone = timezone.trim() || "Asia/Kolkata";
      body.routineRemindersEnabled = routineRemindersEnabled;
      body.routineAmReminderHm = routineAmReminderHm;
      body.routinePmReminderHm = routinePmReminderHm;
      body.cycleTrackingEnabled =
        gender === "female" ? cycleTrackingEnabled : false;

      if (newPassword || currentPassword) {
        body.currentPassword = currentPassword;
        body.newPassword = newPassword;
      }

      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof data.message === "string"
            ? data.message
            : "Could not save profile."
        );
        return;
      }
      setSaved(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      if (typeof data.user?.name === "string") setName(data.user.name);
      if (typeof data.user?.email === "string") setEmail(data.user.email);
      if (typeof data.user?.phoneCountryCode === "string")
        setPhoneCountryCode(data.user.phoneCountryCode);
      if (typeof data.user?.phone === "string") setPhone(data.user.phone);
      else if (data.user?.phone === null) setPhone("");
      if (data.user?.age === null) setAge("");
      else if (typeof data.user?.age === "number")
        setAge(String(data.user.age));
      if (data.user?.gender === null) setGender("");
      else if (typeof data.user?.gender === "string") setGender(data.user.gender);
      if (data.user?.skinType === null) setSkinType("");
      else if (typeof data.user?.skinType === "string")
        setSkinType(data.user.skinType);
      if (data.user?.primaryGoal === null) setPrimaryGoal("");
      else if (typeof data.user?.primaryGoal === "string")
        setPrimaryGoal(data.user.primaryGoal);
      if (typeof data.user?.appointmentReminderHoursBefore === "number") {
        setReminderHoursBefore(String(data.user.appointmentReminderHoursBefore));
      }
      if (typeof data.user?.timezone === "string") setTimezone(data.user.timezone);
      if (typeof data.user?.routineRemindersEnabled === "boolean") {
        setRoutineRemindersEnabled(data.user.routineRemindersEnabled);
      }
      if (typeof data.user?.routineAmReminderHm === "string") {
        setRoutineAmReminderHm(data.user.routineAmReminderHm);
      }
      if (typeof data.user?.routinePmReminderHm === "string") {
        setRoutinePmReminderHm(data.user.routinePmReminderHm);
      }
      if (typeof data.user?.cycleTrackingEnabled === "boolean") {
        setCycleTrackingEnabled(data.user.cycleTrackingEnabled);
      }
      router.refresh();
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  const card =
    "rounded-[22px] border border-zinc-100 bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.06)]";

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </div>
      )}
      {saved && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
        >
          Profile saved.
        </div>
      )}

      <section className={card}>
        <h2 className="text-lg font-bold text-zinc-900">Your details</h2>
        <p className="mt-1 text-sm text-zinc-500">
          This information appears on your treatment history and reports.
        </p>
        <div className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="pf-name"
              className="mb-1.5 block text-sm font-medium text-zinc-700"
            >
              Full name
            </label>
            <input
              id="pf-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-zinc-900 outline-none focus:border-[#6B8E8E] focus:ring-2 focus:ring-[#6B8E8E]/20"
              autoComplete="name"
            />
          </div>
          <div>
            <label
              htmlFor="pf-email"
              className="mb-1.5 block text-sm font-medium text-zinc-700"
            >
              Email
            </label>
            <input
              id="pf-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-zinc-900 outline-none focus:border-[#6B8E8E] focus:ring-2 focus:ring-[#6B8E8E]/20"
              autoComplete="email"
            />
          </div>
          <div>
            <label
              htmlFor="pf-phone-cc"
              className="mb-1.5 block text-sm font-medium text-zinc-700"
            >
              Phone number <span className="text-red-600">*</span>
            </label>
            <div className="flex gap-2">
              <input
                id="pf-phone-cc"
                type="text"
                inputMode="tel"
                autoComplete="tel-country-code"
                required
                value={phoneCountryCode}
                onChange={(e) => setPhoneCountryCode(e.target.value)}
                disabled={loading}
                className="w-[5.5rem] shrink-0 rounded-xl border border-zinc-200 bg-white px-3 py-3 text-center text-zinc-900 outline-none focus:border-[#6B8E8E] focus:ring-2 focus:ring-[#6B8E8E]/20"
                placeholder="+91"
                aria-label="Country code"
              />
              <input
                id="pf-phone"
                type="tel"
                inputMode="numeric"
                required
                value={phone}
                onChange={(e) =>
                  setPhone(e.target.value.replace(/[^\d\s-]/g, ""))
                }
                disabled={loading}
                autoComplete="tel-national"
                className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-zinc-900 outline-none focus:border-[#6B8E8E] focus:ring-2 focus:ring-[#6B8E8E]/20"
                placeholder="Mobile number"
              />
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              Country code defaults to +91. Enter at least 10 digits for your
              number.
            </p>
          </div>
          <div>
            <label
              htmlFor="pf-age"
              className="mb-1.5 block text-sm font-medium text-zinc-700"
            >
              Age (years)
            </label>
            <input
              id="pf-age"
              inputMode="numeric"
              value={age}
              onChange={(e) => setAge(e.target.value.replace(/\D/g, ""))}
              disabled={loading}
              placeholder="e.g. 28"
              className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-zinc-900 outline-none focus:border-[#6B8E8E] focus:ring-2 focus:ring-[#6B8E8E]/20"
            />
          </div>
          <div>
            <label
              htmlFor="pf-skin"
              className="mb-1.5 block text-sm font-medium text-zinc-700"
            >
              Skin type
            </label>
            <input
              id="pf-skin"
              value={skinType}
              onChange={(e) => setSkinType(e.target.value)}
              disabled={loading}
              placeholder="e.g. Dry, Combination, Oily"
              className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-zinc-900 outline-none focus:border-[#6B8E8E] focus:ring-2 focus:ring-[#6B8E8E]/20"
            />
          </div>
          <div>
            <label
              htmlFor="pf-goal"
              className="mb-1.5 block text-sm font-medium text-zinc-700"
            >
              Primary goal
            </label>
            <input
              id="pf-goal"
              value={primaryGoal}
              onChange={(e) => setPrimaryGoal(e.target.value)}
              disabled={loading}
              placeholder="e.g. Acne reduction, Hydration"
              className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-zinc-900 outline-none focus:border-[#6B8E8E] focus:ring-2 focus:ring-[#6B8E8E]/20"
            />
          </div>
          <div>
            <label
              htmlFor="pf-gender"
              className="mb-1.5 block text-sm font-medium text-zinc-700"
            >
              Gender
            </label>
            <select
              id="pf-gender"
              value={gender}
              onChange={(e) => {
                const g = e.target.value;
                setGender(g);
                if (g !== "female") setCycleTrackingEnabled(false);
              }}
              disabled={loading}
              className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-zinc-900 outline-none focus:border-[#6B8E8E] focus:ring-2 focus:ring-[#6B8E8E]/20"
            >
              <option value="">Select</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
              <option value="prefer_not_say">Prefer not to say</option>
            </select>
          </div>
          {gender === "female" ? (
            <label className="flex cursor-pointer items-center gap-3 pt-2">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-zinc-300 text-[#6B8E8E] focus:ring-[#6B8E8E]"
                checked={cycleTrackingEnabled}
                onChange={(e) => setCycleTrackingEnabled(e.target.checked)}
                disabled={loading}
              />
              <span className="text-sm font-medium text-zinc-800">
                Track menstrual cycle day in journal
              </span>
            </label>
          ) : null}
        </div>
      </section>

      <section className={card}>
        <h2 className="text-lg font-bold text-zinc-900">Visit reminders</h2>
        <p className="mt-1 text-sm text-zinc-500">
          SkinnFit Clinic can send you a message in{" "}
          <strong className="font-medium text-zinc-700">Clinic Support</strong>{" "}
          chat before each confirmed appointment.
        </p>
        <div className="mt-6">
          <label
            htmlFor="pf-reminder-hours"
            className="mb-1.5 block text-sm font-medium text-zinc-700"
          >
            Remind me how many hours before the visit?
          </label>
          <input
            id="pf-reminder-hours"
            type="number"
            inputMode="numeric"
            min={0}
            max={APPOINTMENT_REMINDER_HOURS_MAX}
            value={reminderHoursBefore}
            onChange={(e) => setReminderHoursBefore(e.target.value)}
            disabled={loading}
            className="w-full max-w-[12rem] rounded-xl border border-zinc-200 bg-white px-4 py-3 text-zinc-900 outline-none focus:border-[#6B8E8E] focus:ring-2 focus:ring-[#6B8E8E]/20"
          />
        </div>
      </section>

      <section className={card}>
        <h2 className="text-lg font-bold text-zinc-900">Daily routine reminders</h2>
        <p className="mt-1 text-sm text-zinc-500">
          SkinnFit Clinic can message you in{" "}
          <strong className="font-medium text-zinc-700">Clinic Support</strong>{" "}
          if your AM or PM checklist still has steps left that day. Times use
          your timezone below.
        </p>
        <div className="mt-6 space-y-4">
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-zinc-300 text-[#6B8E8E] focus:ring-[#6B8E8E]"
              checked={routineRemindersEnabled}
              onChange={(e) => setRoutineRemindersEnabled(e.target.checked)}
              disabled={loading}
            />
            <span className="text-sm font-medium text-zinc-800">
              Enable AM / PM routine reminders
            </span>
          </label>
          <div>
            <label
              htmlFor="pf-tz"
              className="mb-1.5 block text-sm font-medium text-zinc-700"
            >
              Timezone (IANA)
            </label>
            <div className="flex flex-wrap gap-2">
              <input
                id="pf-tz"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                disabled={loading}
                placeholder="e.g. Asia/Kolkata"
                className="min-w-[12rem] flex-1 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-zinc-900 outline-none focus:border-[#6B8E8E] focus:ring-2 focus:ring-[#6B8E8E]/20"
                autoComplete="off"
              />
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  try {
                    setTimezone(
                      Intl.DateTimeFormat().resolvedOptions().timeZone
                    );
                  } catch {
                    /* ignore */
                  }
                }}
                className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-800 hover:bg-zinc-100 disabled:opacity-60"
              >
                Use this device
              </button>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="pf-am-rem"
                className="mb-1.5 block text-sm font-medium text-zinc-700"
              >
                Morning reminder
              </label>
              <input
                id="pf-am-rem"
                type="time"
                value={routineAmReminderHm}
                onChange={(e) => setRoutineAmReminderHm(e.target.value)}
                disabled={loading || !routineRemindersEnabled}
                className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-zinc-900 outline-none focus:border-[#6B8E8E] focus:ring-2 focus:ring-[#6B8E8E]/20"
              />
            </div>
            <div>
              <label
                htmlFor="pf-pm-rem"
                className="mb-1.5 block text-sm font-medium text-zinc-700"
              >
                Evening reminder
              </label>
              <input
                id="pf-pm-rem"
                type="time"
                value={routinePmReminderHm}
                onChange={(e) => setRoutinePmReminderHm(e.target.value)}
                disabled={loading || !routineRemindersEnabled}
                className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-zinc-900 outline-none focus:border-[#6B8E8E] focus:ring-2 focus:ring-[#6B8E8E]/20"
              />
            </div>
          </div>
        </div>
      </section>

      <section className={card}>
        <h2 className="text-lg font-bold text-zinc-900">Change password</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Leave blank to keep your current password.
        </p>
        <div className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="pf-cur"
              className="mb-1.5 block text-sm font-medium text-zinc-700"
            >
              Current password
            </label>
            <input
              id="pf-cur"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={loading}
              autoComplete="current-password"
              className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-zinc-900 outline-none focus:border-[#6B8E8E] focus:ring-2 focus:ring-[#6B8E8E]/20"
            />
          </div>
          <div>
            <label
              htmlFor="pf-new"
              className="mb-1.5 block text-sm font-medium text-zinc-700"
            >
              New password
            </label>
            <input
              id="pf-new"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={loading}
              autoComplete="new-password"
              className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-zinc-900 outline-none focus:border-[#6B8E8E] focus:ring-2 focus:ring-[#6B8E8E]/20"
            />
          </div>
          <div>
            <label
              htmlFor="pf-confirm"
              className="mb-1.5 block text-sm font-medium text-zinc-700"
            >
              Confirm new password
            </label>
            <input
              id="pf-confirm"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
              autoComplete="new-password"
              className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-zinc-900 outline-none focus:border-[#6B8E8E] focus:ring-2 focus:ring-[#6B8E8E]/20"
            />
          </div>
        </div>
      </section>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-full bg-[#6B8E8E] px-5 py-3.5 text-base font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-60"
      >
        {loading ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}
