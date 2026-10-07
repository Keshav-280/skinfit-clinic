/**
 * Designed A4 PDF for the kAI Initial / Update scan reports.
 * Built from the report data with real text (not a screenshot of the web page).
 */
import type { jsPDF } from "jspdf";
import type { KaiGradeTone, KaiReportParamRow } from "@/src/lib/kaiReportMapping";
import type { MovementGroups, MovementRow } from "@/src/lib/report/buildMovementGroups";

export type KaiPdfParam = {
  name: string;
  grade: string;
  score10: number;
  tone: KaiGradeTone;
  finding?: string;
};

export type KaiReportPdfData = {
  kind: "initial" | "update";
  title: string;
  headline: string;
  grade: string;
  metaLeft: string;
  metaRight: string;
  badge: { label: string; type: "improving" | "flat" | "declining" };
  subtitle: string;
  position: { current: number; previous?: number };
  scanImages: Array<{ url: string; label: string }>;
  parameters: KaiPdfParam[];
  actions: Array<{ title: string; detail: string }>;
  actionsHeading: string;
  nextStep: { heading: string; body: string };
  primary: { label: string; href: string };
  secondary: { label: string; href: string };
  // initial
  takeaway?: string;
  // update
  thenNow?: {
    previous: { url: string; date: string };
    current: { url: string; date: string };
    caption?: string;
  };
  movementGroups?: MovementGroups;
  attribution?: Array<{ label: string; text: string }>;
  weekRecap?: Array<{ label: string; value: string }>;
  weekHighlight?: string | null;
};

export function pdfParamsFromRows(rows: KaiReportParamRow[]): KaiPdfParam[] {
  return rows.map((r) => ({
    name: r.name,
    grade: r.grade,
    score10: r.score10,
    tone: r.gradeColor,
    finding: r.finding,
  }));
}

type RGB = readonly [number, number, number];

const C = {
  navy: [30, 27, 49] as RGB,
  navyMid: [43, 47, 99] as RGB,
  indigo: [174, 185, 232] as RGB,
  blush: [223, 157, 164] as RGB,
  cream: [250, 248, 245] as RGB,
  sand: [240, 234, 226] as RGB,
  border: [228, 230, 240] as RGB,
  ink: [30, 27, 49] as RGB,
  muted: [107, 114, 128] as RGB,
  soft: [200, 205, 230] as RGB,
  white: [255, 255, 255] as RGB,
  good: [47, 143, 91] as RGB,
  mid: [196, 134, 28] as RGB,
  low: [192, 68, 79] as RGB,
};

const TONE: Record<KaiGradeTone, RGB> = { good: C.good, mid: C.mid, low: C.low };
const TONE_TINT: Record<KaiGradeTone, RGB> = {
  good: [226, 244, 234],
  mid: [253, 243, 222],
  low: [250, 228, 230],
};

const W = 210;
const H = 297;
const M = 14;
const CW = W - M * 2;
const BOTTOM = H - 22;

