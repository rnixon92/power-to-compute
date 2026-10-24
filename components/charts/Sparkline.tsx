import type { DailyClose } from "@/data/types";

export function Sparkline({ data, color, width = 120, height = 36 }: { data: DailyClose[]; color: string; width?: number; height?: number }) {
  if (data.length < 2) return <svg width={width} height={height} aria-hidden="true" />;
  const vals = data.map((d) => d.close);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const x = (i: number) => (i / (data.length - 1)) * width;
  const y = (v: number) => 2 + (1 - (v - lo) / Math.max(1e-9, hi - lo)) * (height - 4);
  const d = vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}
