// TEMPORARY — no-auth preview of the redesigned Diagnose page hero (light
// ring gauge + wavy solid-to-gradient camera CTA background with breathing
// icon + drifting leaves), for local design review only. Mock data, no DB
// needed. Safe to delete once confirmed; not linked from anywhere in the app.
import { ArrowRight, Camera, History, Leaf, Sparkles, Sun } from "lucide-react";
import { NavyMetricsCard } from "@/components/dashboard/NavyMetricsCard";

export default function DiagnosePreviewPage() {
  return (
    <div className="min-h-dvh bg-[#F5F3EF] px-3 py-4">
      <div className="mx-auto flex max-w-md flex-col gap-3">
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Preview only — mock data, no login.
        </p>

        <NavyMetricsCard
          light
          kaiSkinScore={72}
          weeklyDeltaScore={60}
          weeklyDeltaMeaningful
          latestScanAt={new Date().toISOString()}
          consistencyScore={72}
          scoresUnlocked={false}
          scanCount={1}
        />

        <div className="relative -mx-3 overflow-hidden">
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            <svg
              viewBox="0 0 500 40"
              preserveAspectRatio="none"
              className="block h-8 w-full text-[#ECE9F8]"
            >
              <path
                d="M0,22 C125,44 375,-4 500,18 L500,40 L0,40 Z"
                fill="currentColor"
              />
            </svg>
            <div className="absolute inset-x-0 bottom-0 top-7 bg-gradient-to-b from-[#ECE9F8] via-[#E3DEF5] to-[#F5F3EF]" />
            <Leaf
              className="leaf-drift absolute bottom-6 left-2 h-10 w-10 text-[#8FAE86]/35"
              style={{ ["--leaf-rot" as string]: "-18deg" }}
              strokeWidth={1.25}
            />
            <Leaf
              className="leaf-drift absolute right-3 top-1/3 h-6 w-6 text-[#8FAE86]/25"
              style={{ ["--leaf-rot" as string]: "12deg", animationDelay: "1.4s" }}
              strokeWidth={1.25}
            />
          </div>

          <div className="relative z-10 flex flex-col gap-3 px-3 pb-3 pt-6">
            <span className="inline-flex w-fit items-center rounded-full bg-white/70 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#2C3E6B]">
              Recommended
            </span>
            <div className="flex items-center gap-4">
              <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-dashed border-[#2C3E6B]/25">
                <div className="camera-icon-breathe flex h-12 w-12 items-center justify-center rounded-full bg-white">
                  <Camera className="h-5 w-5 text-[#2C3E6B]" />
                </div>
                <Sparkles
                  className="absolute -right-1 -top-1 h-3.5 w-3.5 text-[#2C3E6B]/40"
                  strokeWidth={2}
                  aria-hidden
                />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-extrabold tracking-tight leading-tight text-[#18181b]">
                  Use device camera
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-[#6B7280]">
                  Capture using your device camera. Keep angles aligned with
                  the guide.
                </p>
              </div>
            </div>
            <button
              type="button"
              className="cta-pop flex w-full items-center justify-center gap-2 rounded-full bg-[#2C3E6B] px-5 py-3 text-sm font-extrabold text-white shadow-[0_10px_24px_-10px_rgba(44,62,107,0.6)] transition-colors hover:bg-[#354A7A]"
            >
              Start Camera
              <Camera className="h-4 w-4" />
            </button>

            <div className="flex shrink-0 items-center gap-2.5">
              <button
                type="button"
                className="inline-flex flex-1 items-center gap-2.5 rounded-2xl bg-white px-3 py-3 shadow-[0_6px_18px_-14px_rgba(44,62,107,0.5)] transition hover:bg-[#F8F7FC]"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#ECE9F8]">
                  <Sun className="h-4 w-4 text-[#2C3E6B]" aria-hidden />
                </span>
                <span className="flex-1 text-left text-xs font-bold text-[#18181b]">
                  View photo tips
                </span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[#9CA3AF]" aria-hidden />
              </button>
              <button
                type="button"
                className="inline-flex flex-1 items-center gap-2.5 rounded-2xl bg-white px-3 py-3 shadow-[0_6px_18px_-14px_rgba(44,62,107,0.5)] transition hover:bg-[#F8F7FC]"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#ECE9F8]">
                  <History className="h-4 w-4 text-[#2C3E6B]" aria-hidden />
                </span>
                <span className="flex-1 text-left text-xs font-bold text-[#18181b]">
                  Scan history
                </span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[#9CA3AF]" aria-hidden />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
