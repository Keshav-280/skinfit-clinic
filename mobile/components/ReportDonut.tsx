import { memo } from "react";
import { Text, View } from "react-native";
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
  /** When set, shown in the ring center (arc still uses `percent`). */
  displayValue?: string;
};

function ReportDonutInner({
  percent,
  size,
  stroke,
  color,
  trackColor = "rgba(0,0,0,0.08)",
  displayValue,
}: Props) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = clamp(percent);
  const offset = c * (1 - pct / 100);
  const cx = size / 2;
  const cy = size / 2;
  const centerLabel = displayValue ?? String(pct);
  const fontSize =
    displayValue && displayValue.length > 1
      ? Math.max(10, Math.round(size * 0.22))
      : Math.max(12, Math.round(size * 0.28));

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
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
      <Text
        style={{
          position: "absolute",
          fontSize,
          fontWeight: "800",
          color: "#18181b",
        }}
      >
        {centerLabel}
      </Text>
    </View>
  );
}

export const ReportDonut = memo(ReportDonutInner);