/** jsPDF's built-in fonts only cover Latin-1, so map or drop everything else. */
function safe(input: string | null | undefined): string {
  return (input ?? "")
    .replace(/[‘’‚]/g, "'")
    .replace(/[“”„]/g, '"')
    .replace(/[–—−]/g, "-")
    .replace(/→/g, " to ")
    .replace(/[↑↓↗↘]/g, "")
    .replace(/…/g, "...")
    .replace(/[   ]/g, " ")
    .replace(/[^\x09\x0A\x20-\x7E\xA0-\xFF]/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

const lineMm = (size: number, factor = 1.4) => size * 0.3528 * factor;

export type Img = { dataUrl: string; w: number; h: number };

async function loadImage(url: string, maxW = 1000): Promise<Img | null> {
  try {
    let target = url;
    try {
      const u = new URL(url, window.location.origin);
      if (/\/api\/patient\/scans\/\d+\/image$/.test(u.pathname)) {
        u.searchParams.delete("preview");
        u.searchParams.delete("thumb");
      }
      target = u.href;
    } catch {
      /* keep url */
    }
    const res = await fetch(target, { credentials: "include" });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.size) return null;
    const obj = URL.createObjectURL(blob);
    try {
      const el = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = () => reject(new Error("image decode failed"));
        i.src = obj;
      });
      const scale = Math.min(1, maxW / el.naturalWidth);
      const w = Math.max(1, Math.round(el.naturalWidth * scale));
      const h = Math.max(1, Math.round(el.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(el, 0, 0, w, h);
      return { dataUrl: canvas.toDataURL("image/jpeg", 0.85), w, h };
    } finally {
      URL.revokeObjectURL(obj);
    }
  } catch {
    return null;
  }
}

/** White version of the SkinFit logo for the navy header band. */
async function loadWhiteLogo(): Promise<Img | null> {
  try {
    const res = await fetch("/branding/skinfit-wellness-logo.svg");
    if (!res.ok) return null;
    const blob = await res.blob();
    const obj = URL.createObjectURL(blob);
    try {
      const el = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = () => reject(new Error("logo decode failed"));
        i.src = obj;
      });
      const w = 560;
      const h = 135;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(el, 0, 0, w, h);
      const data = ctx.getImageData(0, 0, w, h);
      for (let i = 0; i < data.data.length; i += 4) {
        data.data[i] = 255;
        data.data[i + 1] = 255;
        data.data[i + 2] = 255;
      }
      ctx.putImageData(data, 0, 0);
      return { dataUrl: canvas.toDataURL("image/png"), w, h };
    } finally {
      URL.revokeObjectURL(obj);
    }
  } catch {
    return null;
  }
}

class Doc {
  y = 0;
  constructor(readonly pdf: jsPDF) {}

  fill(c: RGB) {
    this.pdf.setFillColor(c[0], c[1], c[2]);
  }
  stroke(c: RGB) {
    this.pdf.setDrawColor(c[0], c[1], c[2]);
  }
  color(c: RGB) {
    this.pdf.setTextColor(c[0], c[1], c[2]);
  }
  font(style: "normal" | "bold", size: number, family: "helvetica" | "times" = "helvetica") {
    this.pdf.setFont(family, style);
    this.pdf.setFontSize(size);
  }

  wrap(
    text: string,
    width: number,
    size = 9.5,
    style: "normal" | "bold" = "normal",
    family: "helvetica" | "times" = "helvetica"
  ): string[] {
    this.font(style, size, family);
    return this.pdf.splitTextToSize(safe(text), width) as string[];
  }

  newPage() {
    this.pdf.addPage();
    this.fill(C.navy);
    this.pdf.rect(0, 0, W, 2.2, "F");
    this.font("bold", 7.5);
    this.color(C.muted);
    this.pdf.text("SKINFIT WELLNESS  |  kAI SKIN REPORT", M, 10);
    this.stroke(C.border);
    this.pdf.setLineWidth(0.2);
    this.pdf.line(M, 12.5, W - M, 12.5);
    this.y = 20;
  }

  ensure(h: number) {
    if (this.y + h > BOTTOM) this.newPage();
  }

  section(title: string, minBody = 24) {
    this.ensure(13 + minBody);
    this.font("bold", 14, "times");
    this.color(C.ink);
    this.pdf.text(safe(title), M, this.y + 5);
    this.fill(C.blush);
    rr(this.pdf, M, this.y + 7.2, 12, 1.1, 0.5, 0.5, "F");
    this.y += 13;
  }

  paragraph(
    text: string,
    opts: {
      size?: number;
      color?: RGB;
      style?: "normal" | "bold";
      x?: number;
      width?: number;
      gap?: number;
      family?: "helvetica" | "times";
    } = {}
  ) {
    const size = opts.size ?? 9.5;
    const x = opts.x ?? M;
    const width = opts.width ?? CW;
    this.font(opts.style ?? "normal", size, opts.family ?? "helvetica");
    this.color(opts.color ?? C.ink);
    const lh = lineMm(size);
    for (const line of this.wrap(text, width, size, opts.style ?? "normal", opts.family ?? "helvetica")) {
      this.ensure(lh);
      this.pdf.text(line, x, this.y + lh * 0.75);
      this.y += lh;
    }
    this.y += opts.gap ?? 0;
  }
}

