import type { jsPDF } from "jspdf";
import { ptToMm } from "./pdfPage";
import type { SdetectMetric } from "./types";

export const SKINFIT_REPORT_THEME = {
  navy: [30, 58, 95] as [number, number, number],
  navyLight: [74, 82, 140] as [number, number, number],
  peach: [241, 185, 143] as [number, number, number],
  ink: [45, 45, 55] as [number, number, number],
  muted: [120, 120, 130] as [number, number, number],
  grid: [210, 214, 224] as [number, number, number],
  /** Radar polygon fill — ~75% of [76,175,80] over white. */
  fill: [121, 195, 124] as [number, number, number],
  pageBg: [255, 255, 255] as [number, number, number],
  card: [255, 255, 255] as [number, number, number],
  /** Visible grey panel — matches design mockup patient/chart cards. */
  cardGrey: [236, 239, 245] as [number, number, number],
  cardBorder: [210, 216, 228] as [number, number, number],
  lineDot: [130, 130, 140] as [number, number, number],
  lineStroke: [90, 90, 100] as [number, number, number],
} as const;

type RGB = [number, number, number];

/** Gauge colour stops (position 0..1 across the arc): red -> orange -> amber -> green. */
const GAUGE_STOPS: Array<{ at: number; rgb: RGB }> = [
  { at: 0, rgb: [214, 69, 69] },
  { at: 0.35, rgb: [232, 139, 72] },
  { at: 0.62, rgb: [224, 183, 74] },
  { at: 1, rgb: [76, 175, 80] },
];

function gaugeColorAt(t: number): RGB {
  const clamped = Math.max(0, Math.min(1, t));
  for (let i = 1; i < GAUGE_STOPS.length; i += 1) {
    const prev = GAUGE_STOPS[i - 1];
    const next = GAUGE_STOPS[i];
    if (clamped <= next.at) {
      const span = next.at - prev.at || 1;
      const f = (clamped - prev.at) / span;
      return [
        Math.round(prev.rgb[0] + (next.rgb[0] - prev.rgb[0]) * f),
        Math.round(prev.rgb[1] + (next.rgb[1] - prev.rgb[1]) * f),
        Math.round(prev.rgb[2] + (next.rgb[2] - prev.rgb[2]) * f),
      ];
    }
  }
  return GAUGE_STOPS[GAUGE_STOPS.length - 1].rgb;
}

/**
 * Semicircular SkinFit score gauge (speedometer style). Fills a red->green
 * rainbow arc up to `score`, greys the remainder. Draws no text — the caller
 * positions the number/label to keep layout control.
 */
export function drawScoreGauge(
  doc: jsPDF,
  cx: number,
  baselineY: number,
  radius: number,
  score: number,
  thickness = 9
) {
  const value = Math.max(0, Math.min(100, score)) / 100;
  const segments = 72;
  doc.setLineWidth(thickness);
  // jsPDF typing omits setLineCap; it exists at runtime.
  (doc as unknown as { setLineCap: (cap: string) => void }).setLineCap("round");

  const point = (t: number) => {
    const theta = Math.PI * (1 - t);
    return { x: cx + radius * Math.cos(theta), y: baselineY - radius * Math.sin(theta) };
  };

  for (let i = 0; i < segments; i += 1) {
    const t0 = i / segments;
    const t1 = (i + 1) / segments;
    const mid = (t0 + t1) / 2;
    const p0 = point(t0);
    const p1 = point(t1);
    if (mid <= value) {
      doc.setDrawColor(...gaugeColorAt(mid));
    } else {
      doc.setDrawColor(224, 226, 232);
    }
    doc.line(p0.x, p0.y, p1.x, p1.y);
  }

  (doc as unknown as { setLineCap: (cap: string) => void }).setLineCap("butt");
}

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
  /** Keep upper-axis labels below this y (avoids overlapping a title above the chart). */
  labelMinY?: number;
  /** Keep lower-axis labels above this y (clips labels inside the card). */
  labelMaxY?: number;
};

