import { ReactNode } from "react";

export const metadata = {
  title: "Skinfit Mobile Capture",
  description: "Capture photos with your mobile device",
};

export default function MobileCaptureLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#111827] text-white">
      {children}
    </div>
  );
}
