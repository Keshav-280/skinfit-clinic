import { Suspense } from "react";
import { LoginForm } from "./login-form";

function LoginFallback() {
  return (
    <div className="flex min-h-screen">
      <div className="hidden flex-1 bg-gradient-to-br from-[#242A5F] via-[#1E1B31] to-[#1E1B31] lg:block" />
      <div className="flex flex-1 items-center justify-center bg-[#FAF8F5]">
        <p className="text-[#5B66A1]">Loading…</p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  );
}
