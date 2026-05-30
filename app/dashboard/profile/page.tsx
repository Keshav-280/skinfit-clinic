import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/dashboard/ProfileForm";
import { ProfileRagKaiInsightsSection } from "@/components/dashboard/ProfileRagKaiInsightsSection";
import { ProfileSkinIdentitySection } from "@/components/dashboard/ProfileSkinIdentitySection";
import { ProfileSkinDnaSection } from "@/components/dashboard/ProfileSkinDnaSection";
import { ProfileLastTreatmentSection } from "@/components/dashboard/ProfileLastTreatmentSection";
import { ProfileRecentVisitsSection } from "@/components/dashboard/ProfileRecentVisitsSection";
import { getSessionUserProfile } from "@/src/lib/auth/get-session";
import { isKaiInsightsEnabled } from "@/src/lib/kaiInsightsEnabled";

export default async function ProfilePage() {
  const user = await getSessionUserProfile();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-1 pb-10 sm:px-0">
      <header className="rounded-[22px] border border-white/70 bg-white/35 p-6 text-center backdrop-blur-sm">
        <h1 className="text-2xl font-extrabold tracking-tight text-[#2C3E6B] sm:text-3xl">
          Your Profile
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[#6B7280]">
          Same account as the mobile app — Skin DNA, visits, and settings stay in
          sync.
        </p>
      </header>
      <div className="rounded-[22px] border border-white/70 bg-white/35 p-5 backdrop-blur-sm md:p-6">
        <ProfileSkinDnaSection />
      </div>
      <ProfileLastTreatmentSection />
      <ProfileRecentVisitsSection />
      <div className="rounded-[22px] border border-white/70 bg-white/35 p-5 backdrop-blur-sm md:p-6">
        <ProfileSkinIdentitySection />
      </div>
      {isKaiInsightsEnabled() ? (
        <div className="rounded-[22px] border border-white/70 bg-white/35 p-5 backdrop-blur-sm md:p-6">
          <ProfileRagKaiInsightsSection />
        </div>
      ) : null}
      <div className="rounded-[22px] border border-white/70 bg-white/35 p-5 backdrop-blur-sm md:p-6">
        <ProfileForm initial={user} />
      </div>
    </div>
  );
}
