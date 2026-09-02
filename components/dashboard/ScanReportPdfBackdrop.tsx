/** Decorative layers on screen only - omitted from PDF capture (`data-pdf-screen-only`). */
export function ScanReportPdfBackdrop() {
  return (
    <>
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
              "radial-gradient(circle, rgba(30, 27, 49,0.16) 0%, rgba(30, 27, 49,0.06) 42%, transparent 72%)",
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
              "linear-gradient(90deg, rgba(30,50,100,0) 0%, rgba(30, 27, 49,0.22) 50%, rgba(30,50,100,0) 100%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(rgba(30, 27, 49,0.09) 0.55px, transparent 0.55px)",
            backgroundSize: "20px 20px",
          }}
        />
      </div>

      {/* This layer is rendered only for web PDF capture. */}
      <div
        className="pointer-events-none absolute inset-0 hidden overflow-hidden"
        data-pdf-print-only
        aria-hidden
      >
        <div
          className="absolute inset-0"
          style={{
            background: "#F4F7FB",
          }}
        />
        {/* Subtle dot grid pattern for a high-tech/clinical look */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: "radial-gradient(#1E1B31 1.2px, transparent 0)",
            backgroundSize: "24px 24px",
          }}
        />
        {/* Soft clinical ambient glow */}
        <div
          className="absolute -right-24 -top-24 h-[26rem] w-[26rem] rounded-full opacity-[0.12]"
          style={{
            background: "radial-gradient(circle, #1E1B31 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute -left-24 top-[40%] h-[24rem] w-[24rem] rounded-full opacity-[0.08]"
          style={{
            background: "radial-gradient(circle, #4A6FA5 0%, transparent 72%)",
          }}
        />
        <div
          className="absolute -bottom-16 right-[10%] h-[20rem] w-[20rem] rounded-full opacity-[0.1]"
          style={{
            background: "radial-gradient(circle, #1E1B31 0%, transparent 70%)",
          }}
        />
      </div>
    </>
  );
}
