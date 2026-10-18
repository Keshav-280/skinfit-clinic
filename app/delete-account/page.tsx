import type { Metadata } from "next";
import Link from "next/link";

import {
  LegalBulletList,
  LegalPageShell,
  LegalSection,
} from "@/components/legal/LegalPageShell";
import {
  CLINIC_PUBLIC_CONTACT,
  PRIVACY_POLICY_LAST_UPDATED,
} from "@/src/lib/clinicPublicContact";

export const metadata: Metadata = {
  title: "Delete your account - SkinFit",
  description: "How to delete your SkinFit Wellness account and what happens to your data.",
};

export default function DeleteAccountPage() {
  return (
    <LegalPageShell
      kicker="Your data"
      title="Delete your account"
      lastUpdated={PRIVACY_POLICY_LAST_UPDATED}
      intro="You can delete your SkinFit Wellness account at any time, from the app or from this website."
    >
      <LegalSection title="Delete it yourself">
        <LegalBulletList
          items={[
            "Sign in to the SkinFit Wellness app or to my.skinfitwellness.in.",
            "Open your profile (tap your avatar at the top right).",
            "Scroll to Delete account, type DELETE to confirm, and tap Permanently delete.",
          ]}
        />
        <p>
          <Link href="/login" className="font-semibold underline">
            Sign in
          </Link>{" "}
          to get started.
        </p>
      </LegalSection>
      <LegalSection title="What is deleted">
        <LegalBulletList
          items={[
            "Your profile and sign-in details.",
            "Your scans, scan photos and skin reports.",
            "Your weekly check-ins, questionnaire answers and history.",
            "Your rewards points and referral records.",
            "Your chat messages and appointment requests.",
          ]}
        />
        <p>Deletion is permanent and takes effect immediately.</p>
      </LegalSection>
      <LegalSection title="What we may keep">
        <p>
          Records a clinic must keep by law (for example billing records for visits you
          attended) may be retained by the clinic as required by Indian law.
        </p>
      </LegalSection>
      <LegalSection title="Can't sign in?">
        <p>
          Email{" "}
          <a href={`mailto:${CLINIC_PUBLIC_CONTACT.email}`} className="font-semibold underline">
            {CLINIC_PUBLIC_CONTACT.email}
          </a>{" "}
          from the address or phone number on your account and ask us to delete it. We will
          confirm and complete the deletion.
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
