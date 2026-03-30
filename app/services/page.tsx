"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "../../components/ui/Button";
import {
  Sparkles,
  Scan,
  Target,
  Droplets,
  Wind,
  Phone,
  Mail,
  MapPin,
  ChevronRight,
} from "lucide-react";

const fadeInUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5 },
};

const services = [
  {
    title: "Acne Treatment",
    icon: Target,
    iconBg: "from-teal-50 to-teal-100",
    iconColor: "text-teal-600",
    whatItIs:
      "Medical-grade protocols combining chemical peels, laser therapy, and prescription treatments to clear active breakouts, reduce inflammation, and prevent scarring.",
    whoIsItFor:
      "Adults and teens with mild to severe acne, including hormonal acne, cystic acne, and post-acne scarring.",
    sessions: "6–12 sessions over 3–6 months, depending on severity. Maintenance sessions available.",
    expectedResults:
      "Clearer skin, reduced scarring, improved texture, and long-term prevention with personalized aftercare.",
  },
  {
    title: "Pigmentation",
    icon: Droplets,
    iconBg: "from-amber-50 to-amber-100",
    iconColor: "text-amber-600",
    whatItIs:
      "Advanced laser and light-based treatments targeting melasma, sun damage, post-inflammatory hyperpigmentation, and uneven skin tone.",
    whoIsItFor:
      "Anyone with dark spots, melasma, sun damage, or uneven skin tone seeking a more even complexion.",
    sessions: "4–8 sessions spaced 2–4 weeks apart. Some conditions may require ongoing maintenance.",
    expectedResults:
      "Significantly lighter pigmentation, more even skin tone, and a brighter, more radiant complexion.",
  },
  {
    title: "Wrinkles & Anti-Aging",
    icon: Sparkles,
    iconBg: "from-purple-50 to-purple-100",
    iconColor: "text-purple-600",
    whatItIs:
      "Non-surgical solutions including injectables, thread lifts, RF microneedling, and collagen-boosting therapies for natural, youthful results.",
    whoIsItFor:
      "Adults 25+ looking to prevent or reduce fine lines, wrinkles, volume loss, and skin laxity.",
    sessions: "Varies by treatment. Injectables: 2–4 times/year. Threads: 12–18 months. Lasers: 3–6 sessions.",
    expectedResults:
      "Smoother skin, restored volume, lifted contours, and a refreshed, natural-looking appearance.",
  },
  {
    title: "Hair Loss & Scalp Health",
    icon: Wind,
    iconBg: "from-emerald-50 to-emerald-100",
    iconColor: "text-emerald-600",
    whatItIs:
      "Trichology-focused care combining PRP, mesotherapy, laser therapy, and medical treatments for hair fall, thinning, and scalp conditions.",
    whoIsItFor:
      "Men and women experiencing hair thinning, pattern baldness, scalp conditions, or post-treatment hair loss.",
    sessions: "6–12 sessions for PRP/mesotherapy. Maintenance every 3–6 months. Laser: ongoing use at home or in-clinic.",
    expectedResults:
      "Reduced shedding, thicker hair, improved density, and healthier scalp. Results typically visible in 3–6 months.",
  },
];

