type OAuthLoginDividerProps = {
  variant?: "light" | "dark";
};

export function OAuthLoginDivider({ variant = "light" }: OAuthLoginDividerProps) {
  const isDark = variant === "dark";

  return (
    <div className="relative my-6">
      <div className="absolute inset-0 flex items-center" aria-hidden>
        <div
          className={`w-full border-t ${
            isDark ? "border-white/20" : "border-slate-200"
          }`}
        />
      </div>
      <div className="relative flex justify-center text-xs uppercase tracking-wide">
        <span
          className={`px-3 ${
            isDark
              ? "bg-[#2C3E6B] text-white/50"
              : "bg-white text-slate-400"
          }`}
        >
          or
        </span>
      </div>
    </div>
  );
}