export type RadarChartOptions = {
  /** Tighter layout for 9+ axes (e.g. 11-parameter Medixora reports). */
  compact?: boolean;
};

const COMPACT_RADAR_LABELS: Record<string, string> = {
  "Superficial pigment": "Sup. pigment",
  "Brown pigment": "Brown pigment",
  "Mixed spot": "Mixed spot",
  "Deep Pigment": "Deep pigment",
  "Heat Map of Sensitivity": "Heat sens.",
  "Red Map of Sensitivity": "Red sens.",
};

function radarDisplayLabel(label: string, compact: boolean): string {
  if (!compact) return label;
  return COMPACT_RADAR_LABELS[label] ?? label;
}

type RadarLabelLayout = {
  cos: number;
  sin: number;
  lx: number;
  ly: number;
  align: "left" | "center" | "right";
  lines: string[];
  scoreLine: string;
  textW: number;
  blockTop: number;
  blockBottom: number;
  blockLeft: number;
  blockRight: number;
};

function measureSingleLineBlock(
  doc: jsPDF,
  lx: number,
  ly: number,
  align: "left" | "center" | "right",
  label: string,
  scoreLine: string,
  labelFontSize: number
): { top: number; bottom: number; left: number; right: number } {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(labelFontSize);
  const labelW = doc.getTextWidth(label);
  doc.setFont("helvetica", "bold");
  const scoreW = doc.getTextWidth(scoreLine);
  const gap = ptToMm(1.5);
  const totalW = labelW + gap + scoreW;
  const ascent = ptToMm(labelFontSize * 0.85);
  const descent = ptToMm(labelFontSize * 0.2);
  let left = lx;
  if (align === "right") left = lx - totalW;
  else if (align === "center") left = lx - totalW / 2;
  return {
    top: ly - ascent,
    bottom: ly + descent,
    left,
    right: left + totalW,
  };
}

function measureMultiLineBlock(
  lx: number,
  ly: number,
  align: "left" | "center" | "right",
  textW: number,
  lineCount: number,
  labelLineH: number,
  labelFontSize: number,
  scoreGap = 0
): { top: number; bottom: number; left: number; right: number } {
  const ascent = ptToMm(labelFontSize * 0.85);
  const descent = ptToMm(labelFontSize * 0.2);
  let left = lx;
  if (align === "right") left = lx - textW;
  else if (align === "center") left = lx - textW / 2;
  return {
    top: ly - ascent,
    bottom: ly + (lineCount - 1) * labelLineH + scoreGap + descent,
    left,
    right: left + textW,
  };
}

function remeasureLayout(
  doc: jsPDF,
  layout: RadarLabelLayout,
  labelFontSize: number,
  labelLineH: number,
  textW: number,
  scoreGap: number
) {
  const block = measureMultiLineBlock(
    layout.lx,
    layout.ly,
    layout.align,
    textW,
    layout.lines.length + 1,
    labelLineH,
    labelFontSize,
    scoreGap
  );
  layout.blockTop = block.top;
  layout.blockBottom = block.bottom;
  layout.blockLeft = block.left;
  layout.blockRight = block.right;
}

function clampLayoutToBounds(
  doc: jsPDF,
  layout: RadarLabelLayout,
  labelFontSize: number,
  labelLineH: number,
  textW: number,
  scoreGap: number,
  clipLeft: number,
  clipRight: number,
  labelMinY: number,
  labelMaxY: number
) {
  remeasureLayout(doc, layout, labelFontSize, labelLineH, textW, scoreGap);
  if (layout.blockRight > clipRight) {
    layout.lx -= layout.blockRight - clipRight;
  }
  if (layout.blockLeft < clipLeft) {
    layout.lx += clipLeft - layout.blockLeft;
  }
  if (layout.blockBottom > labelMaxY) {
    layout.ly -= layout.blockBottom - labelMaxY;
  }
  if (layout.blockTop < labelMinY) {
    layout.ly += labelMinY - layout.blockTop;
  }
  remeasureLayout(doc, layout, labelFontSize, labelLineH, textW, scoreGap);
}

