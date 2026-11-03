import { redirect } from "next/navigation";
import { FamilyWalletCard } from "@/components/dashboard/FamilyWalletCard";
import { ProfileForm } from "@/components/dashboard/ProfileForm";
import { DeleteAccountSection } from "@/components/dashboard/DeleteAccountSection";
import { KaiAboutCard } from "@/components/dashboard/KaiAboutCard";
import { RewardsCard } from "@/components/dashboard/RewardsCard";
import { LogoutButton } from "@/app/dashboard/logout-button";
import { getSessionUserProfile } from "@/src/lib/auth/get-session";

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
  if (!phone?.trim()) return null;
  return `${countryCode?.trim() || "+91"} ${phone.trim()}`;
}

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return `${parts[0]![0] ?? ""}${parts.length > 1 ? (parts[parts.length - 1]![0] ?? "") : ""}`.toUpperCase();
}

/** Who you are at a glance: name, how to reach you, and a few skin facts as chips. */
function ProfileHeader({
  user,
}: {
  user: NonNullable<Awaited<ReturnType<typeof getSessionUserProfile>>>;
}) {
  const phone = formatPhone(user.phoneCountryCode, user.phone);
  const chips = [
    user.age != null ? `${user.age} yrs` : null,
    user.gender?.trim() ? prettyValue(user.gender) : null,
    user.skinType?.trim() ? `${prettyValue(user.skinType)} skin` : null,
    user.primaryGoal?.trim() ? `Goal: ${prettyValue(user.primaryGoal)}` : null,
  ].filter(Boolean) as string[];

  return (
    <section className="rounded-[22px] border border-[#E4E6F0] bg-white p-5 shadow-[0_8px_24px_rgba(30,27,49,0.06)]">
      <div className="flex items-center gap-4">
        <span
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#1E1B31] font-serif text-xl font-semibold text-white"
          aria-hidden
        >
          {initialsOf(user.name)}
        </span>
        <div className="min-w-0">
          <h1 className="truncate font-serif text-2xl font-semibold text-[#1E1B31]">
            {user.name?.trim() || "Your profile"}
          </h1>
          <p className="truncate text-sm text-[#6B7280]">{user.email}</p>
          {phone ? <p className="truncate text-sm text-[#6B7280]">{phone}</p> : null}
        </div>
      </div>
      {chips.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {chips.map((c) => (
            <span
              key={c}
              className="rounded-full bg-[#F0EAE2] px-3 py-1 text-xs font-semibold text-[#1E1B31]"
            >
              {c}
            </span>
          ))}
        </div>
      ) : null}
      {!user.onboardingComplete ? (
        <a
          href="/onboarding/questionnaire?entry=resume"
          className="mt-4 flex items-center justify-between rounded-xl bg-[#F8EDEE] px-4 py-3 text-sm font-semibold text-[#1E1B31]"
        >
          Finish your skin questionnaire
          <span aria-hidden>&rsaquo;</span>
        </a>
      ) : null}
    </section>
  );
}

export default async function ProfilePage() {
  const user = await getSessionUserProfile();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-1 pb-10 sm:px-0">
      <ProfileHeader user={user} />
      <ProfileForm
        initial={user}
        embedded
        layout="profile-page"
        walletSlot={
          <>
            <RewardsCard />
            <FamilyWalletCard />
          </>
        }
        privacySlot={
          <>
            <KaiAboutCard />
            <DeleteAccountSection />
          </>
        }
      />
      <div className="border-t border-[#E5E7EB] pt-5">
        <LogoutButton />
      </div>
    </div>
  );
}
