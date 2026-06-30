import Script from "next/script";
import { redirect } from "next/navigation";
import { getDoctorPortalUserId } from "@/src/lib/auth/doctor-access";

export default async function AnnotatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const staffId = await getDoctorPortalUserId();
  if (!staffId) {
    redirect("/doctor/login");
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