function distributeLabelsVertically(
  layouts: RadarLabelLayout[],
  minY: number,
  maxY: number,
  minGap: number
) {
  if (layouts.length < 2) return;
  layouts.sort((a, b) => a.ly - b.ly);
  const heights = layouts.map((l) => l.blockBottom - l.blockTop);
  const totalH = heights.reduce((sum, h) => sum + h, 0);
  const gap = Math.max(minGap, (maxY - minY - totalH) / (layouts.length - 1));
  let cursor = minY;
  layouts.forEach((layout, index) => {
    const h = heights[index];
    const shift = cursor - layout.blockTop;
    layout.ly += shift;
    layout.blockTop += shift;
    layout.blockBottom += shift;
    cursor += h + gap;
  });
}

function distributeLabelsHorizontally(
  layouts: RadarLabelLayout[],
  minX: number,
  maxX: number,
  minGap: number
) {
  if (layouts.length < 2) return;
  layouts.sort((a, b) => a.lx - b.lx);
  const widths = layouts.map((l) => l.blockRight - l.blockLeft);
  const totalW = widths.reduce((sum, w) => sum + w, 0);
  const gap = Math.max(minGap, (maxX - minX - totalW) / (layouts.length - 1));
  let cursor = minX;
  layouts.forEach((layout, index) => {
    const w = widths[index];
    const shift = cursor - layout.blockLeft;
    layout.lx += shift;
    layout.blockLeft += shift;
    layout.blockRight += shift;
    cursor += w + gap;
  });
}

function resolveLabelCollisions(
  layouts: RadarLabelLayout[],
  minGap: number,
  minY: number,
  maxY: number
) {
  if (layouts.length < 2) return;
  layouts.sort((a, b) => a.blockTop - b.blockTop);

  for (let i = 1; i < layouts.length; i++) {
    const overlap = layouts[i - 1].blockBottom + minGap - layouts[i].blockTop;
    if (overlap > 0) {
      layouts[i].ly += overlap;
      layouts[i].blockTop += overlap;
      layouts[i].blockBottom += overlap;
    }
  }

  const overflow = layouts[layouts.length - 1].blockBottom - maxY;
  if (overflow > 0) {
    for (const layout of layouts) {
      layout.ly -= overflow;
      layout.blockTop -= overflow;
      layout.blockBottom -= overflow;
    }
  }

  const underflow = minY - layouts[0].blockTop;
  if (underflow > 0) {
    for (const layout of layouts) {
      layout.ly += underflow;
      layout.blockTop += underflow;
      layout.blockBottom += underflow;
    }
  }
}

function resolveHorizontalCollisions(
  layouts: RadarLabelLayout[],
  minGap: number,
  minX: number,
  maxX: number
) {
  if (layouts.length < 2) return;
  layouts.sort((a, b) => a.blockLeft - b.blockLeft);

  for (let i = 1; i < layouts.length; i++) {
    const overlap = layouts[i - 1].blockRight + minGap - layouts[i].blockLeft;
    if (overlap > 0) {
      layouts[i].lx += overlap;
      layouts[i].blockLeft += overlap;
      layouts[i].blockRight += overlap;
    }
  }

  const overflow = layouts[layouts.length - 1].blockRight - maxX;
  if (overflow > 0) {
    for (const layout of layouts) {
      layout.lx -= overflow;
      layout.blockLeft -= overflow;
      layout.blockRight -= overflow;
    }
  }

  const underflow = minX - layouts[0].blockLeft;
  if (underflow > 0) {
    for (const layout of layouts) {
      layout.lx += underflow;
      layout.blockLeft += underflow;
      layout.blockRight += underflow;
    }
  }
}

