import sharp from "sharp";
import type { StaffAreaKey, StaffShape } from "@/src/lib/staffReview/model";

/** Same colours as the marking tool, so staff see what the patient will see. */
export const AREA_COLOURS: Record<StaffAreaKey, string> = {
  active_acne: "#ff5c61",
  acne_scar: "#ffb02e",
  pigmentation: "#b07cff",
  under_eye: "#5b8cff",
  wrinkles: "#25d0b4",
  sagging_volume: "#4ad57f",
};

const MAX_SIDE = 1400;

export function shapesToSvg(shapes: StaffShape[], width: number, height: number): string {
  const stroke = Math.max(2, Math.round(width / 300));
  const x = (v: number) => (v * width).toFixed(1);
  const y = (v: number) => (v * height).toFixed(1);
  const parts = shapes.map((s) => {
    const colour = AREA_COLOURS[s.area];
    const common = `stroke="${colour}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"`;
    if (s.type === "circle") {
      return `<circle cx="${x(s.cx)}" cy="${y(s.cy)}" r="${x(s.r)}" fill="${colour}" fill-opacity="0.12" ${common}/>`;
    }
    if (s.type === "line") {
      return `<line x1="${x(s.x1)}" y1="${y(s.y1)}" x2="${x(s.x2)}" y2="${y(s.y2)}" ${common}/>`;
    }
    return `<polyline points="${s.points.map((p) => `${x(p.x)},${y(p.y)}`).join(" ")}" fill="none" ${common}/>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${parts.join("")}</svg>`;
}

/** The photo with the staff markings painted on it, as a JPEG. */
export async function drawShapesOnPhoto(photo: Buffer, shapes: StaffShape[]): Promise<Buffer> {
  const base = await sharp(photo)
    .rotate()
    .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true })
    .toBuffer({ resolveWithObject: true });
  return sharp(base.data)
    .composite([{ input: Buffer.from(shapesToSvg(shapes, base.info.width, base.info.height)) }])
    .jpeg({ quality: 88 })
    .toBuffer();
}
