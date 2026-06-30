import type { CaptureCropContext } from "@/src/lib/cropScanImageForMl";
import type { WebFormData } from "@/src/lib/webRequestFormData";

export function parseCaptureCropContext(
  formData: WebFormData
): CaptureCropContext | undefined {
  const sourceRaw = formData.get("captureSource");
  const source =
    sourceRaw === "web" || sourceRaw === "mobile-web-handoff"
      ? "web"
      : sourceRaw === "mobile"
        ? "mobile"
        : undefined;

  const vfRaw = formData.get("captureViewfinder");
  if (typeof vfRaw === "string" && vfRaw.trim()) {
    try {
      const parsed = JSON.parse(vfRaw) as { width?: number; height?: number };
      const viewfinderW = Number(parsed.width);
      const viewfinderH = Number(parsed.height);
      if (
        Number.isFinite(viewfinderW) &&
        Number.isFinite(viewfinderH) &&
        viewfinderW > 0 &&
        viewfinderH > 0
      ) {
        return {
          source: source ?? "mobile",
          viewfinderW,
          viewfinderH,
        };
      }
    } catch {
      /* ignore */
    }
  }

  if (source === "web") return { source: "web" };
  return undefined;
}

export function appendCaptureCropContext(
  form: FormData,
  ctx: CaptureCropContext
): void {
  form.append("captureSource", ctx.source);
  if (ctx.viewfinderW && ctx.viewfinderH) {
    form.append(
      "captureViewfinder",
      JSON.stringify({ width: ctx.viewfinderW, height: ctx.viewfinderH })
    );
  }
}
