/**
 * Full-page Diagnose atmosphere: canvas, linen, a hint of blush.
 * Shared by /preview/diagnose and /dashboard/scan.
 */
export function DiagnosePageAtmosphere({
  className = "absolute inset-0",
}: {
  className?: string;
}) {
  return (
    <div className={`pointer-events-none overflow-hidden ${className}`} aria-hidden>
      <div className="absolute inset-0 bg-[#FAF8F5]" />

      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(130% 85% at 50% 8%, #FFFEFB 0%, #FAF8F5 38%, #F0EAE2 100%)",
        }}
      />

      <div
        className="absolute right-[-15%] top-[12%] h-[42%] w-[70%]"
        style={{
          background:
            "radial-gradient(ellipse 80% 70% at 50% 50%, rgba(223,157,164,0.14) 0%, transparent 72%)",
        }}
      />

      <div
        className="absolute left-[-20%] top-[8%] h-[36%] w-[55%]"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 50% 50%, rgba(36,42,95,0.06) 0%, transparent 70%)",
        }}
      />

      <svg
        className="absolute left-0 top-[28%] h-[22%] w-[140%] -translate-x-[8%]"
        viewBox="0 0 600 120"
        preserveAspectRatio="none"
      >
        <path
          d="M0,70 C80,20 160,100 260,55 C360,10 440,95 600,40 L600,120 L0,120 Z"
          fill="rgba(250,248,245,0.78)"
        />
      </svg>
      <svg
        className="absolute left-0 top-[36%] h-[28%] w-[130%] -translate-x-[5%]"
        viewBox="0 0 600 140"
        preserveAspectRatio="none"
      >
        <path
          d="M0,50 C120,110 220,10 340,70 C460,130 520,30 600,80 L600,140 L0,140 Z"
          fill="rgba(240,234,226,0.55)"
        />
      </svg>

      <div
        className="absolute inset-x-0 top-[48%] bottom-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(240,234,226,0.35) 0%, rgba(250,248,245,0.92) 55%, #FAF8F5 100%)",
        }}
      />

      <svg
        className="absolute -bottom-8 -right-16 h-[320px] w-[320px] text-[#1E1B31]/[0.08]"
        viewBox="0 0 320 320"
        fill="none"
      >
        {[40, 70, 100, 130, 160].map((r) => (
          <circle
            key={r}
            cx="200"
            cy="200"
            r={r}
            stroke="currentColor"
            strokeWidth="1"
          />
        ))}
      </svg>
      <svg
        className="absolute bottom-16 left-[-40px] h-[180px] w-[180px] text-[#242A5F]/[0.07]"
        viewBox="0 0 180 180"
        fill="none"
      >
        {[30, 55, 80].map((r) => (
          <circle
            key={r}
            cx="70"
            cy="110"
            r={r}
            stroke="currentColor"
            strokeWidth="1"
          />
        ))}
      </svg>
    </div>
  );
}
