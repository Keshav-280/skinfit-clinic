function Bone({
  className = "",
  delay = 0,
  onInk = false,
}: {
  className?: string;
  delay?: number;
  onInk?: boolean;
}) {
  return (
    <span
      className={`skel ${onInk ? "skel-on-ink" : ""} ${className}`}
      style={{ animationDelay: `${delay}ms` }}
      aria-hidden
    />
  );
}

function SkeletonFrame({
  children,
  label,
  className = "",
}: {
  children: React.ReactNode;
  label: string;
  className?: string;
}) {
  return (
    <div className={className} role="status" aria-live="polite" aria-busy="true">
      {children}
      <span className="sr-only">{label}</span>
    </div>
  );
}

/** Compact inline placeholder (rings, nested cards). */
export function InlineSkeleton({
  className = "",
  label = "Loading",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <SkeletonFrame label={label} className={`flex items-center justify-center py-4 ${className}`}>
      <div className="flex w-full max-w-[220px] flex-col items-center gap-2">
        <Bone className="h-16 w-16 rounded-full" />
        <Bone className="h-2.5 w-28 rounded-full" delay={80} />
      </div>
    </SkeletonFrame>
  );
}

/** Card-shaped placeholder for nested sections. */
export function SectionSkeleton({
  className = "",
  label = "Loading",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <SkeletonFrame label={label} className={`w-full ${className}`}>
      <div className="space-y-3 rounded-2xl border border-[#E4E6F0] bg-white p-4">
        <Bone className="h-3 w-24 rounded-full" />
        <Bone className="h-10 w-full rounded-xl" delay={70} />
        <Bone className="h-10 w-full rounded-xl" delay={140} />
        <Bone className="h-10 w-[70%] rounded-xl" delay={210} />
      </div>
    </SkeletonFrame>
  );
}

export function HomePageSkeleton({ className = "" }: { className?: string }) {
  return (
    <SkeletonFrame label="Loading home" className={`space-y-5 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <Bone className="h-8 w-40 rounded-lg" />
          <Bone className="h-3.5 w-52 rounded-full" delay={90} />
        </div>
        <Bone className="h-10 w-28 rounded-xl" delay={60} />
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#E4E6F0] bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-4 sm:px-5">
          <div className="min-w-0 flex-1 space-y-2">
            <Bone className="h-2.5 w-24 rounded-full" />
            <Bone className="h-4 w-[85%] rounded-full" delay={80} />
          </div>
          <Bone className="h-9 w-[6.5rem] rounded-full" delay={40} />
        </div>
        <div className="mx-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-[#E4E6F0] sm:mx-5 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-[#FAF8F5] px-3 py-2.5">
              <Bone className="h-2 w-12 rounded-full" delay={i * 50} />
              <Bone className="mt-1.5 h-3.5 w-16 rounded-full" delay={i * 50 + 40} />
            </div>
          ))}
        </div>
        <div className="mx-4 my-3 flex items-center justify-between rounded-2xl border border-[#E4E6F0] bg-[#FAF8F5] px-3 py-4 sm:mx-5">
          <div className="space-y-1.5">
            <Bone className="h-2 w-16 rounded-full" delay={80} />
            <Bone className="h-3.5 w-20 rounded-full" delay={120} />
          </div>
          <Bone className="h-[84px] w-[84px] rounded-full" delay={40} />
          <div className="space-y-1.5">
            <Bone className="ml-auto h-2 w-16 rounded-full" delay={160} />
            <Bone className="ml-auto h-3.5 w-20 rounded-full" delay={200} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 px-4 pb-4 lg:grid-cols-6 sm:px-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Bone key={i} className="h-[4.5rem] rounded-xl" delay={i * 70} />
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-[#E4E6F0] bg-white p-4 shadow-sm">
        <Bone className="h-3 w-36 rounded-full" />
        <div className="mt-4 grid grid-cols-7 gap-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <Bone key={i} className="h-16 rounded-xl" delay={i * 45} />
          ))}
        </div>
        <Bone className="mt-4 h-24 w-full rounded-xl" delay={180} />
      </div>
    </SkeletonFrame>
  );
}

export function MaintainPageSkeleton({ className = "" }: { className?: string }) {
  return (
    <SkeletonFrame label="Loading Maintain" className={`relative ${className}`}>
      <div className="-mx-4 -mt-6 overflow-hidden bg-gradient-to-b from-[#1E1B31] to-[#242A5F] px-4 pb-10 pt-5 md:-mx-8 md:px-8 md:pb-12 md:pt-6">
        <div className="relative mx-auto w-full max-w-5xl space-y-3">
          <Bone onInk className="h-8 w-[80%] max-w-md rounded-lg sm:h-10" />
          <Bone onInk className="h-3.5 w-44 rounded-full" delay={90} />
          <Bone onInk className="h-3.5 w-32 rounded-full" delay={160} />
        </div>
      </div>
      <div className="relative mx-auto mt-5 max-w-md px-4 md:mt-6 md:max-w-2xl md:px-8">
        <div className="rounded-2xl border border-[#E4E6F0] bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-2">
              <Bone className="h-2.5 w-28 rounded-full" />
              <Bone className="h-4 w-36 rounded-full" delay={70} />
            </div>
            <Bone className="h-9 w-24 rounded-full" delay={40} />
          </div>
          <div className="mt-4 space-y-2.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl bg-[#FAF8F5] px-3 py-3">
                <Bone className="h-8 w-8 rounded-lg" delay={i * 60} />
                <Bone className="h-3 flex-1 rounded-full" delay={i * 60 + 40} />
                <Bone className="h-3 w-10 rounded-full" delay={i * 60 + 80} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </SkeletonFrame>
  );
}

export function ReportPageSkeleton({
  className = "",
  contained = false,
}: {
  className?: string;
  contained?: boolean;
}) {
  return (
    <SkeletonFrame
      label="Loading report"
      className={
        contained
          ? `overflow-hidden rounded-[22px] bg-[#1E1B31] ${className}`
          : `relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2 -mt-6 min-h-[calc(100dvh-4rem)] bg-[#1E1B31] ${className}`
      }
    >
      <div className="relative mx-auto max-w-lg px-4 pb-8 pt-4 sm:max-w-xl">
        <Bone onInk className="h-8 w-20 rounded-full" />
        <div className="relative mt-6">
          <Bone onInk className="aspect-[3/4] w-full rounded-[28px]" delay={50} />
          <div className="pointer-events-none absolute inset-x-0 bottom-8 flex flex-col items-center gap-2">
            <Bone onInk className="h-20 w-20 rounded-full" delay={90} />
            <Bone onInk className="h-4 w-40 rounded-full" delay={140} />
          </div>
        </div>
      </div>
      <div className="relative -mt-16 space-y-3 rounded-t-[28px] bg-[#FAF8F5] px-4 pb-10 pt-6">
        <Bone className="h-16 w-full rounded-2xl" delay={80} />
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Bone key={i} className="h-20 rounded-xl" delay={100 + i * 50} />
          ))}
        </div>
        <Bone className="h-28 w-full rounded-2xl" delay={200} />
        <Bone className="h-24 w-full rounded-2xl" delay={260} />
      </div>
    </SkeletonFrame>
  );
}