function rr(
  pdf: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  rx: number,
  ry: number,
  style: string
) {
  const r = Math.max(0, Math.min(rx, ry, w / 2 - 0.08, h / 2 - 0.08));
  pdf.roundedRect(x, y, w, h, r, r, style);
}

function drawPill(
  d: Doc,
  text: string,
  x: number,
  y: number,
  fill: RGB,
  textColor: RGB,
  size = 8
): number {
  d.font("bold", size);
  const t = safe(text);
  const w = d.pdf.getTextWidth(t) + 6;
  d.fill(fill);
  rr(d.pdf, x, y, w, 6, 3, 3, "F");
  d.color(textColor);
  d.pdf.text(t, x + 3, y + 4.2);
  return w;
}

function badgeColors(type: "improving" | "flat" | "declining"): { fill: RGB; text: RGB } {
  if (type === "improving") return { fill: [226, 244, 234], text: C.good };
  if (type === "declining") return { fill: [250, 228, 230], text: C.low };
  return { fill: [232, 236, 252], text: C.navyMid };
}

function gradeColor(grade: string): RGB {
  const n = Number.parseFloat(grade);
  if (Number.isFinite(n)) return n >= 8 ? C.good : n >= 5 ? C.mid : C.low;
  return C.white;
}

function drawHeader(d: Doc, data: KaiReportPdfData, logo: Img | null) {
  const { pdf } = d;
  const bandH = 66;
  d.fill(C.navy);
  pdf.rect(0, 0, W, bandH, "F");
  d.fill(C.navyMid);
  pdf.circle(W - 8, 6, 34, "F");
  d.fill(C.navy);
  pdf.circle(W + 14, -6, 26, "F");

  if (logo) {
    const lh = 8;
    pdf.addImage(logo.dataUrl, "PNG", M, 9, (lh * logo.w) / logo.h, lh);
  } else {
    d.font("bold", 16, "times");
    d.color(C.white);
    pdf.text("SKINFIT", M, 16);
  }

  d.font("bold", 7.5);
  d.color(C.soft);
  pdf.text("kAI SKIN REPORT", W - M, 14, { align: "right" });

  const titleW = 116;
  d.font("bold", 21, "times");
  d.color(C.white);
  const titleLines = d.wrap(data.title, titleW, 21, "bold", "times").slice(0, 2);
  let ty = 30;
  for (const line of titleLines) {
    pdf.text(line, M, ty);
    ty += lineMm(21, 1.15);
  }

  d.font("normal", 9);
  d.color(C.soft);
  pdf.text(safe(`${data.metaLeft}  |  ${data.metaRight}`), M, ty + 1);

  const bc = badgeColors(data.badge.type);
  drawPill(d, data.badge.label, M, ty + 5, bc.fill, bc.text);

  // Score block
  const bx = W - M - 42;
  d.fill(C.navyMid);
  rr(pdf, bx, 24, 42, 34, 4, 4, "F");
  d.font("bold", 34, "times");
  d.color(C.white);
  pdf.text(safe(data.grade), bx + 21, 44, { align: "center" });
  d.font("normal", 8);
  d.color(C.soft);
  pdf.text("out of 10", bx + 21, 52, { align: "center" });

  d.y = bandH + 8;
}

