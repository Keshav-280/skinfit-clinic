import Link from "next/link";
import type { Metadata } from "next";
import { Sparkles } from "lucide-react";
import { Button } from "../../components/ui/Button";

export const metadata: Metadata = {
  title: "Privacy Policy — SkinnFit",
  description:
    "How SkinnFit collects, uses, and protects your personal and health-related information.",
};

const sections = [
  {
    title: "1. Who we are",
    body: [
      "SkinnFit (“we”, “us”) operates the SkinnFit mobile application and patient web dashboard (the “Service”).",
      "Data controller: [Legal Entity Name]",
      "Address: [FILL IN — e.g. 123 Medical Plaza, Bangalore, Karnataka 560001, India]",
      "Support email: [FILL IN — e.g. privacy@skinfit.app]",
    ],
  },
  {
    title: "2. Information we collect",
    body: [
      "Account & profile: name, email, phone, password (hashed), profile photo, sign-in method (email, Google, or Apple).",
      "Health & skin data: onboarding questionnaire (age, gender, skin concerns, lifestyle), AI face scan photos and analysis results, wellness journals (sleep, hydration, stress), treatment routines, appointments.",
      "Communications: chat messages, voice notes, and images you send to your doctor or clinic.",
      "Device data: push notification token, session tokens stored securely on your device, limited server logs (IP, timestamps).",
      "On-device processing: face landmark detection guides scan capture on your device; scan photos are uploaded for AI analysis.",
      "We do not sell your personal information and do not use third-party advertising SDKs in the patient app.",
    ],
  },
  {
    title: "3. How we use information",
    body: [
      "We use your information to provide the Service, perform skin analysis, coordinate care with your clinic and doctor, send optional push notifications, maintain security, and comply with law.",
      "We do not use your health data for third-party advertising.",
    ],
  },
  {
    title: "4. Who we share information with",
    body: [
      "Your assigned dermatologist and clinic care team.",
      "Cloud hosting and infrastructure providers under contract.",
      "Google or Apple, only when you choose their sign-in option.",
      "Expo push infrastructure to deliver notifications.",
      "We may disclose information if required by law. We do not sell or rent personal information.",
    ],
  },
  {
    title: "5. Retention & security",
    body: [
      "We retain data while your account is active and as required for care continuity and legal obligations.",
      "We use HTTPS/TLS, hashed passwords, secure device storage, and role-based access for clinic staff.",
    ],
  },
  {
    title: "6. Your rights",
    body: [
      "Depending on applicable law, you may request access, correction, deletion, export, or restriction of your data, or withdraw consent for optional processing.",
      "Contact [FILL IN privacy@skinfit.app] from your registered email. We will verify your identity before responding.",
    ],
  },
  {
    title: "7. Permissions",
    body: [
      "Camera — multi-angle face scans and profile photos.",
      "Photos — select images for scans, profile, or chat.",
      "Microphone — voice notes to your doctor in chat.",
      "Notifications — optional alerts for clinic messages and scan results.",
    ],
  },
  {
    title: "8. Children",
    body: [
      "SkinnFit is intended for users 13 years and older. Users under 18 should use the Service with a parent or guardian. We do not knowingly collect data from children under 13.",
    ],
  },
  {
    title: "9. Changes & contact",
    body: [
      "We may update this policy and will post changes on this page with an updated date.",
      "Questions: [FILL IN privacy@skinfit.app] · [FILL IN phone]",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white text-slate-800">
      <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-teal-600 text-white shadow-lg shadow-teal-600/30">
              <Sparkles className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-800">
              SkinnFit
            </span>
          </Link>
          <Link href="/login">
            <Button size="md" variant="primary">
              Patient Login
            </Button>
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-sm font-medium text-teal-600">Legal</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-900">
          Privacy Policy
        </h1>
        <p className="mt-4 text-slate-600">
          Last updated: [FILL IN DATE]. Full version for store submission:{" "}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-sm">
            docs/store-submission/privacy-policy.md
          </code>
        </p>

        <div className="prose prose-slate mt-12 max-w-none">
          {sections.map((section) => (
            <section key={section.title} className="mb-10">
              <h2 className="text-xl font-semibold text-slate-900">
                {section.title}
              </h2>
              <ul className="mt-4 list-disc space-y-2 pl-5 text-slate-600">
                {section.body.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <p className="mt-12 border-t border-slate-200 pt-8 text-sm text-slate-500">
          See also{" "}
          <Link href="/terms" className="text-teal-600 hover:text-teal-700">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/contact" className="text-teal-600 hover:text-teal-700">
            Contact
          </Link>
          .
        </p>
      </main>
    </div>
  );
}