export default function ServicesPage() {
  return (
    <div className="min-h-screen bg-white text-slate-800">
      {/* Sticky Navbar */}
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

          <div className="hidden items-center gap-8 md:flex">
            <Link
              href="/"
              className="text-sm font-medium text-slate-600 transition-colors hover:text-teal-600"
            >
              Home
            </Link>
            <Link
              href="/services"
              className="text-sm font-medium text-teal-600 transition-colors hover:text-teal-700"
            >
              Services
            </Link>
            <Link
              href="/blog"
              className="text-sm font-medium text-slate-600 transition-colors hover:text-teal-600"
            >
              Blog/Education
            </Link>
            <Link
              href="/about"
              className="text-sm font-medium text-slate-600 transition-colors hover:text-teal-600"
            >
              About Us
            </Link>
            <Link
              href="/contact"
              className="text-sm font-medium text-slate-600 transition-colors hover:text-teal-600"
            >
              Contact
            </Link>
          </div>

          <Link href="/login">
            <Button size="md" variant="primary">
              Patient Login
            </Button>
          </Link>
        </div>
      </nav>

      {/* AI Scan Banner */}
      <motion.section
        className="relative overflow-hidden bg-gradient-to-r from-teal-600 to-teal-700 py-16 text-white"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.05\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-100" />
        <div className="relative mx-auto max-w-7xl px-6">
          <div className="flex flex-col items-center justify-between gap-8 md:flex-row md:gap-12">
            <div className="max-w-2xl text-center md:text-left">
              <h2 className="mb-3 text-3xl font-bold tracking-tight md:text-4xl">
                Discover Your Personalized Treatment Plan
              </h2>
              <p className="text-lg text-teal-50">
                Know about your skin with our AI-powered analysis. Get a custom
                roadmap designed for your unique concerns and goals.
              </p>
            </div>
            <Link href="/" className="shrink-0">
              <Button
                size="lg"
                className="border-white/30 bg-white text-teal-700 shadow-xl hover:bg-white/95"
              >
                <Scan className="mr-2 h-5 w-5" />
                Start AI Scan
              </Button>
            </Link>
          </div>
        </div>
      </motion.section>

      {/* Services Grid */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-6">
          <motion.div
            className="mb-16 text-center"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="mb-4 text-4xl font-bold tracking-tight text-slate-900">
              Our Procedures
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-slate-600">
              Evidence-based treatments delivered by board-certified specialists.
              Each plan is tailored to your skin, lifestyle, and goals.
            </p>
          </motion.div>

          <div className="grid gap-8 md:grid-cols-2">
            {services.map((service, index) => {
              const Icon = service.icon;
              return (
                <motion.article
                  key={service.title}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-xl"
                >
                  <div className="p-8">
                    <div
                      className={`mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${service.iconBg}`}
                    >
                      <Icon className={`h-7 w-7 ${service.iconColor}`} />
                    </div>

                    <h3 className="mb-6 text-2xl font-bold text-slate-900">
                      {service.title}
                    </h3>

                    <div className="space-y-5">
                      <div>
                        <h4 className="mb-1.5 text-sm font-semibold uppercase tracking-wide text-teal-600">
                          What it is
                        </h4>
                        <p className="text-slate-600">{service.whatItIs}</p>
                      </div>

                      <div>
                        <h4 className="mb-1.5 text-sm font-semibold uppercase tracking-wide text-teal-600">
                          Who is it for
                        </h4>
                        <p className="text-slate-600">{service.whoIsItFor}</p>
                      </div>

                      <div>
                        <h4 className="mb-1.5 text-sm font-semibold uppercase tracking-wide text-teal-600">
                          How many sessions
                        </h4>
                        <p className="text-slate-600">{service.sessions}</p>
                      </div>

                      <div>
                        <h4 className="mb-1.5 text-sm font-semibold uppercase tracking-wide text-teal-600">
                          Expected Results
                        </h4>
                        <p className="text-slate-600">{service.expectedResults}</p>
                      </div>
                    </div>

                    <Link
                      href="/contact"
                      className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-teal-600 transition-colors hover:text-teal-700"
                    >
                      View Details
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </div>
                </motion.article>
              );
            })}
          </div>
        </div>
      </section>

      {/* Global Footer */}
      <motion.footer
        className="border-t border-slate-200 bg-slate-900 py-12 text-white"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
      >
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-12 md:grid-cols-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-teal-600 shadow-lg">
                  <Sparkles className="h-5 w-5" />
                </div>
                <span className="text-xl font-bold">SkinnFit</span>
              </div>
              <p className="text-sm text-slate-400">
                Advanced AI-powered dermatology clinic offering personalized skincare
                solutions.
              </p>
            </div>

            <div>
              <h4 className="mb-4 font-semibold">Quick Links</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>
                  <Link href="/" className="hover:text-teal-400">
                    Home
                  </Link>
                </li>
                <li>
                  <Link href="/services" className="hover:text-teal-400">
                    Services
                  </Link>
                </li>
                <li>
                  <Link href="/blog" className="hover:text-teal-400">
                    Blog
                  </Link>
                </li>
                <li>
                  <Link href="/about" className="hover:text-teal-400">
                    About Us
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className="hover:text-teal-400">
                    Contact
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="mb-4 font-semibold">Treatments</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>Acne Treatment</li>
                <li>Pigmentation</li>
                <li>Anti-Aging</li>
                <li>Hair Loss</li>
              </ul>
            </div>

            <div>
              <h4 className="mb-4 font-semibold">Contact Us</h4>
              <ul className="space-y-3 text-sm text-slate-400">
                <li className="flex items-start gap-2">
                  <Phone className="h-4 w-4 shrink-0 text-teal-400" />
                  <span>+91 98765 43210</span>
                </li>
                <li className="flex items-start gap-2">
                  <Mail className="h-4 w-4 shrink-0 text-teal-400" />
                  <span>hello@skinfit.clinic</span>
                </li>
                <li className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 shrink-0 text-teal-400" />
                  <span>123 Medical Plaza, Bangalore, Karnataka 560001</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-12 border-t border-slate-800 pt-8 text-center text-sm text-slate-500">
            <p>
              © {new Date().getFullYear()} SkinnFit Clinic. All rights reserved. |
              Privacy Policy | Terms of Service
            </p>
          </div>
        </div>
      </motion.footer>
    </div>
  );
}