function drawPositionBar(d: Doc, data: KaiReportPdfData) {
  const { pdf } = d;
  if (data.subtitle) {
    d.paragraph(data.subtitle, { size: 10, color: C.muted, gap: 4 });
  }
  d.ensure(24);
  const barY = d.y + 8;
  d.fill(C.sand);
  rr(pdf, M, barY, CW, 2.6, 1.3, 1.3, "F");
  const px = (v: number) => M + CW * (Math.max(0, Math.min(10, v)) / 10);
  if (typeof data.position.previous === "number") {
    d.stroke(C.navy);
    pdf.setLineWidth(0.5);
    d.fill(C.white);
    pdf.circle(px(data.position.previous), barY + 1.3, 2.2, "FD");
  }
  d.fill(C.navy);
  pdf.circle(px(data.position.current), barY + 1.3, 2.6, "F");
  d.font("normal", 7.5);
  d.color(C.muted);
  pdf.text("0", M, barY + 8);
  pdf.text("5", M + CW / 2, barY + 8, { align: "center" });
  pdf.text("10", M + CW, barY + 8, { align: "right" });
  d.font("bold", 8);
  d.color(C.ink);
  pdf.text("Now", px(data.position.current), barY - 3, { align: "center" });
  if (typeof data.position.previous === "number") {
    d.color(C.muted);
    pdf.text("Last scan", px(data.position.previous), barY - 3, { align: "center" });
  }
  d.y = barY + 13;
}

function drawWatchChips(d: Doc, params: KaiPdfParam[]) {
  const worst = [...params].sort((a, b) => a.score10 - b.score10).slice(0, 2);
  if (!worst.length) return;
  d.ensure(10);
  let x = M;
  d.font("bold", 7.5);
  d.color(C.muted);
  d.pdf.text("KEEP AN EYE ON", x, d.y + 4.2);
  x += d.pdf.getTextWidth("KEEP AN EYE ON") + 4;
  for (const p of worst) {
    const w = drawPill(d, `${p.name}  ${p.grade}/10`, x, d.y, TONE_TINT[p.tone], TONE[p.tone]);
    x += w + 3;
  }
  d.y += 12;
}

function drawImageRow(
  d: Doc,
  items: Array<{ img: Img | null; label: string }>,
  cols: number
) {
  if (!items.length) return;
  const gap = 4;
  const cw = (CW - gap * (cols - 1)) / cols;
  const ch = cw * 1.25;
  for (let start = 0; start < items.length; start += cols) {
    d.ensure(ch + 10);
    const row = items.slice(start, start + cols);
    row.forEach((it, i) => {
      const x = M + i * (cw + gap);
      d.fill(C.sand);
      rr(d.pdf, x, d.y, cw, ch, 2.5, 2.5, "F");
      if (it.img) {
        const ratio = it.img.w / it.img.h;
        let iw = cw;
        let ih = cw / ratio;
        if (ih > ch) {
          ih = ch;
          iw = ch * ratio;
        }
        d.pdf.addImage(it.img.dataUrl, "JPEG", x + (cw - iw) / 2, d.y + (ch - ih) / 2, iw, ih);
      } else {
        d.font("normal", 8);
        d.color(C.muted);
        d.pdf.text("Photo unavailable", x + cw / 2, d.y + ch / 2, { align: "center" });
      }
      d.stroke(C.border);
      d.pdf.setLineWidth(0.25);
      rr(d.pdf, x, d.y, cw, ch, 2.5, 2.5, "S");
      d.font("bold", 8);
      d.color(C.muted);
      d.pdf.text(safe(it.label), x + cw / 2, d.y + ch + 4.5, { align: "center" });
    });
    d.y += ch + 9;
  }
}

