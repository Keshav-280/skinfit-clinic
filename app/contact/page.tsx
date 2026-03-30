"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "../../components/ui/Button";
import {
  Sparkles,
  Phone,
  Mail,
  MapPin,
  Building2,
  Clock,
  Gift,
} from "lucide-react";

const sectionVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

const itemVariant = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const services = [
  "Acne Treatment",
  "Pigmentation",
  "Wrinkles & Anti-Aging",
  "Hair Loss & Scalp Health",
  "General Consultation",
];

export default function ContactPage() {
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
              className="text-sm font-medium text-teal-600 transition-colors hover:text-teal-700"
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

      {/* Main Section */}
      <motion.section
        className="py-20"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-60px" }}
        variants={sectionVariants}
      >
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16">
            {/* Left Column - Clinic & Offer */}
            <div className="space-y-6">
              <motion.div variants={itemVariant} className="relative">
                {/* Premium Image Placeholder */}
                <div className="relative overflow-hidden rounded-2xl border border-white/20 bg-white/5 shadow-xl backdrop-blur-xl">
                  <div className="absolute inset-0 bg-gradient-to-br from-teal-500/80 via-cyan-500/60 to-teal-600/80" />
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(15,23,42,0.3)_100%)]" />
                  <div className="relative flex aspect-[4/3] min-h-[280px] items-center justify-center p-8">
                    <Building2 className="h-24 w-24 text-white/20 md:h-32 md:w-32" strokeWidth={0.75} />
                  </div>

                  {/* Floating Special Offer Badge */}
                  <div className="absolute right-4 top-4 md:right-6 md:top-6">
                    <div className="flex items-center gap-2 rounded-xl border border-white/30 bg-white/20 px-4 py-2.5 shadow-lg backdrop-blur-md">
                      <Gift className="h-5 w-5 text-white" />
                      <span className="text-sm font-semibold text-white">
                        Free AI Skin Scan with first consultation
                      </span>
                    </div>
                  </div>
                </div>

                {/* Clinic Info */}
                <div className="mt-6 space-y-4">
                  <motion.div
                    variants={itemVariant}
                    className="flex items-start gap-3 rounded-xl border border-slate-200/80 bg-white/60 p-4 backdrop-blur-sm"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-50">
                      <MapPin className="h-5 w-5 text-teal-600" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Address
                      </p>
                      <p className="text-slate-800">
                        123 Medical Plaza, Bangalore, Karnataka 560001
                      </p>
                    </div>
                  </motion.div>

                  <motion.div
                    variants={itemVariant}
                    className="flex items-start gap-3 rounded-xl border border-slate-200/80 bg-white/60 p-4 backdrop-blur-sm"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-50">
                      <Phone className="h-5 w-5 text-teal-600" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Phone
                      </p>
                      <p className="text-slate-800">+91 98765 43210</p>
                    </div>
                  </motion.div>

                  <motion.div
                    variants={itemVariant}
                    className="flex items-start gap-3 rounded-xl border border-slate-200/80 bg-white/60 p-4 backdrop-blur-sm"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-50">
                      <Clock className="h-5 w-5 text-teal-600" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Working Hours
                      </p>
                      <p className="text-slate-800">
                        Mon–Sat, 10:00 AM – 7:00 PM
                      </p>
                    </div>
                  </motion.div>
                </div>
              </motion.div>
            </div>

            {/* Right Column - Booking Form */}
            <motion.div variants={itemVariant}>
              <div className="rounded-2xl border border-slate-200/80 bg-white p-8 shadow-xl">
                <h2 className="mb-6 text-2xl font-bold tracking-tight text-slate-900">
                  Book Your Appointment
                </h2>

                <form className="space-y-5">
                  <div>
                    <label
                      htmlFor="name"
                      className="mb-1.5 block text-sm font-medium text-slate-700"
                    >
                      Full Name
                    </label>
                    <input
                      id="name"
                      type="text"
                      required
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                      placeholder="Enter your full name"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="email"
                      className="mb-1.5 block text-sm font-medium text-slate-700"
                    >
                      Email
                    </label>
                    <input
                      id="email"
                      type="email"
                      required
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                      placeholder="you@example.com"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="phone"
                      className="mb-1.5 block text-sm font-medium text-slate-700"
                    >
                      Phone Number
                    </label>
                    <input
                      id="phone"
                      type="tel"
                      required
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                      placeholder="+91 98765 43210"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="service"
                      className="mb-1.5 block text-sm font-medium text-slate-700"
                    >
                      Service Interested In
                    </label>
                    <select
                      id="service"
                      required
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                    >
                      <option value="">Select a service</option>
                      {services.map((service) => (
                        <option key={service} value={service}>
                          {service}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="message"
                      className="mb-1.5 block text-sm font-medium text-slate-700"
                    >
                      Message <span className="text-slate-400">(optional)</span>
                    </label>
                    <textarea
                      id="message"
                      rows={4}
                      className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                      placeholder="Share any specific concerns or questions..."
                    />
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    className="w-full shadow-lg shadow-teal-600/20"
                  >
                    Request Appointment
                  </Button>
                </form>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.section>

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
