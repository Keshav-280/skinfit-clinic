export default function ScanReportLoading() {
  return (
    <div className="flex min-h-[62vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-3xl bg-gradient-to-b from-white to-[#F8F4EC] p-7 shadow-[0_16px_36px_-22px_rgba(15,23,42,0.35)] ring-1 ring-zinc-900/[0.04]">
        <div className="mx-auto mb-5 h-11 w-11 animate-pulse rounded-2xl bg-teal-100 shadow-[inset_0_0_0_1px_rgba(15,118,110,0.15)]" />

        <p className="text-center text-[28px] leading-none text-zinc-400">...</p>

        <p className="mt-3 text-center text-xl font-semibold tracking-tight text-zinc-800">
          Loading report
        </p>
        <p className="mt-2 text-center text-sm text-zinc-600">
          Preparing your scan details and images.
        </p>

        <div className="mt-6">
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-200/60">
            <div className="h-full w-2/5 animate-pulse rounded-full bg-teal-500/70" />
          </div>
        </div>
      </div>
    </div>
  );
}