function drawMovement(d: Doc, groups: MovementGroups) {
  const counts = [
    { label: "IMPROVED", n: groups.improved.length, tone: "good" as KaiGradeTone },
    { label: "DECLINED", n: groups.declined.length, tone: "low" as KaiGradeTone },
    {
      label: "HOLDING",
      n: groups.holding.length + groups.tracking.length,
      tone: "mid" as KaiGradeTone,
    },
  ];
  d.ensure(24);
  const gap = 4;
  const cw = (CW - gap * 2) / 3;
  counts.forEach((c, i) => {
    const x = M + i * (cw + gap);
    d.fill(TONE_TINT[c.tone]);
    rr(d.pdf, x, d.y, cw, 20, 3, 3, "F");
    d.font("bold", 20, "times");
    d.color(TONE[c.tone]);
    d.pdf.text(String(c.n), x + cw / 2, d.y + 11, { align: "center" });
    d.font("bold", 7);
    d.color(C.muted);
    d.pdf.text(c.label, x + cw / 2, d.y + 16.5, { align: "center" });
  });
  d.y += 26;

  const block = (title: string, rows: MovementRow[]) => {
    if (!rows.length) return;
    d.ensure(14);
    d.font("bold", 7.5);
    d.color(C.muted);
    d.pdf.text(title, M, d.y + 3.5);
    d.y += 6;
    for (const r of rows) {
      d.ensure(9);
      d.fill(TONE[r.gradeColor]);
      d.pdf.circle(M + 2, d.y + 3.6, 1.3, "F");
      d.font("bold", 9.5);
      d.color(C.ink);
      d.pdf.text(safe(r.name), M + 6, d.y + 4.6);
      d.font("normal", 8);
      d.color(C.muted);
      d.pdf.text(safe(r.movement.tag), W - M - 16, d.y + 4.6, { align: "right" });
      d.font("bold", 10, "times");
      d.color(C.ink);
      d.pdf.text(safe(r.grade), W - M, d.y + 4.8, { align: "right" });
      d.stroke(C.border);
      d.pdf.setLineWidth(0.15);
      d.pdf.line(M, d.y + 7.6, W - M, d.y + 7.6);
      d.y += 8;
    }
    d.y += 3;
  };
  block("DECLINED", groups.declined);
  block("IMPROVED", groups.improved);
  block("HOLDING", groups.holding);
  block("STILL BUILDING A BASELINE", groups.tracking);
}

function drawScores(d: Doc, params: KaiPdfParam[], withFindings: boolean) {
  const barX = M + 62;
  const barW = 82;
  for (const p of params) {
    const findingLines = withFindings && p.finding ? d.wrap(p.finding, CW - 4, 8.5) : [];
    const rowH = 10 + findingLines.length * lineMm(8.5, 1.35) + (findingLines.length ? 2 : 0);
    d.ensure(rowH);
    d.font("bold", 10);
    d.color(C.ink);
    d.pdf.text(safe(p.name), M, d.y + 5);
    d.fill(C.sand);
    rr(d.pdf, barX, d.y + 2.7, barW, 2.6, 1.3, 1.3, "F");
    const fillW = Math.max(2, (barW * Math.max(0, Math.min(10, p.score10))) / 10);
    d.fill(TONE[p.tone]);
    rr(d.pdf, barX, d.y + 2.7, fillW, 2.6, 1.3, 1.3, "F");
    drawPill(d, `${p.grade}/10`, W - M - 17, d.y + 1.5, TONE_TINT[p.tone], TONE[p.tone], 8.5);
    let yy = d.y + 9;
    if (findingLines.length) {
      d.font("normal", 8.5);
      d.color(C.muted);
      for (const line of findingLines) {
        d.pdf.text(line, M, yy);
        yy += lineMm(8.5, 1.35);
      }
      yy += 1;
    }
    d.stroke(C.border);
    d.pdf.setLineWidth(0.15);
    d.pdf.line(M, yy, W - M, yy);
    d.y = yy + 2.5;
  }
  d.y += 3;
}

function drawCard(d: Doc, text: string, size: number, color: RGB = C.ink, label?: string) {
  const lines = d.wrap(text, CW - 10, size);
  const lh = lineMm(size, 1.45);
  const pad = 5;
  const labelH = label ? 6 : 0;
  const h = pad * 2 + labelH + lines.length * lh;
  d.ensure(Math.min(h, 60));
  d.fill(C.cream);
  d.stroke(C.border);
  d.pdf.setLineWidth(0.25);
  rr(d.pdf, M, d.y, CW, h, 3, 3, "FD");
  let yy = d.y + pad + 2.5;
  if (label) {
    d.font("bold", 7);
    d.color(C.muted);
    d.pdf.text(safe(label).toUpperCase(), M + pad, yy);
    yy += 5;
  }
  d.font("normal", size);
  d.color(color);
  for (const line of lines) {
    d.pdf.text(line, M + pad, yy + 1);
    yy += lh;
  }
  d.y += h + 4;
}

