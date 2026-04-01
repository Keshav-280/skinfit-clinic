import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/dashboard/ProfileForm";
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
          Update how you appear across the private portal.
        </p>
      </div>
      <ProfileForm initial={user} />
    </div>
  );
}
