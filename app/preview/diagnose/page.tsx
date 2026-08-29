// No-auth preview of the Diagnose redesign — visibly matches the product mock
// (lavender atmosphere, waves, header chrome, bottom nav). Mock data only.
import {
  ArrowRight,
  Bell,
  Camera,
  Heart,
  History,
  Home,
  Leaf,
  MessageCircle,
  RefreshCw,
  Sparkles,
  Sun,
  User,
} from "lucide-react";
import { NavyMetricsCard } from "@/components/dashboard/NavyMetricsCard";
import { DiagnosePageAtmosphere } from "@/components/dashboard/DiagnosePageAtmosphere";
import { PatientPortalBrandLogo } from "@/components/dashboard/PatientPortalBrandLogo";

export default function DiagnosePreviewPage() {
  return (
    <div className="relative min-h-dvh overflow-hidden">
      <DiagnosePageAtmosphere />

      <div className="relative z-10 mx-auto flex min-h-dvh max-w-md flex-col px-4 pb-28 pt-3">
        <p className="mb-3 rounded-lg border border-amber-300/80 bg-amber-50/90 px-3 py-2 text-xs text-amber-900 backdrop-blur-sm">
          Preview — redesigned Diagnose mock (lavender atmosphere). Port 3005.
        </p>

        {/* Header — company logo + circular actions */}
        <header className="mb-5 flex items-center justify-between gap-3">
          <PatientPortalBrandLogo className="min-w-0 [&_img]:h-9 [&_img]:max-w-[13.5rem] sm:[&_img]:h-10 sm:[&_img]:max-w-[15rem]" />
          <div className="flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-[0_6px_18px_-8px_rgba(30, 27, 49,0.45)]">
              <RefreshCw className="h-4 w-4 text-[#1E1B31]" strokeWidth={2.25} />
            </span>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-[0_6px_18px_-8px_rgba(30, 27, 49,0.45)]">
              <Bell className="h-4 w-4 text-[#1E1B31]" strokeWidth={2.25} />
            </span>
          </div>
        </header>

        {/* Rings sit on the cream/white upper band */}
        <div className="mb-2">
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
        </div>

        {/* Camera CTA — in the lavender wash */}
        <div className="relative mt-6 flex flex-1 flex-col">
          <Leaf
            className="leaf-drift pointer-events-none absolute -left-1 bottom-24 h-14 w-14 text-[#8FAE86]/45"
            style={{ ["--leaf-rot" as string]: "-22deg" }}
            strokeWidth={1.15}
            aria-hidden
          />
          <Leaf
            className="leaf-drift pointer-events-none absolute right-2 top-8 h-8 w-8 text-[#8FAE86]/35"
            style={{
              ["--leaf-rot" as string]: "14deg",
              animationDelay: "1.2s",
            }}
            strokeWidth={1.15}
            aria-hidden
          />

          <span className="relative z-10 mb-4 inline-flex w-fit items-center rounded-full bg-[#F8EDEE]/90 px-3.5 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#1E1B31] shadow-sm">
            Recommended
          </span>

          <div className="relative z-10 flex items-center gap-4">
            <div className="relative flex h-[5.25rem] w-[5.25rem] shrink-0 items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-white/50 shadow-[0_0_0_10px_rgba(255,255,255,0.35),0_0_40px_12px_rgba(180,170,230,0.45)]" />
              <div className="camera-icon-breathe relative flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-[0_10px_28px_-10px_rgba(30, 27, 49,0.5)]">
                <Camera className="h-7 w-7 text-[#1E1B31]" strokeWidth={1.75} />
              </div>
              <Sparkles
                className="absolute -right-1 top-1 h-4 w-4 text-[#1E1B31]/50"
                strokeWidth={2}
                aria-hidden
              />
              <Sparkles
                className="absolute -left-1 bottom-3 h-3 w-3 text-[#1E1B31]/35"
                strokeWidth={2}
                aria-hidden
              />
            </div>
            <div className="min-w-0">
              <h2 className="text-[22px] font-extrabold leading-tight tracking-tight text-[#1E2A4A]">
                Use device camera
              </h2>
              <p className="mt-1.5 text-[13px] leading-relaxed text-[#6B7280]">
                Capture using your device camera. Keep angles aligned with the
                guide.
              </p>
            </div>
          </div>

          <button
            type="button"
            className="cta-pop relative z-10 mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-[#1E1B31] px-5 py-3.5 text-[15px] font-extrabold text-white shadow-[0_12px_28px_-10px_rgba(30, 27, 49,0.65)]"
          >
            Start Camera
            <Camera className="h-4 w-4" />
          </button>

          <div className="relative z-10 mt-4 flex gap-3">
            <button
              type="button"
              className="inline-flex flex-1 items-center gap-2.5 rounded-[18px] bg-white/95 px-3 py-3.5 shadow-[0_8px_24px_-12px_rgba(30, 27, 49,0.4)]"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#ECE9F8]">
                <Sun className="h-4 w-4 text-[#1E1B31]" aria-hidden />
              </span>
              <span className="flex-1 text-left text-[12px] font-bold text-[#1E2A4A]">
                View photo tips
              </span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[#9CA3AF]" />
            </button>
            <button
              type="button"
              className="inline-flex flex-1 items-center gap-2.5 rounded-[18px] bg-white/95 px-3 py-3.5 shadow-[0_8px_24px_-12px_rgba(30, 27, 49,0.4)]"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#ECE9F8]">
                <History className="h-4 w-4 text-[#1E1B31]" aria-hidden />
              </span>
              <span className="flex-1 text-left text-[12px] font-bold text-[#1E2A4A]">
                Scan history
              </span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[#9CA3AF]" />
            </button>
          </div>
        </div>
      </div>

      {/* Mock bottom nav — matches design frame */}
      <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-white/60 bg-white/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-md">
        <div className="mx-auto flex max-w-md items-end justify-between px-2 pt-2 pb-2">
          {(
            [
              { label: "Diagnose", Icon: Camera, active: true },
              { label: "Build", Icon: Home, active: false },
              { label: "Maintain", Icon: Heart, active: false },
              { label: "Chat", Icon: MessageCircle, active: false },
              { label: "Profile", Icon: User, active: false },
            ] as const
          ).map(({ label, Icon, active }) => (
            <div
              key={label}
              className="flex flex-1 flex-col items-center gap-1 py-1"
            >
              <span
                className={`flex h-9 w-11 items-center justify-center rounded-xl ${
                  active ? "bg-[#1E1B31]/12" : ""
                }`}
              >
                <Icon
                  className={`h-5 w-5 ${active ? "text-[#1E1B31]" : "text-[#9CA3AF]"}`}
                  strokeWidth={active ? 2.25 : 2}
                />
              </span>
              <span
                className={`text-[10px] ${
                  active
                    ? "font-semibold text-[#1E1B31]"
                    : "font-medium text-[#9CA3AF]"
                }`}
              >
                {label}
              </span>
              {active ? (
                <span className="h-0.5 w-6 rounded-full bg-[#1E1B31]" />
              ) : (
                <span className="h-0.5 w-6" />
              )}
            </div>
          ))}
        </div>
      </nav>
    </div>
  );
}
