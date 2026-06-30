import Script from "next/script";
import { getDoctorPortalUserId } from "@/src/lib/auth/doctor-access";

export default async function AnnotatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const staffId = await getDoctorPortalUserId();
  if (!staffId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-100 text-neutral-700">
        <p className="text-lg font-medium">Not allowed</p>
      </div>
    );
  }

  return (
    <>
      <Script id="annotator-version-guard" strategy="afterInteractive">{`
        (function () {
          var localVersion = 2;
          function check() {
            fetch("/api/annotator/client-version", { cache: "no-store" })
              .then(function (r) { return r.json(); })
              .then(function (j) {
                if (j.minVersion > localVersion) window.location.reload();
              })
              .catch(function () {});
          }
          setInterval(check, 45000);
          setTimeout(check, 8000);
        })();
      `}</Script>
      {children}
    </>
  );
}
