import Link from "next/link";
import type { Metadata } from "next";
import { Sparkles } from "lucide-react";
import { Button } from "../../components/ui/Button";

export const metadata: Metadata = {
  title: "Terms of Service — SkinnFit",
  description: "Terms governing your use of the SkinnFit patient app and dashboard.",
};

const sections = [
  {
    title: "1. The Service",
    body: [
      "SkinnFit helps patients of participating dermatology clinics capture AI-assisted skin scans, view reports, chat with their care team, track wellness habits, and manage appointments.",
      "SkinnFit is a care coordination tool. It is not a substitute for professional medical diagnosis, emergency care, or in-person examination.",
    ],
  },
  {
    title: "2. Eligibility",
    body: [
      "You must be at least 13 years old (or the minimum age in your country). If under 18, a parent or guardian must permit your use.",
      "You must provide accurate registration information and keep your credentials secure.",
    ],
  },
  {
    title: "3. Medical disclaimer",
    body: [
      "For emergencies, call your local emergency number immediately.",
      "Scan results and AI responses are informational. Only your licensed healthcare provider can diagnose and prescribe treatment.",
      "Using the AI chat feature alone does not create a doctor–patient relationship.",
    ],
  },
  {
    title: "4. Acceptable use",
    body: [
      "Do not upload unlawful, harassing, or misleading content.",
      "Do not attempt to disrupt, reverse engineer, or misuse the Service.",
      "Do not share another person’s health images without consent.",
    ],
  },
  {
    title: "5. Your content",
    body: [
      "You retain ownership of content you submit. You grant us a limited license to store and transmit it to operate the Service and share it with your care team.",
      "You confirm you have consent to submit content, including your facial images.",
    ],
  },
  {
    title: "6. Privacy",
    body: [
      "Our Privacy Policy explains how we handle personal and health-related data.",
    ],
  },
  {
    title: "7. Disclaimers & liability",
    body: [
      "The Service is provided “as is” without warranties to the maximum extent permitted by law.",
      "Our liability is limited as described in the full Terms. Some jurisdictions may not allow certain limitations.",
    ],
  },
  {
    title: "8. Governing law",
    body: [
      "These Terms are governed by the laws of India. Courts in [FILL IN — e.g. Bangalore, Karnataka] have jurisdiction unless mandatory consumer law requires otherwise.",
    ],
  },
  {
    title: "9. Contact",
    body: [
      "[Legal Entity Name] · [FILL IN address]",
      "Email: [FILL IN support@skinfit.app] · Phone: [FILL IN phone]",
    ],
  },
];

export default function TermsPage() {
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
          Terms of Service
        </h1>
        <p className="mt-4 text-slate-600">
          Last updated: [FILL IN DATE]. Full version for store submission:{" "}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-sm">
            docs/store-submission/terms-of-service.md
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
          <Link href="/privacy" className="text-teal-600 hover:text-teal-700">
            Privacy Policy
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
