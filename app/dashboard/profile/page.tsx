import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/dashboard/ProfileForm";
import { ProfileSkinDnaSection } from "@/components/dashboard/ProfileSkinDnaSection";
import { getSessionUserProfile } from "@/src/lib/auth/get-session";

export default async function ProfilePage() {
  const user = await getSessionUserProfile();
  if (!user) redirect("/login");

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
          Your profile
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Same account as the mobile app — Skin DNA, visits, and settings stay in
          sync.
        </p>
      </div>
      <ProfileSkinDnaSection />
      <ProfileForm initial={user} />
    </div>
  );
}
