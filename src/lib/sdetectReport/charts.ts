import type { jsPDF } from "jspdf";
import type { SdetectMetric } from "./types";

export const SKINFIT_REPORT_THEME = {
  navy: [36, 42, 95] as [number, number, number],
  navyLight: [74, 82, 140] as [number, number, number],
  peach: [241, 185, 143] as [number, number, number],
  ink: [30, 30, 40] as [number, number, number],
  muted: [100, 100, 110] as [number, number, number],
  grid: [210, 214, 224] as [number, number, number],
  fill: [76, 175, 120] as [number, number, number],
  pageBg: [248, 249, 252] as [number, number, number],
  card: [255, 255, 255] as [number, number, number],
} as const;

export function radarGeometry(
  metrics: SdetectMetric[],
  cx: number,
  cy: number,
  radius: number
) {
  const n = metrics.length;
  const step = (2 * Math.PI) / n;
  const start = -Math.PI / 2;

  const axis = metrics.map((metric, i) => {
    const angle = start + i * step;
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    const lx = cx + (radius + 22) * Math.cos(angle);
    const ly = cy + (radius + 22) * Math.sin(angle);
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

export function drawRadarChart(
  doc: jsPDF,
  metrics: SdetectMetric[],
  x: number,
  y: number,
  size: number
) {
  if (!metrics.length) return;
  const cx = x + size / 2;
  const cy = y + size / 2;
  const radius = size * 0.34;
  const { axis, data, gridLevels } = radarGeometry(metrics, cx, cy, radius);

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
  doc.setFontSize(7);
  doc.setTextColor(...SKINFIT_REPORT_THEME.muted);
  for (const point of axis) {
    const cos = Math.cos(point.angle);
    const lines = doc.splitTextToSize(point.metric.label, 72);
    let align: "left" | "center" | "right" = "center";
    if (cos > 0.35) align = "left";
    else if (cos < -0.35) align = "right";
    doc.text(lines, point.lx, point.ly, { align });
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...SKINFIT_REPORT_THEME.navy);
    doc.text(`${point.metric.score}%`, point.lx, point.ly + lines.length * 8 + 2, {
      align,
    });
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...SKINFIT_REPORT_THEME.muted);
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
