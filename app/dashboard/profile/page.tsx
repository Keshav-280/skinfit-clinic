import { redirect } from "next/navigation";
import { Dna, Settings, Stethoscope } from "lucide-react";
import {
  DashboardPageHeader,
  DashboardPageSection,
} from "@/components/dashboard/DashboardPageSection";
import { ProfileForm } from "@/components/dashboard/ProfileForm";
import { ProfileRagKaiInsightsSection } from "@/components/dashboard/ProfileRagKaiInsightsSection";
import { ProfileSkinIdentitySection } from "@/components/dashboard/ProfileSkinIdentitySection";
import { ProfileSkinDnaSection } from "@/components/dashboard/ProfileSkinDnaSection";
import { ProfileLastTreatmentSection } from "@/components/dashboard/ProfileLastTreatmentSection";
import { getSessionUserProfile } from "@/src/lib/auth/get-session";
import { isKaiInsightsEnabled } from "@/src/lib/kaiInsightsEnabled";

export default async function ProfilePage() {
  const user = await getSessionUserProfile();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-1 pb-10 sm:px-0">
      <DashboardPageHeader
        title="Your Profile"
        subtitle={`${user.name} · ${user.email}`}
      />

      <DashboardPageSection
        kicker="Clinic"
        title="Visits"
        description="Your most recent visit — tap View to see full history."
        icon={Stethoscope}
      >
        <ProfileLastTreatmentSection />
      </DashboardPageSection>

      <DashboardPageSection
        kicker="Insights"
        title="Skin DNA"
        description="Profile snapshot, focus areas, and recent scan parameters."
        icon={Dna}
      >
        <div className="space-y-6">
          <ProfileSkinDnaSection embedded />
          <div className="border-t border-white/50 pt-6">
            <ProfileSkinIdentitySection embedded />
          </div>
        </div>
      </DashboardPageSection>

      {isKaiInsightsEnabled() ? (
        <DashboardPageSection
          kicker="kAI"
          title="Monthly insight"
          description="Scheduled monthly summary from your scans and logs."
        >
          <ProfileRagKaiInsightsSection embedded />
        </DashboardPageSection>
      ) : null}

      <DashboardPageSection
        kicker="Account"
        title="Settings"
        description="Contact details, reminders, and password."
        icon={Settings}
      >
        <ProfileForm initial={user} embedded />
      </DashboardPageSection>
    </div>
  );
}
