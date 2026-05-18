export default function VisitDetailLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-3xl bg-gradient-to-b from-white to-[#F8F4EC] p-7 shadow-[0_16px_36px_-22px_rgba(15,23,42,0.35)] ring-1 ring-zinc-900/[0.04]">
        <div className="mx-auto mb-5 h-11 w-11 animate-pulse rounded-2xl bg-teal-100" />
        <p className="text-center text-xl font-semibold tracking-tight text-zinc-800">
          Loading visit details
        </p>
        <p className="mt-2 text-center text-sm text-zinc-600">
          Fetching clinic notes and attachments.
        </p>
      </div>
    </div>
  );
}