export function HistoryPageSkeleton({ className = "" }: { className?: string }) {
  return (
    <SkeletonFrame label="Loading history" className={`space-y-6 ${className}`}>
      <div className="rounded-2xl border border-[#E4E6F0] bg-white p-5 shadow-sm">
        <Bone className="h-2.5 w-24 rounded-full" />
        <Bone className="mt-2 h-6 w-40 rounded-lg" delay={60} />
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-2xl border border-[#E4E6F0]">
              <Bone className="h-36 w-full" delay={i * 80} />
              <div className="space-y-2 p-3">
                <Bone className="h-3.5 w-3/4 rounded-full" delay={i * 80 + 40} />
                <Bone className="h-3 w-1/2 rounded-full" delay={i * 80 + 80} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </SkeletonFrame>
  );
}

export function ProfilePageSkeleton({ className = "" }: { className?: string }) {
  return (
    <SkeletonFrame label="Loading profile" className={`space-y-5 ${className}`}>
      <div className="flex items-center gap-4">
        <Bone className="h-16 w-16 rounded-full" />
        <div className="flex-1 space-y-2">
          <Bone className="h-5 w-40 rounded-lg" delay={60} />
          <Bone className="h-3 w-28 rounded-full" delay={110} />
        </div>
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="space-y-3 rounded-2xl border border-[#E4E6F0] bg-white p-4">
          <Bone className="h-3 w-24 rounded-full" delay={i * 70} />
          <Bone className="h-11 w-full rounded-xl" delay={i * 70 + 50} />
          <Bone className="h-11 w-full rounded-xl" delay={i * 70 + 100} />
        </div>
      ))}
    </SkeletonFrame>
  );
}

export function ScorePageSkeleton({ className = "" }: { className?: string }) {
  return (
    <SkeletonFrame label="Loading score" className={`space-y-5 ${className}`}>
      <div className="flex items-center gap-3">
        <Bone className="h-10 w-10 rounded-xl" />
        <Bone className="h-6 w-36 rounded-lg" delay={60} />
      </div>
      <div className="flex flex-col items-center rounded-2xl border border-[#E4E6F0] bg-white py-8">
        <Bone className="h-36 w-36 rounded-full" delay={40} />
        <Bone className="mt-4 h-4 w-24 rounded-full" delay={120} />
      </div>
      <Bone className="h-40 w-full rounded-2xl" delay={160} />
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Bone key={i} className="h-14 w-full rounded-xl" delay={200 + i * 70} />
        ))}
      </div>
    </SkeletonFrame>
  );
}

