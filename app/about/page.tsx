"use client";

import Link from "next/link";
import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Button } from "../../components/ui/Button";
import {
  Sparkles,
  Target,
  Cpu,
  LayoutDashboard,
  TrendingUp,
  Heart,
  Droplets,
  Moon,
  Phone,
  Mail,
  MapPin,
  Eye,
  Dna,
  Shield,
} from "lucide-react";

const sectionVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.1,
    },
  },
};

const titleVariant = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const textVariant = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const iconVariant = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.4 } },
};

function TechVisualization({
  icon: Icon,
  gradient,
  className = "",
}: {
  icon: React.ElementType;
  gradient: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [40, 0, 0, -40]);

  return (
    <motion.div
      ref={ref}
      style={{ y }}
      className={`relative ${className}`}
    >
      <div className="overflow-hidden rounded-[2rem] border border-white/20 bg-white/5 shadow-2xl shadow-slate-900/20 backdrop-blur-xl lg:rounded-[3rem]">
        <div
          className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-90`}
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(15,23,42,0.4)_100%)]" />
        <div className="relative flex aspect-[4/3] min-h-[280px] items-center justify-center p-8">
          <Icon className="h-32 w-32 text-white/10 md:h-40 md:w-40" strokeWidth={0.5} />
        </div>
      </div>
    </motion.div>
  );
}

export default function AboutPage() {
  return (
    <div className="relative min-h-screen bg-white text-slate-800">
      {/* Subtle dot grid background */}
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.03]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgb(15 23 42) 1px, transparent 0)`,
          backgroundSize: "32px 32px",
        }}
      />

      {/* Sticky Navbar */}
      <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-teal-600 text-white shadow-lg shadow-teal-600/25">
              <Sparkles className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-800">
              SkinnFit
            </span>
          </Link>

          <div className="hidden items-center gap-8 md:flex">
            <Link href="/" className="text-sm font-medium text-slate-600 transition-colors hover:text-teal-600">
              Home
            </Link>
            <Link href="/services" className="text-sm font-medium text-slate-600 transition-colors hover:text-teal-600">
              Services
            </Link>
            <Link href="/blog" className="text-sm font-medium text-slate-600 transition-colors hover:text-teal-600">
              Blog/Education
            </Link>
            <Link href="/about" className="text-sm font-medium text-teal-600 transition-colors hover:text-teal-700">
              About Us
            </Link>
            <Link href="/contact" className="text-sm font-medium text-slate-600 transition-colors hover:text-teal-600">
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

      <div className="relative z-10">
        {/* History & Vision (Hero) - Text left, Image right */}
        <motion.section
          className="relative py-24 md:py-28"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={sectionVariants}
        >
          <div className="mx-auto max-w-7xl px-6">
            <div className="grid grid-cols-1 gap-12 items-center lg:grid-cols-2 lg:gap-24">
              <div className="space-y-6">
                <motion.div variants={iconVariant} className="inline-flex">
                  <span className="inline-flex items-center gap-2 rounded-full border border-teal-200/60 bg-teal-50/80 px-4 py-2 text-sm font-medium text-teal-700 shadow-sm backdrop-blur-sm">
                    <Eye className="h-4 w-4" />
                    Our Story
                  </span>
                </motion.div>
                <motion.h1
                  variants={titleVariant}
                  className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl"
                >
                  The SkinnFit Vision
                </motion.h1>
                <motion.p variants={textVariant} className="text-lg leading-relaxed text-slate-600">
                  We believe that dermatology should be precise, personalized, and
                  accessible. Our mission is to combine expert clinical care with
                  cutting-edge AI—so every patient receives a treatment plan tailored
                  to their unique skin, backed by data and delivered with empathy.
                </motion.p>
                <motion.p variants={textVariant} className="text-slate-600">
                  SkinnFit was founded to bridge the gap between traditional
                  dermatology and modern technology. We bring together board-certified
                  specialists, proprietary AI analysis, and a patient-first mindset to
                  deliver results that last.
                </motion.p>
              </div>
              <div>
                <TechVisualization
                  icon={Sparkles}
                  gradient="from-teal-500/90 via-cyan-500/80 to-teal-600/90"
                />
              </div>
            </div>
          </div>
        </motion.section>

        {/* Our Approach - Image left, Text right */}
        <motion.section
          className="relative border-t border-slate-200/60 bg-slate-50/30 py-24 md:py-28"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={sectionVariants}
        >
          <div className="mx-auto max-w-7xl px-6">
            <div className="grid grid-cols-1 gap-12 items-center lg:grid-cols-2 lg:gap-24">
              <div className="order-2 lg:order-1">
                <TechVisualization
                  icon={Dna}
                  gradient="from-emerald-500/90 via-teal-500/80 to-cyan-600/90"
                />
              </div>
              <div className="order-1 space-y-6 lg:order-2">
                <motion.div variants={iconVariant} className="inline-flex">
                  <span className="inline-flex items-center gap-2 rounded-lg bg-teal-50/80 px-3 py-2 text-sm font-semibold text-teal-700 shadow-sm backdrop-blur-sm">
                    <Target className="h-5 w-5 text-teal-600" />
                    Our Approach
                  </span>
                </motion.div>
                <motion.h2
                  variants={titleVariant}
                  className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl"
                >
                  Clinical Methodology, Patient-First
                </motion.h2>
                <motion.p variants={textVariant} className="text-lg leading-relaxed text-slate-600">
                  Every consultation starts with listening. We take time to understand
                  your concerns, lifestyle, and goals before recommending any treatment.
                  Our clinical methodology is evidence-based, transparent, and designed
                  for long-term skin health—not quick fixes.
                </motion.p>
                <motion.p variants={textVariant} className="text-slate-600">
                  We combine diagnostic precision with a compassionate approach. Our
                  team follows global best practices and safety protocols while keeping
                  you informed and empowered at every step.
                </motion.p>
              </div>
            </div>
          </div>
        </motion.section>

        {/* About Our AI-Models - Text left, Image right */}
        <motion.section
          className="relative py-24 md:py-28"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={sectionVariants}
        >
          <div className="mx-auto max-w-7xl px-6">
            <div className="grid grid-cols-1 gap-12 items-center lg:grid-cols-2 lg:gap-24">
              <div className="space-y-6">
                <motion.div variants={iconVariant} className="inline-flex">
                  <span className="inline-flex items-center gap-2 rounded-lg bg-teal-50/80 px-3 py-2 text-sm font-semibold text-teal-700 shadow-sm backdrop-blur-sm">
                    <Cpu className="h-5 w-5 text-teal-600" />
                    Technology
                  </span>
                </motion.div>
                <motion.h2
                  variants={titleVariant}
                  className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl"
                >
                  About Our AI Models
                </motion.h2>
                <motion.p variants={textVariant} className="text-lg leading-relaxed text-slate-600">
                  Our proprietary face-scanning AI analyzes skin parameters with
                  clinically validated accuracy. It detects and quantifies acne
                  severity, pigmentation patterns, fine lines, wrinkles, and texture
                  concerns—giving you and your dermatologist a clear baseline for
                  treatment planning.
                </motion.p>
                <motion.p variants={textVariant} className="text-slate-600">
                  The AI is trained on diverse skin types and conditions, ensuring
                  reliable results across populations. It supports—not replaces—our
                  human expertise, helping clinicians make faster, more informed
                  decisions while you see exactly how your skin is changing over time.
                </motion.p>
              </div>
              <div>
                <TechVisualization
                  icon={Cpu}
                  gradient="from-cyan-500/90 via-teal-500/80 to-blue-600/90"
                />
              </div>
            </div>
          </div>
        </motion.section>

        {/* Personalization & Dashboard - Image left, Text right */}
        <motion.section
          className="relative border-t border-slate-200/60 bg-slate-50/30 py-24 md:py-28"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={sectionVariants}
        >
          <div className="mx-auto max-w-7xl px-6">
            <div className="grid grid-cols-1 gap-12 items-center lg:grid-cols-2 lg:gap-24">
              <div className="order-2 lg:order-1">
                <TechVisualization
                  icon={LayoutDashboard}
                  gradient="from-teal-600/90 via-cyan-500/80 to-teal-500/90"
                />
              </div>
              <div className="order-1 space-y-6 lg:order-2">
                <motion.div variants={iconVariant} className="inline-flex">
                  <span className="inline-flex items-center gap-2 rounded-lg bg-teal-50/80 px-3 py-2 text-sm font-semibold text-teal-700 shadow-sm backdrop-blur-sm">
                    <LayoutDashboard className="h-5 w-5 text-teal-600" />
                    Personalization
                  </span>
                </motion.div>
                <motion.h2
                  variants={titleVariant}
                  className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl"
                >
                  Your Private Dashboard
                </motion.h2>
                <motion.p variants={textVariant} className="text-lg leading-relaxed text-slate-600">
                  Every patient gets a secure, HIPAA-ready private dashboard. Your
                  personalized routine, treatment history, and skin scan results live
                  in one place—accessible only to you and your care team.
                </motion.p>
                <motion.p variants={textVariant} className="text-slate-600">
                  Your dashboard is customized to your treatment plan. You&apos;ll see your
                  daily routines, reminders, and progress at a glance—so you stay
                  accountable and informed without the overwhelm.
                </motion.p>
                <motion.div variants={iconVariant} className="inline-flex items-center gap-2 rounded-lg border border-teal-200/60 bg-white/60 px-4 py-2 backdrop-blur-sm">
                  <Shield className="h-4 w-4 text-teal-600" />
                  <span className="text-sm font-medium text-slate-700">HIPAA-ready</span>
                </motion.div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Tracking, Follow-up & Wellness Targets - Text left, Image right */}
        <motion.section
          className="relative py-24 md:py-28"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={sectionVariants}
        >
          <div className="mx-auto max-w-7xl px-6">
            <div className="grid grid-cols-1 gap-12 items-center lg:grid-cols-2 lg:gap-24">
              <div className="space-y-6">
                <motion.div variants={iconVariant} className="inline-flex">
                  <span className="inline-flex items-center gap-2 rounded-lg bg-teal-50/80 px-3 py-2 text-sm font-semibold text-teal-700 shadow-sm backdrop-blur-sm">
                    <TrendingUp className="h-5 w-5 text-teal-600" />
                    Holistic Care
                  </span>
                </motion.div>
                <motion.h2
                  variants={titleVariant}
                  className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl"
                >
                  Tracking, Follow-up & Wellness Targets
                </motion.h2>
                <motion.p variants={textVariant} className="text-lg leading-relaxed text-slate-600">
                  Skin health doesn&apos;t exist in isolation. We take a holistic approach:
                  tracking sleep, water intake, stress, and lifestyle inputs alongside
                  your skin scores over time. This helps us spot patterns and adjust
                  your plan for better, faster results.
                </motion.p>
                <motion.div variants={textVariant} className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white/80 px-4 py-3 shadow-lg shadow-slate-200/50 backdrop-blur-sm">
                    <Moon className="h-5 w-5 text-teal-600" />
                    <span className="text-sm font-medium text-slate-700">Sleep</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white/80 px-4 py-3 shadow-lg shadow-slate-200/50 backdrop-blur-sm">
                    <Droplets className="h-5 w-5 text-teal-600" />
                    <span className="text-sm font-medium text-slate-700">Hydration</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white/80 px-4 py-3 shadow-lg shadow-slate-200/50 backdrop-blur-sm">
                    <Heart className="h-5 w-5 text-teal-600" />
                    <span className="text-sm font-medium text-slate-700">Stress</span>
                  </div>
                </motion.div>
                <motion.p variants={textVariant} className="text-slate-600">
                  Regular follow-ups and wellness targets keep you on track. Your
                  dermatologist reviews your progress and refines your plan—so you
                  achieve sustainable, lasting results.
                </motion.p>
              </div>
              <div>
                <TechVisualization
                  icon={TrendingUp}
                  gradient="from-teal-500/90 via-emerald-500/80 to-cyan-600/90"
                />
              </div>
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
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-teal-600 shadow-lg shadow-teal-600/20">
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
                  <li><Link href="/" className="hover:text-teal-400">Home</Link></li>
                  <li><Link href="/services" className="hover:text-teal-400">Services</Link></li>
                  <li><Link href="/blog" className="hover:text-teal-400">Blog</Link></li>
                  <li><Link href="/about" className="hover:text-teal-400">About Us</Link></li>
                  <li><Link href="/contact" className="hover:text-teal-400">Contact</Link></li>
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
    </div>
  );
}
