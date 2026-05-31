import { redirect } from "next/navigation";
import {
  Bell,
  Clock3,
  Goal,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UserRound,
} from "lucide-react";
import { DashboardPageSection } from "@/components/dashboard/DashboardPageSection";
import { LastTreatmentCard } from "@/components/dashboard/LastTreatmentCard";
import { ProfileForm } from "@/components/dashboard/ProfileForm";
import { ProfileRagKaiInsightsSection } from "@/components/dashboard/ProfileRagKaiInsightsSection";
import { getSessionUserProfile } from "@/src/lib/auth/get-session";
import { isKaiInsightsEnabled } from "@/src/lib/kaiInsightsEnabled";
import { getLatestPatientVisit } from "@/src/lib/patientVisit";

function prettyValue(value: string | number | null | undefined, fallback = "Not added") {
  if (value == null) return fallback;
  const text = String(value).trim();
  if (!text) return fallback;
  return text
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function formatPhone(countryCode: string | null | undefined, phone: string | null) {
  if (!phone?.trim()) return "Not added";
  return `${countryCode?.trim() || "+91"} ${phone.trim()}`;
}

function formatReminderHours(hours: number) {
  if (hours <= 0) return "Off";
  return `${hours}h before visit`;
}

function ProfileSnapshot({
  user,
}: {
  user: NonNullable<Awaited<ReturnType<typeof getSessionUserProfile>>>;
}) {
  const items = [
    {
      label: "Personal",
      value: [
        user.age != null ? `${user.age} yrs` : null,
        prettyValue(user.gender, ""),
      ]
        .filter(Boolean)
        .join(" · ") || "Not added",
      icon: UserRound,
    },
    {
      label: "Skin type",
      value: prettyValue(user.skinType),
      icon: Sparkles,
    },
    {
      label: "Primary goal",
      value: prettyValue(user.primaryGoal),
      icon: Goal,
    },
    {
      label: "Phone",
      value: formatPhone(user.phoneCountryCode, user.phone),
      icon: Phone,
    },
    {
      label: "Routine reminders",
      value: user.routineRemindersEnabled
        ? `${user.routineAmReminderHm} AM · ${user.routinePmReminderHm} PM`
        : "Off",
      icon: Clock3,
    },
    {
      label: "Visit reminder",
      value: formatReminderHours(user.appointmentReminderHoursBefore),
      icon: Bell,
    },
    {
      label: "Timezone",
      value: user.timezone || "Asia/Kolkata",
      icon: MapPin,
    },
    {
      label: "Profile status",
      value: user.onboardingComplete ? "Onboarding complete" : "Onboarding pending",
      icon: ShieldCheck,
    },
  ];

  return (
    <section className="rounded-[22px] border border-white/70 bg-white/40 p-4 shadow-[0_8px_30px_rgba(44,62,107,0.06)] backdrop-blur-sm sm:p-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {items.map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="rounded-[18px] border border-white/70 bg-white/45 px-3.5 py-3"
          >
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] bg-[#2C3E6B] text-white shadow-sm">
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#64748B]">
                  {label}
                </p>
                <p className="truncate text-sm font-bold text-[#1F2A44]">
                  {value}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default async function ProfilePage() {
  const user = await getSessionUserProfile();
  if (!user) redirect("/login");

  const latestVisit = await getLatestPatientVisit(user.id);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-1 pb-10 sm:px-0">
      <ProfileForm
        initial={user}
        embedded
        layout="profile-page"
        leftSlot={
          <>
            <ProfileSnapshot user={user} />

            {latestVisit ? (
              <DashboardPageSection
                kicker="Clinic"
                title="Visits"
                description=""
                icon={Stethoscope}
              >
                <LastTreatmentCard visit={latestVisit} />
              </DashboardPageSection>
            ) : null}

            {isKaiInsightsEnabled() ? (
              <DashboardPageSection
                kicker="kAI"
                title="Monthly insight"
                description="Scheduled monthly summary from your scans and logs."
              >
                <ProfileRagKaiInsightsSection embedded />
              </DashboardPageSection>
            ) : null}
          </>
        }
      />
    </div>
  );
}
