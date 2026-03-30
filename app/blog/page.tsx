"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "../../components/ui/Button";
import {
  Sparkles,
  Phone,
  Mail,
  MapPin,
  Play,
} from "lucide-react";

const fadeInUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5 },
};

const categories = [
  {
    title: "Skincare Basics",
    cards: [
      {
        title: "The Daily Routine: Cleanser, Toner, Moisturizer",
        description:
          "Learn why order matters and how to build a routine that actually works for your skin.",
      },
      {
        title: "SPF 101: What Sunscreen Actually Does",
        description:
          "Dermatologist-backed facts on UV protection, reapplication, and choosing the right formula.",
      },
      {
        title: "Skin Types Explained: Finding Your Fit",
        description:
          "Oily, dry, combination—understand your skin type and tailor your products accordingly.",
      },
      {
        title: "Ingredients 101: Retinol, Vitamin C, Niacinamide",
        description:
          "A beginner-friendly guide to the actives that deliver real, visible results.",
      },
      {
        title: "How to Layer Skincare Without Pilling",
        description:
          "Get the most from your routine by applying products in the right order and timing.",
      },
    ],
  },
  {
    title: "Understanding Acne",
    cards: [
      {
        title: "What Causes Acne? Hormones, Diet, and Stress",
        description:
          "We break down the real drivers behind breakouts and what you can control.",
      },
      {
        title: "Acne vs. Rosacea: How to Tell the Difference",
        description:
          "Similar symptoms, different treatments—learn when to see a specialist.",
      },
      {
        title: "The Science Behind Breakouts and Healing",
        description:
          "From inflammation to scarring: how acne forms and how your skin repairs.",
      },
      {
        title: "Prescription vs. Over-the-Counter: When to Upgrade",
        description:
          "When OTC products aren't enough and it's time for medical intervention.",
      },
      {
        title: "Post-Acne Scarring: Prevention and Treatment",
        description:
          "Minimize scarring during active breakouts and treat existing marks effectively.",
      },
    ],
  },
  {
    title: "Treatment Deep-Dives",
    cards: [
      {
        title: "Chemical Peels: What to Expect Session by Session",
        description:
          "A step-by-step guide to peel types, downtime, and realistic results.",
      },
      {
        title: "Laser for Pigmentation: Q&A with Dr. Ruby Sachdev",
        description:
          "Expert answers on how lasers target dark spots and what to expect.",
      },
      {
        title: "Microneedling and RF: How They Stimulate Collagen",
        description:
          "The science behind needling and radiofrequency for smoother, firmer skin.",
      },
      {
        title: "PRP for Hair: The Science and the Results",
        description:
          "How platelet-rich plasma works for hair growth and what studies show.",
      },
      {
        title: "Botox vs. Fillers: When to Use Each",
        description:
          "Understand the difference and how dermatologists choose the right option.",
      },
    ],
  },
];

export default function BlogPage() {
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
              className="text-sm font-medium text-slate-600 transition-colors hover:text-teal-600"
            >
              Services
            </Link>
            <Link
              href="/blog"
              className="text-sm font-medium text-teal-600 transition-colors hover:text-teal-700"
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

      {/* Page Header */}
      <motion.section
        className="border-b border-slate-200 bg-slate-50/50 px-6 py-16"
        {...fadeInUp}
      >
        <div className="mx-auto max-w-7xl">
          <h1 className="mb-4 text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
            Patient Education & Resources
          </h1>
          <p className="max-w-2xl text-lg text-slate-600">
            Empowering you through knowledge. Evidence-based guides, videos, and
            articles to help you understand your skin and make informed decisions
            about your care.
          </p>
        </div>
      </motion.section>

      {/* Video/Article Categories - Netflix-style rows */}
      <div className="mx-auto max-w-7xl px-6 py-12">
        {categories.map((category, categoryIndex) => (
          <motion.section
            key={category.title}
            className="mb-16"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: categoryIndex * 0.1 }}
          >
            <h2 className="mb-6 text-2xl font-bold tracking-tight text-slate-900">
              {category.title}
            </h2>

            <div className="flex overflow-x-auto gap-6 pb-4 scrollbar-hide">
              {category.cards.map((card) => (
                <Link
                  key={card.title}
                  href="#"
                  className="group flex min-w-[280px] max-w-[320px] shrink-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all hover:shadow-xl hover:border-teal-200"
                >
                  {/* Thumbnail with Play overlay */}
                  <div className="relative aspect-video bg-gradient-to-br from-slate-800 to-slate-900">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm transition-all group-hover:bg-white/30 group-hover:scale-110">
                        <Play className="h-7 w-7 text-white ml-1" fill="white" />
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex flex-1 flex-col p-4">
                    <h3 className="mb-2 font-bold text-slate-900 transition-colors group-hover:text-teal-600">
                      {card.title}
                    </h3>
                    <p className="text-sm text-slate-600 line-clamp-2">
                      {card.description}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </motion.section>
        ))}
      </div>

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
