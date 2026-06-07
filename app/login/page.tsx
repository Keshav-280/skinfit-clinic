import { Suspense } from "react";
import { LoginForm } from "./login-form";

function LoginFallback() {
  return (
    <div className="flex min-h-screen">
      <div className="hidden flex-1 bg-gradient-to-br from-[#1a2544] via-[#2C3E6B] to-[#162038] lg:block" />
      <div className="flex flex-1 items-center justify-center bg-white">
        <p className="text-[#8391A1]">Loading…</p>
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
