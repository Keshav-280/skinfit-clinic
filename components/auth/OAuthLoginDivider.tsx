export function OAuthLoginDivider() {
  return (
    <div className="relative my-6">
      <div className="absolute inset-0 flex items-center" aria-hidden>
        <div className="w-full border-t border-slate-200" />
      </div>
      <div className="relative flex justify-center text-xs uppercase tracking-wide">
        <span className="bg-white px-3 text-slate-400">or</span>
      </div>
    </div>
  );
}