function drawActions(d: Doc, actions: Array<{ title: string; detail: string }>) {
  actions.forEach((a, i) => {
    const detailLines = a.detail ? d.wrap(a.detail, CW - 12, 9) : [];
    const h = 8 + detailLines.length * lineMm(9, 1.4) + 4;
    d.ensure(h);
    d.fill(C.navy);
    d.pdf.circle(M + 3.6, d.y + 4, 3.6, "F");
    d.font("bold", 9);
    d.color(C.white);
    d.pdf.text(String(i + 1), M + 3.6, d.y + 5.2, { align: "center" });
    d.font("bold", 10.5);
    d.color(C.ink);
    d.pdf.text(safe(a.title), M + 11, d.y + 4.6);
    let yy = d.y + 10;
    d.font("normal", 9);
    d.color(C.muted);
    for (const line of detailLines) {
      d.pdf.text(line, M + 11, yy);
      yy += lineMm(9, 1.4);
    }
    d.y = yy + 3;
  });
  d.y += 2;
}

function drawNextStep(d: Doc, data: KaiReportPdfData) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const bodyLines = d.wrap(data.nextStep.body, CW - 14, 9.5);
  const headLines = d.wrap(data.nextStep.heading, CW - 14, 14, "bold", "times");
  const h = 12 + headLines.length * 7.2 + bodyLines.length * lineMm(9.5, 1.4) + 18;
  d.ensure(h);
  d.fill(C.navy);
  rr(d.pdf, M, d.y, CW, h, 4, 4, "F");
  d.font("bold", 7);
  d.color(C.soft);
  d.pdf.text("NEXT STEP", M + 7, d.y + 8);
  let yy = d.y + 15;
  d.font("bold", 14, "times");
  d.color(C.white);
  for (const l of headLines) {
    d.pdf.text(l, M + 7, yy);
    yy += 7.2;
  }
  d.font("normal", 9.5);
  d.color(C.soft);
  for (const l of bodyLines) {
    d.pdf.text(l, M + 7, yy);
    yy += lineMm(9.5, 1.4);
  }
  yy += 3;
  let bx = M + 7;
  const buttons: Array<{ b: { label: string; href: string }; primary: boolean }> = [
    { b: data.primary, primary: true },
    { b: data.secondary, primary: false },
  ];
  for (const { b, primary } of buttons) {
    d.font("bold", 8.5);
    const label = safe(b.label);
    const bw = d.pdf.getTextWidth(label) + 10;
    if (primary) {
      d.fill(C.white);
      rr(d.pdf, bx, yy, bw, 8, 4, 4, "F");
      d.color(C.navy);
    } else {
      d.stroke(C.soft);
      d.pdf.setLineWidth(0.3);
      rr(d.pdf, bx, yy, bw, 8, 4, 4, "S");
      d.color(C.white);
    }
    d.pdf.text(label, bx + bw / 2, yy + 5.3, { align: "center" });
    d.pdf.link(bx, yy, bw, 8, { url: `${origin}${b.href}` });
    bx += bw + 4;
  }
  d.y += h + 6;
}

function drawFooters(pdf: jsPDF, doctorLine: string) {
  const total = pdf.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    pdf.setPage(i);
    pdf.setDrawColor(C.border[0], C.border[1], C.border[2]);
    pdf.setLineWidth(0.2);
    pdf.line(M, H - 16, W - M, H - 16);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.5);
    pdf.setTextColor(C.ink[0], C.ink[1], C.ink[2]);
    pdf.text("SkinFit Wellness", M, H - 11.5);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(C.muted[0], C.muted[1], C.muted[2]);
    pdf.text(
      "Flagship Clinic, Koramangala  |  CBD Centre, Ashok Nagar  |  Bengaluru  |  skinfitwellness.in",
      W - M,
      H - 11.5,
      { align: "right" }
    );
    pdf.text(`Page ${i} of ${total}`, W - M, H - 7.2, { align: "right" });
    pdf.setFontSize(6.5);
    pdf.text(
      safe(`kAI is an AI-assisted skin analysis, not a medical diagnosis. ${doctorLine}`),
      M,
      H - 7.2
    );
  }
}

