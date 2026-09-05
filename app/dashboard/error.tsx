"use client";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="font-headline text-lg font-semibold text-[#1E1B31]">
        Could not load this page
      </p>
      <p className="max-w-sm text-sm text-[#1E1B31]/60">
        {error.message || "Something went wrong while opening Build."}
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="rounded-xl bg-[#1E1B31] px-5 py-2.5 text-sm font-bold text-white"
      >
        Try again
      </button>
    </div>
  );
}
