"use client";

import { scaleUtc } from "d3-scale";
import type { Block } from "@/lib/forecast";
import { tierVar } from "@/lib/palette";
import { quarter, mw } from "@/lib/format";
import { useSize } from "@/components/ui";
import { yearTicks } from "@/components/charts/axes";

const ROW = 26;

/** One bar per ramp: a fade while capacity ramps, solid once fully online. */
export function Timeline({ blocks, today }: { blocks: Block[]; today: number }) {
  const [ref, width] = useSize<HTMLDivElement>();
  const t0 = Date.UTC(2026, 0, 1);
  const t1 = Date.UTC(2030, 11, 31);
  const w = Math.max(240, width);
  const x = scaleUtc().domain([t0, t1]).range([0, w]).clamp(true);
  const h = 18 + blocks.length * ROW;
  return (
    <div className="chart" ref={ref}>
      {width > 0 ? (
        <svg width={w} height={h} role="img" aria-label="Delivery timeline for each phase">
          <defs>
            {blocks.map((b) => (
              <linearGradient key={b.ramp.id} id={`g-${b.ramp.id}`} x1="0" x2="1" y1="0" y2="0">
                <stop offset="0" stopColor={tierVar(b.ramp.tier)} stopOpacity={0.15} />
                <stop offset="1" stopColor={tierVar(b.ramp.tier)} stopOpacity={0.9} />
              </linearGradient>
            ))}
          </defs>
          {yearTicks(t0, t1).map((t) => (
            <g key={t}>
              <line className="grid" x1={x(t)} x2={x(t)} y1={14} y2={h} />
              <text x={x(t) + 4} y={10}>{new Date(t).getUTCFullYear()}</text>
            </g>
          ))}
          {blocks.map((b, i) => {
            const y = 18 + i * ROW + 4;
            const xs = x(b.start);
            const xf = x(b.full);
            const label = `${b.ramp.label} · ${mw(b.itMw)} · ${quarter(b.start)}${b.full !== b.start ? `–${quarter(b.full)}` : ""}`;
            const off = !b.enabled;
            return (
              <g key={b.ramp.id} opacity={off ? 0.45 : 1}>
                <title>{label}</title>
                {xf > xs ? <rect x={xs} y={y} width={xf - xs} height={ROW - 10} rx={4} fill={off ? "none" : `url(#g-${b.ramp.id})`} stroke={off ? tierVar(b.ramp.tier) : "none"} strokeDasharray={off ? "3 3" : undefined} /> : null}
                <rect x={xf} y={y} width={Math.max(2, w - xf)} height={ROW - 10} rx={4} fill={off ? "none" : tierVar(b.ramp.tier)} fillOpacity={0.9} stroke={off ? tierVar(b.ramp.tier) : "none"} strokeDasharray={off ? "3 3" : undefined} />
                <text x={Math.min(xs, w - 160) + 6} y={y + ROW - 14} style={{ fill: off ? "var(--ink-2)" : "var(--ink)", fontWeight: 600, paintOrder: "stroke", stroke: "var(--surface)", strokeWidth: 3, strokeLinejoin: "round" }}>
                  {b.ramp.label}
                </text>
              </g>
            );
          })}
          <line className="today" x1={x(today)} x2={x(today)} y1={14} y2={h} />
        </svg>
      ) : (
        <div style={{ height: h }} />
      )}
    </div>
  );
}