export type PdfAssetLoaders = {
  image: (url: string) => Promise<Img | null>;
  logo: () => Promise<Img | null>;
};

export async function buildKaiReportPdf(
  data: KaiReportPdfData,
  doctorName: string,
  loaders: PdfAssetLoaders = { image: (u) => loadImage(u), logo: loadWhiteLogo }
): Promise<jsPDF> {
  const { jsPDF } = await import("jspdf");

  const [logo, ...imgs] = await Promise.all([
    loaders.logo(),
    ...data.scanImages.map((s) => loaders.image(s.url)),
    ...(data.thenNow
      ? [loaders.image(data.thenNow.previous.url), loaders.image(data.thenNow.current.url)]
      : []),
  ]);
  const scanImgs = imgs.slice(0, data.scanImages.length);
  const thenNowImgs = imgs.slice(data.scanImages.length);

  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  pdf.setProperties({ title: "SkinFit kAI Skin Report", author: "SkinFit Wellness" });
  const d = new Doc(pdf);

  drawHeader(d, data, logo);
  drawPositionBar(d, data);
  drawWatchChips(d, data.parameters);

  if (data.thenNow && thenNowImgs.length === 2) {
    d.section("Then and now", 122);
    drawImageRow(
      d,
      [
        { img: thenNowImgs[0] ?? null, label: `Then - ${data.thenNow.previous.date}` },
        { img: thenNowImgs[1] ?? null, label: `Now - ${data.thenNow.current.date}` },
      ],
      2
    );
    if (data.thenNow.caption) {
      d.paragraph(data.thenNow.caption, { size: 8.5, color: C.muted, gap: 3 });
    }
  }

  if (data.scanImages.length) {
    d.section("Your scan photos", 76);
    drawImageRow(
      d,
      data.scanImages.map((s, i) => ({ img: scanImgs[i] ?? null, label: s.label })),
      Math.min(3, data.scanImages.length)
    );
  }

  if (data.movementGroups) {
    d.section("What moved since last scan", 40);
    drawMovement(d, data.movementGroups);
  }

  d.section(data.kind === "initial" ? "Your baseline scores" : "Your scores today");
  drawScores(d, data.parameters, data.kind === "initial");

  if (data.takeaway) {
    d.section("Our read");
    drawCard(d, data.takeaway, 10);
  }

  if (data.attribution?.length) {
    d.section("Likely factors");
    for (const a of data.attribution) {
      drawCard(d, a.text, 9.5, C.ink, a.label);
    }
  }

  if (data.weekRecap?.length) {
    d.section("Your week");
    const cols = Math.min(4, data.weekRecap.length);
    const gap = 3;
    const cw = (CW - gap * (cols - 1)) / cols;
    d.ensure(22);
    data.weekRecap.slice(0, 4).forEach((r, i) => {
      const x = M + i * (cw + gap);
      d.fill(C.cream);
      d.stroke(C.border);
      d.pdf.setLineWidth(0.25);
      rr(d.pdf, x, d.y, cw, 17, 3, 3, "FD");
      d.font("bold", 6.5);
      d.color(C.muted);
      d.pdf.text(safe(r.label).toUpperCase(), x + cw / 2, d.y + 6, { align: "center" });
      d.font("bold", 10);
      d.color(C.ink);
      d.pdf.text(safe(r.value), x + cw / 2, d.y + 12.5, { align: "center" });
    });
    d.y += 21;
    if (data.weekHighlight) {
      d.paragraph(data.weekHighlight, { size: 9, color: C.muted, gap: 4 });
    }
  }

  if (data.actions.length) {
    d.section(data.actionsHeading);
    drawActions(d, data.actions);
  }

  drawNextStep(d, data);

  drawFooters(pdf, doctorName ? `Questions? Message ${doctorName} in the app.` : "");
  return pdf;
}

export async function downloadKaiReportPdf(
  data: KaiReportPdfData,
  filename: string,
  doctorName: string
): Promise<void> {
  const pdf = await buildKaiReportPdf(data, doctorName);
  pdf.save(filename);
}