export function SkinParamsPageSkeleton({ className = "" }: { className?: string }) {
  return (
    <SkeletonFrame label="Loading skin parameters" className={`space-y-5 ${className}`}>
      <div className="flex items-center gap-3">
        <Bone className="h-10 w-10 rounded-xl" />
        <Bone className="h-6 w-44 rounded-lg" delay={60} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Bone key={i} className="h-32 rounded-2xl" delay={i * 55} />
        ))}
      </div>
    </SkeletonFrame>
  );
}

export function ListPageSkeleton({
  className = "",
  label = "Loading",
  rows = 5,
}: {
  className?: string;
  label?: string;
  rows?: number;
}) {
  return (
    <SkeletonFrame label={label} className={`space-y-3 ${className}`}>
      <Bone className="h-7 w-40 rounded-lg" />
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-2xl border border-[#E4E6F0] bg-white p-4"
        >
          <Bone className="h-11 w-11 shrink-0 rounded-xl" delay={i * 60} />
          <div className="min-w-0 flex-1 space-y-2">
            <Bone className="h-3.5 w-[70%] rounded-full" delay={i * 60 + 30} />
            <Bone className="h-3 w-[45%] rounded-full" delay={i * 60 + 70} />
          </div>
        </div>
      ))}
    </SkeletonFrame>
  );
}

export function TrackerPageSkeleton({ className = "" }: { className?: string }) {
  return (
    <SkeletonFrame label="Loading tracker" className={`space-y-5 ${className}`}>
      <div className="flex items-center gap-3">
        <Bone className="h-10 w-10 rounded-xl" />
        <Bone className="h-6 w-40 rounded-lg" delay={60} />
      </div>
      <div className="flex flex-col items-center py-6">
        <Bone className="h-44 w-44 rounded-full" delay={40} />
        <Bone className="mt-4 h-4 w-28 rounded-full" delay={120} />
      </div>
      <Bone className="h-12 w-full rounded-xl" delay={180} />
    </SkeletonFrame>
  );
}

export function RoutinePageSkeleton({ className = "" }: { className?: string }) {
  return (
    <SkeletonFrame
      label="Loading routine"
      className={`mx-auto max-w-md space-y-4 ${className}`}
    >
      <div className="flex items-center gap-3 pt-2">
        <Bone className="h-9 w-9 rounded-full" />
        <Bone className="h-5 w-40 rounded-lg" delay={60} />
      </div>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-2xl border border-[#E4E6F0] bg-white p-3">
          <Bone className="h-6 w-6 rounded-md" delay={i * 50} />
          <Bone className="h-3.5 flex-1 rounded-full" delay={i * 50 + 40} />
        </div>
      ))}
    </SkeletonFrame>
  );
}

export function DiagnosePageSkeleton({ className = "" }: { className?: string }) {
  return (
    <SkeletonFrame
      label="Loading Diagnose"
      className={`mx-auto flex w-full max-w-lg flex-col gap-5 px-4 pt-3 sm:max-w-xl ${className}`}
    >
      <div className="flex flex-col items-center py-4">
        <Bone className="h-40 w-40 rounded-full" />
        <Bone className="mt-3 h-3 w-28 rounded-full" delay={90} />
      </div>
      <div className="space-y-3 rounded-2xl border border-[#E4E6F0] bg-white p-5">
        <Bone className="h-5 w-40 rounded-lg" delay={40} />
        <Bone className="h-3 w-full rounded-full" delay={90} />
        <Bone className="mx-auto mt-2 h-12 w-48 rounded-full" delay={140} />
      </div>
    </SkeletonFrame>
  );
}

export function CalendarSkeleton({ className = "" }: { className?: string }) {
  return (
    <SkeletonFrame label="Loading calendar" className={className}>
      <div className="rounded-2xl border border-[#E4E6F0] bg-white p-4">
        <Bone className="h-3 w-32 rounded-full" />
        <div className="mt-4 grid grid-cols-7 gap-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <Bone key={i} className="h-14 rounded-xl" delay={i * 45} />
          ))}
        </div>
      </div>
    </SkeletonFrame>
  );
}

export function PhotoGridSkeleton({ className = "" }: { className?: string }) {
  return (
    <SkeletonFrame label="Loading photos" className={`mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 ${className}`}>
      {Array.from({ length: 6 }).map((_, i) => (
        <Bone key={i} className="aspect-square rounded-xl" delay={i * 70} />
      ))}
    </SkeletonFrame>
  );
}

export function QrSkeleton({ className = "" }: { className?: string }) {
  return (
    <SkeletonFrame label="Generating secure link" className={`flex flex-col items-center gap-3 ${className}`}>
      <Bone className="h-[180px] w-[180px] rounded-2xl" />
      <Bone className="h-3 w-40 rounded-full" delay={90} />
    </SkeletonFrame>
  );
}
