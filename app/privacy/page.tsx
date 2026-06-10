import type { Metadata } from "next";

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
  title: "Privacy Policy — SkinnFit",
  description:
    "How SkinnFit collects, uses, and protects your personal and health-related information.",
};

const { legalName, addressLine, email } = CLINIC_PUBLIC_CONTACT;

export default function PrivacyPage() {
  return (
    <LegalPageShell
      kicker="Legal"
      title="Privacy Policy"
      lastUpdated={PRIVACY_POLICY_LAST_UPDATED}
      footer={
        <>
          Questions about your data? Email{" "}
          <a
            href={`mailto:${email}`}
            className="font-semibold text-[#2C3E6B] underline underline-offset-2"
          >
            {email}
          </a>
          .
        </>
      }
    >
      <LegalSection title="1. Who operates SkinnFit">
        <p>
          {legalName} operates the SkinnFit mobile application and patient web dashboard for
          participating dermatology clinics.
        </p>
        <LegalBulletList
          items={[
            `Data controller: ${legalName}`,
            `Address: ${addressLine}`,
            `Privacy & support: ${email}`,
          ]}
        />
      </LegalSection>

      <LegalSection title="2. Information collected">
        <LegalBulletList
          items={[
            "Account & profile: name, email, phone, password (stored hashed), profile photo, and sign-in method (email, Google, or Apple when you choose it).",
            "Health & skin data: onboarding questionnaire, AI face-scan photos and analysis results, wellness journals (sleep, hydration, stress), skincare routines, and appointment requests.",
            "Communications: messages, voice notes, and images you send to your doctor or clinic team in chat.",
            "Device data: push notification token, secure session tokens on your device, and limited server logs (such as IP address and timestamps) for security.",
            "On-device processing: face landmark guidance during capture runs on your device; scan photos are uploaded for AI analysis on SkinnFit servers.",
            "Personal information is not sold and third-party advertising SDKs are not used in the patient app.",
          ]}
        />
      </LegalSection>

      <LegalSection title="3. How information is used">
        <LegalBulletList
          items={[
            "Run skin analysis and show your results to you and your care team.",
            "Coordinate appointments, routines, and clinic communications.",
            "Send optional push notifications you can turn off in device settings.",
            "Maintain security, prevent abuse, and comply with applicable law.",
            "Health data is not used for third-party advertising.",
          ]}
        />
      </LegalSection>

      <LegalSection title="4. Who information is shared with">
        <LegalBulletList
          items={[
            "Your assigned dermatologist and clinic care team involved in your treatment.",
            "Infrastructure providers that host the platform under contract and confidentiality obligations.",
            "Google or Apple, only when you choose to sign in with those services.",
            "Push notification services (such as Expo) to deliver alerts you opt into.",
            "Authorities when required by law. Personal information is not sold or rented.",
          ]}
        />
      </LegalSection>

      <LegalSection title="5. Retention & security">
        <LegalBulletList
          items={[
            "Data is retained while your account is active and as needed for care continuity, security, and legal obligations.",
            "HTTPS/TLS in transit, hashed passwords, secure device storage for tokens, and role-based access for clinic staff.",
          ]}
        />
      </LegalSection>

      <LegalSection title="6. Your rights">
        <p>
          Depending on applicable law, you may request access, correction, deletion, export, or
          restriction of your personal data, or withdraw consent for optional processing.
        </p>
        <p>
          Send requests to{" "}
          <a href={`mailto:${email}`} className="font-semibold text-[#2C3E6B] underline">
            {email}
          </a>{" "}
          from your registered email address. Identity will be verified before responding.
        </p>
      </LegalSection>

      <LegalSection title="7. App permissions">
        <LegalBulletList
          items={[
            "Camera — multi-angle face scans and profile photos.",
            "Photo library — choose images for scans, profile, or chat.",
            "Microphone — optional voice notes to your doctor in chat.",
            "Notifications — optional alerts for clinic messages and scan results.",
          ]}
        />
      </LegalSection>

      <LegalSection title="8. Children">
        <p>
          SkinnFit is intended for users 13 years and older. Users under 18 should use the app with
          a parent or guardian. Personal data from children under 13 is not knowingly collected.
        </p>
      </LegalSection>

      <LegalSection title="9. Changes to this policy">
        <p>
          This policy may be updated from time to time. Revised versions are posted on this page
          with a new “Last updated” date. Continued use of SkinnFit after changes means acceptance
          of the updated policy.
        </p>
        <LegalBulletList
          items={[`Email: ${email}`, `Postal: ${addressLine}`]}
        />
      </LegalSection>
    </LegalPageShell>
  );
}
