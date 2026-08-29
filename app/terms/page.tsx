import type { Metadata } from "next";
import Link from "next/link";

import {
  LegalBulletList,
  LegalPageShell,
  LegalSection,
} from "@/components/legal/LegalPageShell";
import {
  CLINIC_PUBLIC_CONTACT,
  TERMS_OF_SERVICE_LAST_UPDATED,
} from "@/src/lib/clinicPublicContact";

export const metadata: Metadata = {
  title: "Terms of Service — SkinFit",
  description: "Terms governing your use of the SkinFit patient app and dashboard.",
};

const { legalName, addressLine, email, jurisdiction } = CLINIC_PUBLIC_CONTACT;

export default function TermsPage() {
  return (
    <LegalPageShell
      kicker="Legal"
      title="Terms of Service"
      lastUpdated={TERMS_OF_SERVICE_LAST_UPDATED}
      intro="These Terms govern your use of the SkinFit mobile app and patient web dashboard used with participating dermatology clinics in India."
      footer={
        <>
          See also{" "}
          <Link
            href="/privacy"
            className="font-semibold text-[#1E1B31] underline underline-offset-2"
          >
            Privacy Policy
          </Link>{" "}
          and{" "}
          <Link
            href="/contact"
            className="font-semibold text-[#1E1B31] underline underline-offset-2"
          >
            Contact
          </Link>
          . Questions? Email{" "}
          <a
            href={`mailto:${email}`}
            className="font-semibold text-[#1E1B31] underline underline-offset-2"
          >
            {email}
          </a>
          .
        </>
      }
    >
      <LegalSection title="1. Who operates SkinFit">
        <p>
          {legalName} operates the SkinFit mobile application and patient web dashboard for
          participating dermatology clinics.
        </p>
        <LegalBulletList
          items={[
            `Operator: ${legalName}`,
            `Address: ${addressLine}`,
            `Support: ${email}`,
          ]}
        />
      </LegalSection>

      <LegalSection title="2. The Service">
        <p>
          SkinFit helps patients of participating clinics capture AI-assisted skin scans, view
          reports, chat with their care team, track wellness habits, and coordinate appointments.
        </p>
        <LegalBulletList
          items={[
            "SkinFit is a care coordination and education tool.",
            "It is not a substitute for professional medical advice, diagnosis, emergency care, or in-person examination.",
            "Features may vary by clinic and may change as the platform is improved.",
          ]}
        />
      </LegalSection>

      <LegalSection title="3. Eligibility & your account">
        <LegalBulletList
          items={[
            "You must be at least 13 years old, or the minimum age required in your country. If you are under 18, a parent or guardian must permit your use.",
            "You must provide accurate registration information and keep your login credentials secure.",
            "You are responsible for activity on your account unless you notify us promptly of unauthorized access.",
            "One account per person unless your clinic explicitly authorizes a shared family arrangement.",
          ]}
        />
      </LegalSection>

      <LegalSection title="4. Medical disclaimer">
        <p>
          Always consult a qualified healthcare professional for medical advice, diagnosis, or
          treatment. Do not delay seeking professional care because of information in SkinFit.
        </p>
        <LegalBulletList
          items={[
            "For emergencies, call your local emergency number immediately.",
            "Scan results, scores, and AI responses are informational and educational only.",
            "Only your licensed healthcare provider can diagnose conditions and prescribe treatment.",
            "Using chat or AI features alone does not create a doctor–patient relationship.",
            "SkinFit does not provide emergency or urgent care services.",
          ]}
        />
      </LegalSection>

      <LegalSection title="5. Acceptable use">
        <LegalBulletList
          items={[
            "Do not upload unlawful, harassing, misleading, or abusive content.",
            "Do not attempt to disrupt, reverse engineer, scrape, or misuse the Service.",
            "Do not share another person’s health images or data without their consent.",
            "Do not use SkinFit to impersonate a clinician or misrepresent medical qualifications.",
            "We may suspend or terminate access for violations or risks to users, clinics, or the platform.",
          ]}
        />
      </LegalSection>

      <LegalSection title="6. Your content">
        <LegalBulletList
          items={[
            "You retain ownership of content you submit, including photos, messages, and journal entries.",
            "You grant us a limited license to store, process, and transmit your content to operate the Service and share it with your assigned care team.",
            "You confirm you have consent to submit content, including facial images and health-related information.",
            "You may request deletion of your account data as described in our Privacy Policy, subject to legal and care-record obligations.",
          ]}
        />
      </LegalSection>

      <LegalSection title="7. AI features">
        <LegalBulletList
          items={[
            "AI skin analysis and assistant responses are generated automatically and may be incomplete or inaccurate.",
            "AI output is intended to support self-tracking and clinic conversations, not to replace clinical judgment.",
            "Do not rely on AI output as the sole basis for medical decisions.",
          ]}
        />
      </LegalSection>

      <LegalSection title="8. Privacy">
        <p>
          Our{" "}
          <Link href="/privacy" className="font-semibold text-[#1E1B31] underline underline-offset-2">
            Privacy Policy
          </Link>{" "}
          explains how we collect, use, store, and protect personal and health-related information.
          By using SkinFit, you also agree to that policy.
        </p>
      </LegalSection>

      <LegalSection title="9. Disclaimers & limitation of liability">
        <LegalBulletList
          items={[
            "The Service is provided “as is” and “as available” to the maximum extent permitted by law.",
            "We do not guarantee uninterrupted, error-free, or fully accurate operation.",
            `To the extent permitted by law, ${legalName} and its affiliates are not liable for indirect, incidental, or consequential damages arising from use of the Service.`,
            "Nothing in these Terms limits rights that cannot be waived under applicable consumer protection law.",
          ]}
        />
      </LegalSection>

      <LegalSection title="10. Changes to these Terms">
        <p>
          We may update these Terms from time to time. Revised versions are posted on this page with
          a new “Last updated” date. Continued use of SkinFit after changes means you accept the
          updated Terms.
        </p>
      </LegalSection>

      <LegalSection title="11. Governing law">
        <p>
          These Terms are governed by the laws of India. Courts in {jurisdiction} have jurisdiction
          unless mandatory consumer law in your place of residence requires otherwise.
        </p>
      </LegalSection>

      <LegalSection title="12. Contact">
        <LegalBulletList
          items={[
            `${legalName} · ${addressLine}`,
            `Email: ${email}`,
          ]}
        />
      </LegalSection>
    </LegalPageShell>
  );
}
