type OAuthLoginDividerProps = {
  variant?: "light" | "dark";
  label?: string;
};

export function OAuthLoginDivider({
  variant = "light",
  label = "or",
}: OAuthLoginDividerProps) {
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
      <div className="relative flex justify-center text-xs font-medium uppercase tracking-wide">
        <span
          className={`px-3 ${
            isDark
              ? "bg-[#2C3E6B] text-white/50"
              : "bg-white text-[#8391A1]"
          }`}
        >
          {label}
        </span>
      </div>
    </div>
  );
}
