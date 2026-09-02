"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { Scan } from "lucide-react";
import { PublicBrandMark } from "../../components/nav/PublicBrandMark";

export default function Home() {
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
  });

  // Scene 1: The Hero (0.0 to 0.2)
  const heroOpacity = useTransform(scrollYProgress, [0, 0.1, 0.2], [1, 1, 0]);
  const phoneScale = useTransform(scrollYProgress, [0, 0.1, 0.2], [0.8, 1, 2]);
  const phoneY = useTransform(
    scrollYProgress,
    [0, 0.1, 0.2],
    ["20vh", "0vh", "-100vh"]
  );

  // Scene 2: The 8-Engine AI Tech (0.2 to 0.5)
  const techOpacity = useTransform(
    scrollYProgress,
    [0.2, 0.25, 0.45, 0.5],
    [0, 1, 1, 0]
  );
  const techY = useTransform(
    scrollYProgress,
    [0.2, 0.25, 0.45, 0.5],
    ["10vh", "0vh", "0vh", "-10vh"]
  );
  const acneCardOpacity = useTransform(
    scrollYProgress,
    [0.25, 0.3, 0.4],
    [0, 1, 1]
  );
  const wrinklesCardOpacity = useTransform(
    scrollYProgress,
    [0.28, 0.33, 0.4],
    [0, 1, 1]
  );
  const pigmentationCardOpacity = useTransform(
    scrollYProgress,
    [0.31, 0.36, 0.4],
    [0, 1, 1]
  );

  // Scene 3: The B2B2C Ecosystem (0.5 to 0.8)
  const ecoOpacity = useTransform(
    scrollYProgress,
    [0.5, 0.55, 0.75, 0.8],
    [0, 1, 1, 0]
  );
  const patientSideX = useTransform(
    scrollYProgress,
    [0.5, 0.6],
    ["-50vw", "0vw"]
  );
  const clinicSideX = useTransform(
    scrollYProgress,
    [0.5, 0.6],
    ["50vw", "0vw"]
  );

  // Scene 4: The Final CTA (0.8 to 1.0)
  const ctaOpacity = useTransform(scrollYProgress, [0.8, 0.9, 1], [0, 1, 1]);
  const ctaScale = useTransform(scrollYProgress, [0.8, 0.9, 1], [0.9, 1, 1]);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Sticky Navbar - dark theme */}
      <nav className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <PublicBrandMark href="/home" invert />

          <div className="hidden items-center gap-8 md:flex">
            <Link
              href="/home"
              className="text-sm font-medium text-[#DF9DA4] transition-colors hover:text-[#DF9DA4]"
            >
              Home
            </Link>
            <Link
              href="/services"
              className="text-sm font-medium text-zinc-400 transition-colors hover:text-white"
            >
              Services
            </Link>
            <Link
              href="/blog"
              className="text-sm font-medium text-zinc-400 transition-colors hover:text-white"
            >
              Blog
            </Link>
            <Link
              href="/about"
              className="text-sm font-medium text-zinc-400 transition-colors hover:text-white"
            >
              About
            </Link>
            <Link
              href="/contact"
              className="text-sm font-medium text-zinc-400 transition-colors hover:text-white"
            >
              Contact
            </Link>
          </div>

          <Link
            href="/login"
            className="rounded-full bg-[#1E1B31] px-4 py-2 text-sm font-medium text-white shadow-[0_0_20px_rgba(20,184,166,0.3)] transition-all hover:bg-[#F8EDEE]0 hover:shadow-[0_0_30px_rgba(20,184,166,0.4)]"
          >
            <Scan className="mr-2 inline-block h-4 w-4" />
            Patient Login
          </Link>
        </div>
      </nav>

      {/* Scroll-driven cinematic container */}
      <div
        ref={containerRef}
        className="h-[500vh] w-full bg-zinc-950"
      >
        <div className="sticky top-0 flex h-screen w-full items-center justify-center overflow-hidden">
          {/* Scene 1: The Hero */}
          <motion.div
            style={{ opacity: heroOpacity }}
            className="absolute inset-0 flex flex-col items-center justify-center"
          >
            <motion.div
              style={{
                scale: phoneScale,
                y: phoneY,
              }}
              className="relative z-10 flex flex-col items-center gap-8"
            >
              <h1 className="text-center text-5xl font-bold tracking-tight text-white md:text-7xl lg:text-8xl">
                Clinical AI,
                <br />
                in your pocket.
              </h1>
              <div
                className="relative w-72 rounded-[3rem] border-[8px] border-zinc-800 bg-zinc-900 shadow-[0_0_60px_rgba(20,184,166,0.25)]"
                style={{ height: 600 }}
              >
                <div className="absolute left-1/2 top-0 h-6 w-32 -translate-x-1/2 rounded-b-2xl bg-zinc-900" />
                <div className="flex h-full items-center justify-center p-6 pt-12">
                  <div className="text-center">
                    <div className="mx-auto mb-4 h-20 w-20 rounded-2xl bg-[#F8EDEE]0/20" />
                    <p className="text-sm text-zinc-500">SkinFit App</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>

          {/* Scene 2: The 8-Engine AI Tech */}
          <motion.div
            style={{
              opacity: techOpacity,
              y: techY,
            }}
            className="absolute inset-0 flex flex-col items-center justify-center"
          >
            <h2 className="mb-4 text-center text-4xl font-bold tracking-tight text-white md:text-5xl">
              Proprietary 8-Engine Analysis
            </h2>
            <p className="mb-12 max-w-xl px-4 text-center text-sm leading-relaxed text-zinc-400 md:text-base">
              One front-face photo in the app - multi-metric scores, clinical 1-5 readouts, and
              annotated findings on your report.
            </p>

            {/* Abstract facial scanning geometry */}
            <div className="relative mb-16">
              <div className="relative h-64 w-64 md:h-80 md:w-80">
                {/* Bounding box */}
                <div className="absolute inset-0 rounded-3xl border-2 border-[#DF9DA4]/50 shadow-[0_0_40px_rgba(20,184,166,0.15)]" />
                {/* Polygon overlays - face mesh simulation */}
                <svg
                  className="absolute inset-0 h-full w-full"
                  viewBox="0 0 256 256"
                  fill="none"
                >
                  <polygon
                    points="128,40 180,90 180,166 128,210 76,166 76,90"
                    stroke="rgba(20,184,166,0.4)"
                    strokeWidth="1.5"
                    fill="transparent"
                  />
                  <polygon
                    points="100,100 156,100 140,140 116,140"
                    stroke="rgba(20,184,166,0.5)"
                    strokeWidth="1"
                    fill="transparent"
                  />
                  <circle
                    cx="110"
                    cy="90"
                    r="8"
                    stroke="rgba(20,184,166,0.6)"
                    strokeWidth="1"
                    fill="transparent"
                  />
                  <circle
                    cx="146"
                    cy="90"
                    r="8"
                    stroke="rgba(20,184,166,0.6)"
                    strokeWidth="1"
                    fill="transparent"
                  />
                </svg>
              </div>
            </div>

            {/* Staggered AI engine cards */}
            <div className="flex flex-wrap items-center justify-center gap-6 px-6">
              <motion.div
                style={{ opacity: acneCardOpacity }}
                className="w-48 rounded-2xl border border-zinc-700 bg-zinc-900/90 p-6 shadow-[0_0_30px_rgba(20,184,166,0.1)] backdrop-blur-sm"
              >
                <div className="mb-3 h-10 w-10 rounded-lg bg-[#F8EDEE]0/20" />
                <h3 className="mb-1 font-semibold text-white">Acne</h3>
                <p className="text-sm text-zinc-400">Blemish detection</p>
              </motion.div>
              <motion.div
                style={{ opacity: wrinklesCardOpacity }}
                className="w-48 rounded-2xl border border-zinc-700 bg-zinc-900/90 p-6 shadow-[0_0_30px_rgba(20,184,166,0.1)] backdrop-blur-sm"
              >
                <div className="mb-3 h-10 w-10 rounded-lg bg-[#F8EDEE]0/20" />
                <h3 className="mb-1 font-semibold text-white">Wrinkles</h3>
                <p className="text-sm text-zinc-400">Aging analysis</p>
              </motion.div>
              <motion.div
                style={{ opacity: pigmentationCardOpacity }}
                className="w-48 rounded-2xl border border-zinc-700 bg-zinc-900/90 p-6 shadow-[0_0_30px_rgba(20,184,166,0.1)] backdrop-blur-sm"
              >
                <div className="mb-3 h-10 w-10 rounded-lg bg-[#F8EDEE]0/20" />
                <h3 className="mb-1 font-semibold text-white">Pigmentation</h3>
                <p className="text-sm text-zinc-400">Tone mapping</p>
              </motion.div>
            </div>
          </motion.div>

          {/* Scene 3: The B2B2C Ecosystem */}
          <motion.div
            style={{ opacity: ecoOpacity }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <div className="flex w-full max-w-6xl items-center justify-between gap-12 px-8">
              {/* For Patients - Mobile */}
              <motion.div
                style={{ x: patientSideX }}
                className="flex flex-1 flex-col items-center"
              >
                <h3 className="mb-6 text-2xl font-bold tracking-tight text-white md:text-3xl">
                  For Patients
                </h3>
                <div
                  className="relative w-44 rounded-[2rem] border-[6px] border-zinc-800 bg-zinc-900 shadow-[0_0_50px_rgba(20,184,166,0.2)]"
                  style={{ height: 480 }}
                >
                  <div className="absolute left-1/2 top-0 h-5 w-24 -translate-x-1/2 rounded-b-xl bg-zinc-900" />
                  <div className="flex h-full items-center justify-center p-4 pt-8">
                    <div className="text-center">
                      <div className="mx-auto mb-3 h-12 w-12 rounded-xl bg-[#F8EDEE]0/20" />
                      <p className="text-xs text-zinc-500">SkinFit App</p>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Center divider */}
              <div className="hidden h-px flex-1 bg-gradient-to-r from-transparent via-[#DF9DA4]/30 to-transparent md:block" />

              {/* For Providers - iPad */}
              <motion.div
                style={{ x: clinicSideX }}
                className="flex flex-1 flex-col items-center"
              >
                <h3 className="mb-6 text-2xl font-bold tracking-tight text-white md:text-3xl">
                  For Providers
                </h3>
                <div
                  className="w-64 rounded-2xl border-[6px] border-zinc-800 bg-zinc-900 shadow-[0_0_50px_rgba(20,184,166,0.2)]"
                  style={{ height: 360 }}
                >
                  <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
                    <div className="grid grid-cols-2 gap-2">
                      {[1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className="h-16 w-16 rounded-lg border border-zinc-700 bg-zinc-800/50"
                        />
                      ))}
                    </div>
                    <p className="text-xs text-zinc-500">Clinic Command Center</p>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>

          {/* Scene 4: The Final CTA */}
          <motion.div
            style={{
              opacity: ctaOpacity,
              scale: ctaScale,
            }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <div className="mx-auto max-w-2xl px-6 text-center">
              <div className="rounded-3xl border border-zinc-700 bg-zinc-900/80 p-12 shadow-[0_0_80px_rgba(20,184,166,0.15)] backdrop-blur-md md:p-16">
                <h2 className="mb-6 text-4xl font-bold tracking-tight text-white md:text-5xl lg:text-6xl">
                  Transform Your Clinic Today.
                </h2>
                <p className="mb-8 text-lg text-zinc-400">
                  Join the future of AI-powered dermatology
                </p>
                <Link
                  href="/contact"
                  className="inline-flex items-center justify-center rounded-full bg-[#1E1B31] px-8 py-4 text-lg font-semibold text-white shadow-[0_0_40px_rgba(20,184,166,0.4)] transition-all hover:bg-[#F8EDEE]0 hover:shadow-[0_0_60px_rgba(20,184,166,0.5)]"
                >
                  Book Inauguration Demo
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Minimal Footer */}
      <footer className="border-t border-zinc-800 bg-zinc-950 py-12">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <div className="mb-4 flex items-center justify-center">
            <PublicBrandMark href="/home" invert />
          </div>
          <p className="text-sm text-zinc-500">
            © {new Date().getFullYear()} SkinFit Wellness. All rights reserved.
          </p>
          <div className="mt-4 flex justify-center gap-6 text-sm">
            <Link href="/services" className="text-zinc-400 hover:text-[#DF9DA4]">
              Services
            </Link>
            <Link href="/contact" className="text-zinc-400 hover:text-[#DF9DA4]">
              Contact
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
