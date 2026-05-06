import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/dashboard/ProfileForm";
import { ProfileRagKaiInsightsSection } from "@/components/dashboard/ProfileRagKaiInsightsSection";
import { ProfileSkinIdentitySection } from "@/components/dashboard/ProfileSkinIdentitySection";
import { ProfileSkinDnaSection } from "@/components/dashboard/ProfileSkinDnaSection";
import { getSessionUserProfile } from "@/src/lib/auth/get-session";

export default async function ProfilePage() {
  const user = await getSessionUserProfile();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-1 pb-10 sm:px-0">
      <header className="text-center">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
          Your profile
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-zinc-600">
          Same account as the mobile app — Skin DNA, visits, and settings stay in
          sync.
        </p>
      </header>
      <ProfileSkinDnaSection />
      <ProfileSkinIdentitySection />
      <ProfileRagKaiInsightsSection />
      <ProfileForm initial={user} />
    </div>
  );
}
