/** Decorative layers on screen only — omitted from PDF capture (`data-pdf-screen-only`). */
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

      {/* This layer is rendered only for web PDF capture. */}
      <div
        className="pointer-events-none absolute inset-0 hidden overflow-hidden"
        data-pdf-print-only
        aria-hidden
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(130% 100% at 50% 0%, #101d3b 0%, #070d1f 48%, #030711 100%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(760px 360px at -8% -5%, rgba(86,131,230,0.3), transparent 56%), radial-gradient(700px 340px at 108% 16%, rgba(39,193,173,0.22), transparent 58%), radial-gradient(780px 360px at 50% 108%, rgba(54,116,214,0.2), transparent 60%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "linear-gradient(115deg, rgba(170,194,255,0.22) 1px, transparent 1px)",
            backgroundSize: "26px 26px",
          }}
        />
        <div
          className="absolute left-[18%] top-[26%] h-[20rem] w-[20rem] opacity-10"
          style={{
            background: "center / contain no-repeat url('/branding/skinfit-wellness-logo.svg')",
            filter: "grayscale(1) brightness(2.4)",
          }}
        />
      </div>
    </>
  );
}
