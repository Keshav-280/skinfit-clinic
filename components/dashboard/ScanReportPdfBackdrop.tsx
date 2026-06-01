/** Decorative layers on screen only — omitted from PDF capture (`data-pdf-screen-only`). */
export function ScanReportPdfBackdrop() {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      data-pdf-screen-only
      aria-hidden
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(165deg, #ffffff 0%, #f8fbff 16%, #eef4fb 42%, #e4edf8 68%, #d9e6f3 100%)",
        }}
      />
      <div
        className="absolute -right-20 -top-24 h-[22rem] w-[22rem] rounded-full sm:h-[26rem] sm:w-[26rem]"
        style={{
          background:
            "radial-gradient(circle, rgba(44,62,107,0.16) 0%, rgba(44,62,107,0.06) 42%, transparent 72%)",
        }}
      />
      <div
        className="absolute -left-24 top-[42%] h-[20rem] w-[20rem] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(148,186,162,0.38) 0%, rgba(168,198,178,0.14) 45%, transparent 72%)",
        }}
      />
      <div
        className="absolute -bottom-16 right-[8%] h-[16rem] w-[16rem] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(74,111,165,0.18) 0%, rgba(74,111,165,0.06) 40%, transparent 70%)",
        }}
      />
      <div
        className="absolute inset-x-0 top-0 h-1.5"
        style={{
          background:
            "linear-gradient(90deg, rgba(30,50,100,0) 0%, rgba(44,62,107,0.22) 50%, rgba(30,50,100,0) 100%)",
        }}
      />
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(rgba(44,62,107,0.09) 0.55px, transparent 0.55px)",
          backgroundSize: "20px 20px",
        }}
      />
    </div>
  );
}
