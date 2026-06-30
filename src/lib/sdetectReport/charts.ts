import type { jsPDF } from "jspdf";
import type { SdetectMetric } from "./types";

export const SKINFIT_REPORT_THEME = {
  navy: [30, 58, 95] as [number, number, number],
  navyLight: [74, 82, 140] as [number, number, number],
  peach: [241, 185, 143] as [number, number, number],
  ink: [45, 45, 55] as [number, number, number],
  muted: [120, 120, 130] as [number, number, number],
  grid: [210, 214, 224] as [number, number, number],
  fill: [76, 175, 80] as [number, number, number],
  pageBg: [255, 255, 255] as [number, number, number],
  card: [255, 255, 255] as [number, number, number],
  /** Visible grey panel — matches design mockup patient/chart cards. */
  cardGrey: [236, 239, 245] as [number, number, number],
  cardBorder: [210, 216, 228] as [number, number, number],
  lineDot: [130, 130, 140] as [number, number, number],
  lineStroke: [90, 90, 100] as [number, number, number],
} as const;

export function radarGeometry(
  metrics: SdetectMetric[],
  cx: number,
  cy: number,
  radius: number,
  labelOffset = 12
) {
  const n = metrics.length;
  const step = (2 * Math.PI) / n;
  const start = -Math.PI / 2;

  const axis = metrics.map((metric, i) => {
    const angle = start + i * step;
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    const lx = cx + (radius + labelOffset) * Math.cos(angle);
    const ly = cy + (radius + labelOffset) * Math.sin(angle);
    return { metric, x, y, lx, ly, angle };
  });

  const data = axis.map(({ metric, angle }) => {
    const r = (Math.min(100, Math.max(0, metric.score)) / 100) * radius;
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    };
  });

  const gridLevels = [0.25, 0.5, 0.75, 1].map((level) =>
    axis.map(({ angle }) => ({
      x: cx + radius * level * Math.cos(angle),
      y: cy + radius * level * Math.sin(angle),
    }))
  );

  return { axis, data, gridLevels };
}

export type RadarBounds = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export function drawRadarChart(
  doc: jsPDF,
  metrics: SdetectMetric[],
  bounds: RadarBounds
) {
  if (!metrics.length) return;

  const padX = 8;
  const padTop = 2;
  const padBottom = 4;
  const labelOffset = 12;
  const clipLeft = bounds.x + 4;
  const clipRight = bounds.x + bounds.w - 4;
  const labelMaxW = Math.min(48, bounds.w * 0.36);

  const innerW = bounds.w - padX * 2;
  const innerH = bounds.h - padTop - padBottom;
  const maxRadiusByW = innerW / 2 - labelOffset - 2;
  const maxRadiusByH = innerH / 2 - labelOffset - 6;
  const radius = Math.max(28, Math.min(maxRadiusByW, maxRadiusByH));

  const cx = bounds.x + bounds.w / 2;
  /** Shift center up so labels fit with minimal empty space below. */
  const cy = bounds.y + padTop + labelOffset + radius;

  const { axis, data, gridLevels } = radarGeometry(
    metrics,
    cx,
    cy,
    radius,
    labelOffset
  );

  const drawClosed = (points: { x: number; y: number }[], style: "S" | "FD") => {
    if (points.length < 2) return;
    const rel: [number, number][] = [];
    for (let i = 1; i < points.length; i++) {
      rel.push([points[i].x - points[i - 1].x, points[i].y - points[i - 1].y]);
    }
    doc.lines(rel, points[0].x, points[0].y, [1, 1], style, true);
  };

  doc.setDrawColor(...SKINFIT_REPORT_THEME.grid);
  doc.setLineWidth(0.6);
  for (const ring of gridLevels) drawClosed(ring, "S");

  for (const point of axis) {
    doc.line(cx, cy, point.x, point.y);
  }

  doc.setFillColor(...SKINFIT_REPORT_THEME.fill);
  doc.setDrawColor(...SKINFIT_REPORT_THEME.navy);
  doc.setLineWidth(1.4);
  drawClosed(data, "FD");

  for (const point of data) {
    doc.setFillColor(...SKINFIT_REPORT_THEME.navy);
    doc.circle(point.x, point.y, 2.2, "F");
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(...SKINFIT_REPORT_THEME.muted);
  for (const point of axis) {
    const cos = Math.cos(point.angle);
    const sin = Math.sin(point.angle);
    let lx = point.lx;
    let ly = point.ly;

    let align: "left" | "center" | "right" = "center";
    if (cos > 0.25) align = "left";
    else if (cos < -0.25) align = "right";

    const lines = doc.splitTextToSize(point.metric.label, labelMaxW) as string[];
    const scoreLine = `${point.metric.score}%`;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    const scoreW = doc.getTextWidth(scoreLine);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    const textW = Math.max(
      scoreW,
      ...lines.map((line) => doc.getTextWidth(line))
    );

    if (align === "left" && lx + textW > clipRight) {
      lx = clipRight;
      align = "right";
    } else if (align === "right" && lx - textW < clipLeft) {
      lx = clipLeft;
      align = "left";
    } else if (align === "center") {
      if (cos > 0 && lx + textW / 2 > clipRight) {
        lx = clipRight;
        align = "right";
      } else if (cos < 0 && lx - textW / 2 < clipLeft) {
        lx = clipLeft;
        align = "left";
      }
    }

    /** Nudge bottom labels up slightly to trim dead space under the polygon. */
    if (sin > 0.55) ly -= 4;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(...SKINFIT_REPORT_THEME.muted);
    doc.text(lines, lx, ly, { align });
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...SKINFIT_REPORT_THEME.navy);
    doc.text(scoreLine, lx, ly + lines.length * 7 + 1, { align });
  }
}

