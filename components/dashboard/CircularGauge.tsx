"use client";

type CircularGaugeProps = {
  value: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  trackColor?: string;
  valueClassName?: string;
  /** When set, shown in the ring instead of the numeric score (arc still uses `value`). */
  displayValue?: string;
};

export function CircularGauge({
  value,
  size = 72,
  strokeWidth = 6,
  color,
  trackColor = "#E5E7EB",
  valueClassName = "text-[#18181b]",
  displayValue,
}: CircularGaugeProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(value, 100) / 100);
  const valueFontSize =
    displayValue && displayValue.length > 1
      ? "text-base"
      : size >= 60
        ? "text-lg"
        : size >= 52
          ? "text-base"
          : "text-sm";

  return (
    <div
      className="relative mx-auto block shrink-0"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        className="-rotate-90 origin-center block"
        aria-hidden
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`${valueFontSize} font-extrabold leading-none ${valueClassName}`}>
          {displayValue ?? Math.round(value)}
        </span>
      </div>
    </div>
  );
}
