import { cn } from "@/lib/utils";

// Zero-dep SVG sparkline. Accepts a number[] and renders a polyline normalised
// to fit the viewbox. Used inside KpiCell and anywhere a trend preview is needed.
interface SparklineProps {
  values: number[];
  width?: number;
  height?: number;
  strokeClassName?: string;
  fillClassName?: string;
  className?: string;
}

export function Sparkline({
  values,
  width = 120,
  height = 32,
  strokeClassName = "stroke-primary",
  fillClassName,
  className,
}: SparklineProps) {
  if (!values || values.length < 2) {
    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className={cn("overflow-visible", className)}
        aria-hidden
      />
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = width / (values.length - 1);

  const points = values
    .map((v, i) => {
      const x = i * step;
      const y = height - ((v - min) / range) * height;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  const areaPoints = `0,${height} ${points} ${width},${height}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={cn("overflow-visible", className)}
      aria-hidden
    >
      {fillClassName && (
        <polygon points={areaPoints} className={cn("opacity-15", fillClassName)} />
      )}
      <polyline
        points={points}
        fill="none"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={strokeClassName}
      />
    </svg>
  );
}