type LineChartOptions = {
  compact?: boolean;
};

export function drawLineChart(
  doc: jsPDF,
  title: string,
  metrics: SdetectMetric[],
  x: number,
  y: number,
  width: number,
  height: number,
  options: LineChartOptions = {}
) {
  const compact = options.compact ?? false;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(compact ? 9 : 11);
  doc.setTextColor(...SKINFIT_REPORT_THEME.navy);
  doc.text(title, x, y);

  if (!metrics.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...SKINFIT_REPORT_THEME.muted);
    doc.text("No data available.", x + 10, y + 28);
    return;
  }

  const chartTop = y + (compact ? 12 : 14);
  const chartHeight = height - (compact ? 30 : 36);
  const chartWidth = width - (compact ? 8 : 20);
  const left = x + (compact ? 4 : 10);
  const bottom = chartTop + chartHeight;

  doc.setDrawColor(...SKINFIT_REPORT_THEME.grid);
  doc.setLineWidth(0.5);
  for (const tick of [0, 20, 40, 60, 80, 100]) {
    const ty = bottom - (tick / 100) * chartHeight;
    doc.line(left, ty, left + chartWidth, ty);
    if (!compact) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...SKINFIT_REPORT_THEME.muted);
      doc.text(String(tick), left - 12, ty + 2, { align: "right" });
    }
  }

  const slot = chartWidth / metrics.length;
  const points = metrics.map((metric, i) => {
    const px = left + slot * i + slot / 2;
    const score = Math.min(100, Math.max(0, metric.score));
    const py = bottom - (score / 100) * chartHeight;
    return { metric, px, py, score };
  });

  doc.setDrawColor(...(compact ? SKINFIT_REPORT_THEME.lineStroke : SKINFIT_REPORT_THEME.navy));
  doc.setLineWidth(compact ? 1.1 : 1.4);
  for (let i = 1; i < points.length; i++) {
    doc.line(points[i - 1].px, points[i - 1].py, points[i].px, points[i].py);
  }

  for (const point of points) {
    doc.setFillColor(...(compact ? SKINFIT_REPORT_THEME.lineDot : SKINFIT_REPORT_THEME.peach));
    doc.setDrawColor(...(compact ? SKINFIT_REPORT_THEME.lineDot : SKINFIT_REPORT_THEME.navy));
    doc.setLineWidth(1);
    doc.circle(point.px, point.py, compact ? 2.8 : 3.2, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(compact ? 7 : 8);
    doc.setTextColor(...SKINFIT_REPORT_THEME.ink);
    doc.text(String(point.score), point.px, point.py - (compact ? 6 : 7), {
      align: "center",
    });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(compact ? 5.5 : 6.5);
    doc.setTextColor(...SKINFIT_REPORT_THEME.muted);
    const label = doc.splitTextToSize(point.metric.label, slot * 0.95);
    doc.text(label, point.px, bottom + (compact ? 6 : 8), { align: "center" });
  }
}

export function drawBarChart(
  doc: jsPDF,
  title: string,
  metrics: SdetectMetric[],
  x: number,
  y: number,
  width: number,
  height: number
) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...SKINFIT_REPORT_THEME.navy);
  doc.text(title, x, y);

  if (!metrics.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...SKINFIT_REPORT_THEME.muted);
    doc.text("No data available.", x + 10, y + 28);
    return;
  }

  const chartTop = y + 14;
  const chartHeight = height - 36;
  const chartWidth = width - 20;
  const left = x + 10;
  const bottom = chartTop + chartHeight;

  doc.setDrawColor(...SKINFIT_REPORT_THEME.grid);
  doc.setLineWidth(0.5);
  for (const tick of [0, 20, 40, 60, 80, 100]) {
    const ty = bottom - (tick / 100) * chartHeight;
    doc.line(left, ty, left + chartWidth, ty);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...SKINFIT_REPORT_THEME.muted);
    doc.text(String(tick), left - 12, ty + 2, { align: "right" });
  }

  const slot = chartWidth / metrics.length;
  const barW = Math.min(28, slot * 0.55);

  metrics.forEach((metric, i) => {
    const cx = left + slot * i + slot / 2;
    const barH = (Math.min(100, Math.max(0, metric.score)) / 100) * chartHeight;
    const bx = cx - barW / 2;
    const by = bottom - barH;

    doc.setFillColor(...SKINFIT_REPORT_THEME.peach);
    doc.setDrawColor(...SKINFIT_REPORT_THEME.navyLight);
    doc.roundedRect(bx, by, barW, barH, 2, 2, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...SKINFIT_REPORT_THEME.navy);
    doc.text(String(metric.score), cx, by - 4, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...SKINFIT_REPORT_THEME.muted);
    const label = doc.splitTextToSize(metric.label, barW + 14);
    doc.text(label, cx, bottom + 8, { align: "center" });
  });
}
