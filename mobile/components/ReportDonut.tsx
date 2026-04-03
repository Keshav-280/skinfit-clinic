import { memo } from "react";
import Svg, { Circle, G } from "react-native-svg";

function clamp(n: number) {
  return Math.min(100, Math.max(0, Math.round(n)));
}

type Props = {
  percent: number;
  size: number;
  stroke: number;
  color: string;
  trackColor?: string;
};

function ReportDonutInner({
  percent,
  size,
  stroke,
  color,
  trackColor = "rgba(0,0,0,0.08)",
}: Props) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = clamp(percent);
  const offset = c * (1 - pct / 100);
  const cx = size / 2;
  const cy = size / 2;

  return (
    <Svg width={size} height={size}>
      <Circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={trackColor}
        strokeWidth={stroke}
      />
      <G rotation={-90} origin={`${cx}, ${cy}`}>
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={offset}
        />
      </G>
    </Svg>
  );
}

export const ReportDonut = memo(ReportDonutInner);
