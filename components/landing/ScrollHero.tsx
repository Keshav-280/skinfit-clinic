"use client";

import { useRef } from "react";
import {
  motion,
  useScroll,
  useTransform,
} from "framer-motion";

export function ScrollHero() {
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  // Scene 1: The Hook – text fading in early and fading out
  const text1Opacity = useTransform(scrollYProgress, [0, 0.1, 0.2], [1, 1, 0]);
  const text1Y = useTransform(scrollYProgress, [0, 0.2], [0, -50]);

  // Scene 2: The App Reveal – glowing phone mockup scales up from bottom
  const phoneScale = useTransform(scrollYProgress, [0.15, 0.3, 0.5], [0.8, 1, 1]);
  const phoneY = useTransform(
    scrollYProgress,
    [0.15, 0.3, 0.5, 0.7],
    ["50vh", "0vh", "0vh", "-50vh"]
  );
  const text2Opacity = useTransform(scrollYProgress, [0.3, 0.4, 0.5], [0, 1, 0]);

  // Scene 3: The AI Brain – complex UI element fades in as phone leaves
  const brainOpacity = useTransform(scrollYProgress, [0.6, 0.7, 0.9], [0, 1, 1]);
  const brainScale = useTransform(scrollYProgress, [0.6, 0.8], [0.8, 1.2]);
  const text3Opacity = useTransform(scrollYProgress, [0.7, 0.8, 0.9], [0, 1, 1]);

  return (
    <div
      ref={containerRef}
      className="h-[400vh] w-full bg-zinc-950"
    >
      {/* Sticky Stage */}
      <div className="sticky top-0 h-screen w-full flex items-center justify-center overflow-hidden">
        {/* Scene 1: The Hook */}
        <motion.h1
          style={{
            opacity: text1Opacity,
            y: text1Y,
          }}
          className="absolute inset-0 z-10 flex items-center justify-center px-6 text-center text-5xl font-bold text-white md:text-7xl"
        >
          Clinical AI, in your pocket.
        </motion.h1>

        {/* Scene 2: The App Reveal – Phone mockup */}
        <motion.div
          style={{
            scale: phoneScale,
            y: phoneY,
          }}
          className="absolute z-20 flex items-center justify-center"
        >
          <div className="relative flex flex-col items-center">
            <div
              className="relative w-72 rounded-[3rem] border-[8px] border-zinc-800 bg-zinc-900 shadow-[0_0_50px_rgba(20,184,166,0.2)]"
              style={{ height: 600 }}
            >
              {/* Phone notch */}
              <div className="absolute left-1/2 top-0 h-6 w-32 -translate-x-1/2 rounded-b-2xl bg-zinc-900" />
              {/* App preview placeholder */}
              <div className="flex h-full items-center justify-center p-6 pt-12">
                <div className="text-center">
                  <div className="mx-auto mb-4 h-16 w-16 rounded-2xl bg-teal-500/20" />
                  <p className="text-sm text-zinc-500">SkinnFit App</p>
                </div>
              </div>
            </div>
            <motion.h2
              style={{ opacity: text2Opacity }}
              className="absolute -bottom-20 left-1/2 z-30 -translate-x-1/2 whitespace-nowrap text-center text-2xl font-bold text-white md:text-3xl"
            >
              Real-time 8-Engine Analysis.
            </motion.h2>
          </div>
        </motion.div>

        {/* Scene 3: The AI Brain – Metrics UI */}
        <motion.div
          style={{
            opacity: brainOpacity,
            scale: brainScale,
          }}
          className="absolute inset-0 z-30 flex items-center justify-center"
        >
          <div className="relative flex flex-col items-center gap-8">
            {/* Abstract AI metrics visualization */}
            <div className="flex items-center gap-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="h-24 w-20 rounded-xl border border-teal-500/30 bg-zinc-900/80 backdrop-blur-sm"
                  style={{
                    background: `linear-gradient(135deg, rgba(20,184,166,0.1) 0%, rgba(20,184,166,0.02) 100%)`,
                  }}
                />
              ))}
            </div>
            <div className="flex items-center gap-6">
              <div className="h-32 w-32 rounded-2xl border-2 border-teal-400/40 bg-zinc-900/90 backdrop-blur-md" />
              <div className="flex flex-col gap-2">
                <div className="h-4 w-48 rounded bg-teal-500/30" />
                <div className="h-4 w-36 rounded bg-teal-500/20" />
                <div className="h-4 w-40 rounded bg-teal-500/20" />
              </div>
            </div>
            <motion.h2
              style={{ opacity: text3Opacity }}
              className="text-center text-3xl font-bold text-white md:text-4xl"
            >
              Precision Data for Clinics.
            </motion.h2>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