function drawRadarLabel(
  doc: jsPDF,
  layout: RadarLabelLayout,
  labelFontSize: number,
  labelLineH: number,
  scoreGap: number
) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(labelFontSize);
  doc.setTextColor(...SKINFIT_REPORT_THEME.muted);
  doc.text(layout.lines, layout.lx, layout.ly, { align: layout.align });

  const scoreY = layout.ly + layout.lines.length * labelLineH + scoreGap;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(labelFontSize);
  doc.setTextColor(...SKINFIT_REPORT_THEME.navy);
  doc.text(layout.scoreLine, layout.lx, scoreY, { align: layout.align });
}

export function drawRadarChart(
  doc: jsPDF,
  metrics: SdetectMetric[],
  bounds: RadarBounds,
  options: RadarChartOptions = {}
) {
  if (!metrics.length) return;

  const compact = options.compact ?? metrics.length > 8;
  const padX = ptToMm(compact ? 6 : 8);
  const padY = ptToMm(compact ? 4 : 6);
  const labelOffset = ptToMm(compact ? 14 : 14);
  const labelReserve = ptToMm(compact ? 12 : 6);
  const compactRadiusScale = compact ? 0.78 : 1;
  const clipInset = ptToMm(compact ? 5 : 4);
  const clipLeft = bounds.x + clipInset;
  const clipRight = bounds.x + bounds.w - clipInset;
  const labelMinY = bounds.labelMinY ?? bounds.y + padY;
  const labelMaxY = bounds.labelMaxY ?? bounds.y + bounds.h - padY;
  const labelFontSize = compact ? 4.8 : 6;
  const labelLineH = ptToMm(compact ? 6.5 : 7);
  const scoreGap = ptToMm(compact ? 2.5 : 2);
  const labelCollisionGap = ptToMm(compact ? 1.5 : 3);
  const dataDotR = ptToMm(compact ? 1.3 : 2.2);
  const labelLineExtent = ptToMm(compact ? labelFontSize * 2.4 + 3 : labelFontSize + 1.5);

  const innerW = bounds.w - padX * 2;
  const cx = bounds.x + bounds.w / 2;
  const cy = bounds.y + bounds.h / 2;
  const maxRadiusByW = innerW / 2 - labelOffset - labelReserve;
  const maxRadiusByTop = cy - labelMinY - labelOffset - labelLineExtent - ptToMm(compact ? 2 : 0);
  const maxRadiusByBottom = labelMaxY - cy - labelOffset - labelLineExtent - ptToMm(compact ? 2 : 0);
  const radius =
    Math.max(0, Math.min(maxRadiusByW, maxRadiusByTop, maxRadiusByBottom)) * compactRadiusScale;
  if (radius < ptToMm(5)) return;

  const { axis, data, gridLevels } = radarGeometry(metrics, cx, cy, radius, labelOffset);

  const drawClosed = (points: { x: number; y: number }[], style: "S" | "FD") => {
    if (points.length < 2) return;
    const rel: [number, number][] = [];
    for (let i = 1; i < points.length; i++) {
      rel.push([points[i].x - points[i - 1].x, points[i].y - points[i - 1].y]);
    }
    doc.lines(rel, points[0].x, points[0].y, [1, 1], style, true);
  };

  doc.setDrawColor(...SKINFIT_REPORT_THEME.grid);
  doc.setLineWidth(ptToMm(0.6));
  for (const ring of gridLevels) drawClosed(ring, "S");

  for (const point of axis) {
    doc.line(cx, cy, point.x, point.y);
  }

  doc.setFillColor(...SKINFIT_REPORT_THEME.fill);
  doc.setDrawColor(...SKINFIT_REPORT_THEME.navy);
  doc.setLineWidth(ptToMm(compact ? 1 : 1.4));
  drawClosed(data, "FD");

  for (const point of data) {
    doc.setFillColor(...SKINFIT_REPORT_THEME.navy);
    doc.circle(point.x, point.y, dataDotR, "F");
  }

  const layouts: RadarLabelLayout[] = [];

  for (const point of axis) {
    const cos = Math.cos(point.angle);
    const sin = Math.sin(point.angle);
    let lx = point.lx;
    let ly = point.ly;

    let align: "left" | "center" | "right" = "center";
    if (cos > 0.3) align = "left";
    else if (cos < -0.3) align = "right";

    const displayLabel = radarDisplayLabel(point.metric.label, compact);
    const scoreLine = `${point.metric.score}%`;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(labelFontSize);
    const lines = [displayLabel];
    doc.setFont("helvetica", "bold");
    const scoreW = doc.getTextWidth(scoreLine);
    doc.setFont("helvetica", "normal");
    const textW = Math.max(scoreW, ...lines.map((line) => doc.getTextWidth(line)));

    if (align === "left" && lx + textW > clipRight) {
      lx = clipRight;
      align = "right";
    } else if (align === "right" && lx - textW < clipLeft) {
      lx = clipLeft;
      align = "left";
    } else if (align === "center") {
      if (lx + textW / 2 > clipRight) {
        lx = clipRight;
        align = "right";
      } else if (lx - textW / 2 < clipLeft) {
        lx = clipLeft;
        align = "left";
      }
    }

    const measureBlock = () =>
      measureMultiLineBlock(
        lx,
        ly,
        align,
        textW,
        lines.length + 1,
        labelLineH,
        labelFontSize,
        scoreGap
      );

    let block = measureBlock();

    if (sin > 0.5) ly -= ptToMm(2);
    if (sin < -0.45) ly -= ptToMm(compact ? 3 : 6);

    block = measureBlock();

    if (block.bottom > labelMaxY) {
      ly -= block.bottom - labelMaxY;
      block = measureBlock();
    }
    if (block.top < labelMinY) {
      ly += labelMinY - block.top;
      block = measureBlock();
    }

    layouts.push({
      cos,
      sin,
      lx,
      ly,
      align,
      lines,
      scoreLine,
      textW,
      blockTop: block.top,
      blockBottom: block.bottom,
      blockLeft: block.left,
      blockRight: block.right,
    });
  }

  const quadrant = (layout: RadarLabelLayout): "left" | "right" | "top" | "bottom" => {
    const absCos = Math.abs(layout.cos);
    const absSin = Math.abs(layout.sin);
    if (absCos > absSin) return layout.cos > 0 ? "right" : "left";
    return layout.sin > 0 ? "bottom" : "top";
  };

  const leftLabels = layouts.filter((l) => quadrant(l) === "left");
  const rightLabels = layouts.filter((l) => quadrant(l) === "right");
  const topLabels = layouts.filter((l) => quadrant(l) === "top");
  const bottomLabels = layouts.filter((l) => quadrant(l) === "bottom");

  if (compact) {
    distributeLabelsVertically(leftLabels, labelMinY, labelMaxY, labelCollisionGap);
    distributeLabelsVertically(rightLabels, labelMinY, labelMaxY, labelCollisionGap);
    distributeLabelsHorizontally(topLabels, clipLeft, clipRight, labelCollisionGap);
    distributeLabelsHorizontally(bottomLabels, clipLeft, clipRight, labelCollisionGap);
  } else {
    resolveLabelCollisions(leftLabels, labelCollisionGap, labelMinY, labelMaxY);
    resolveLabelCollisions(rightLabels, labelCollisionGap, labelMinY, labelMaxY);
    resolveHorizontalCollisions(topLabels, labelCollisionGap, clipLeft, clipRight);
    resolveHorizontalCollisions(bottomLabels, labelCollisionGap, clipLeft, clipRight);
  }

  for (const layout of layouts) {
    clampLayoutToBounds(
      doc,
      layout,
      labelFontSize,
      labelLineH,
      layout.textW,
      scoreGap,
      clipLeft,
      clipRight,
      labelMinY,
      labelMaxY
    );
  }

  for (const layout of layouts) {
    drawRadarLabel(doc, layout, labelFontSize, labelLineH, scoreGap);
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
