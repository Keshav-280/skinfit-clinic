/**
 * Full-page Diagnose atmosphere from the product mock:
 * cream top → soft lavender wash, organic white waves, concentric rings, leaves.
 * Shared by /preview/diagnose and /dashboard/scan.
 */
export function DiagnosePageAtmosphere({
  className = "absolute inset-0",
}: {
  className?: string;
}) {
  return (
    <div className={`pointer-events-none overflow-hidden ${className}`} aria-hidden>
      {/* Base cream */}
      <div className="absolute inset-0 bg-[#FBF8F4]" />

      {/* Soft lavender field — dominant mid/lower wash (mock’s purple feel) */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(140% 90% at 50% 18%, #FFFEFB 0%, #F7F2EA 22%, #EDE6F7 48%, #E0D7F2 72%, #D4CBEB 100%)",
        }}
      />

      {/* Soft blue-lilac glow behind CTA zone */}
      <div
        className="absolute inset-x-[-10%] top-[32%] h-[55%]"
        style={{
          background:
            "radial-gradient(ellipse 90% 70% at 50% 40%, rgba(186,176,230,0.55) 0%, rgba(220,214,242,0.25) 45%, transparent 75%)",
        }}
      />

      {/* Organic white wave — upper transition (mock wavy divider) */}
      <svg
        className="absolute left-0 top-[26%] h-[22%] w-[140%] -translate-x-[8%]"
        viewBox="0 0 600 120"
        preserveAspectRatio="none"
      >
        <path
          d="M0,70 C80,20 160,100 260,55 C360,10 440,95 600,40 L600,120 L0,120 Z"
          fill="rgba(255,255,255,0.72)"
        />
      </svg>
      <svg
        className="absolute left-0 top-[34%] h-[28%] w-[130%] -translate-x-[5%]"
        viewBox="0 0 600 140"
        preserveAspectRatio="none"
      >
        <path
          d="M0,50 C120,110 220,10 340,70 C460,130 520,30 600,80 L600,140 L0,140 Z"
          fill="rgba(255,252,255,0.55)"
        />
      </svg>

      {/* Second lavender band under waves */}
      <div
        className="absolute inset-x-0 top-[42%] bottom-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(224,215,242,0.35) 0%, rgba(232,226,245,0.7) 35%, rgba(243,238,248,0.95) 100%)",
        }}
      />

      {/* Topographic concentric circles (bottom-right, mock detail) */}
      <svg
        className="absolute -bottom-8 -right-16 h-[320px] w-[320px] text-[#2C3E6B]/[0.07]"
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
        className="absolute bottom-16 left-[-40px] h-[180px] w-[180px] text-[#2C3E6B]/[0.05]"
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
