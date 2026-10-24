"use client";

import { useMemo, useState } from "react";
import { area, curveMonotoneX, line } from "d3-shape";
import { scaleLinear, scaleUtc } from "d3-scale";
import { useSize } from "@/components/ui";
import { monthYear } from "@/lib/format";
import { domainMax, nearestIndex, yearTicks } from "@/components/charts/axes";

export interface Layer {
  key: string;
  label: string;
  color: string;
  values: number[];
}

export function StackedArea({
  times,
  layers,
  height = 300,
  format,
  tick,
  ceiling,
  ceilingLabel,
  today,
  label,
  highlight,
}: {
  times: number[];
  layers: Layer[];
  height?: number;
  format: (v: number) => string;
  tick?: (v: number) => string;
  ceiling?: number[];
  ceilingLabel?: string;
  today?: number;
  label: string;
  highlight?: string | null;
}) {
  const [ref, width] = useSize<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 52, r: 12, t: 12, b: 26 };
  const w = Math.max(200, width);

  const stacked = useMemo(() => {
    const base = new Array(times.length).fill(0);
    return layers.map((layer) => {
      const lo = [...base];
      layer.values.forEach((v, i) => (base[i] += v));
      return { ...layer, lo, hi: [...base] };
    });
  }, [layers, times.length]);

  const totals = stacked.length ? stacked[stacked.length - 1].hi : times.map(() => 0);
  const max = domainMax(Math.max(0, ...totals), Math.max(0, ...(ceiling ?? [0])));
  const clip = `clip-${label.length}-${layers.length}`;
  const x = scaleUtc().domain([times[0], times[times.length - 1]]).range([pad.l, w - pad.r]);
  const y = scaleLinear().domain([0, max]).nice(4).range([height - pad.b, pad.t]);
  const ticks = y.ticks(4);

  const shape = area<number>()
    .x((_, i) => x(times[i]))
    .curve(curveMonotoneX);

  const i = hover;
  return (
    <div className="chart" ref={ref}>
      {width > 0 ? (
        <svg
          width={w}
          height={height}
          role="img"
          aria-label={label}
          onPointerLeave={() => setHover(null)}
          onPointerMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const t = x.invert(e.clientX - rect.left).getTime();
            setHover(nearestIndex(times, t));
          }}
        >
          <defs>
            <clipPath id={clip}><rect x={pad.l} y={pad.t - 2} width={w - pad.l - pad.r} height={height - pad.t - pad.b + 2} /></clipPath>
          </defs>
          {ticks.map((v) => (
            <g key={v}>
              <line className="grid" x1={pad.l} x2={w - pad.r} y1={y(v)} y2={y(v)} />
              <text x={pad.l - 8} y={y(v) + 4} textAnchor="end">{(tick ?? format)(v)}</text>
            </g>
          ))}
          {yearTicks(times[0], times[times.length - 1]).map((t) => (
            <text key={t} x={x(t)} y={height - 8} textAnchor="middle">{new Date(t).getUTCFullYear()}</text>
          ))}
          {stacked.map((s) => {
            const dim = highlight && highlight !== s.key;
            const d = shape.y0((_, k) => y(s.lo[k])).y1((_, k) => y(s.hi[k]))(s.values);
            const top = line<number>().x((_, k) => x(times[k])).y((_, k) => y(s.hi[k])).curve(curveMonotoneX)(s.values);
            return (
              <g key={s.key} opacity={dim ? 0.18 : 1} style={{ transition: "opacity 0.2s" }}>
                <path d={d ?? ""} fill={s.color} fillOpacity={0.82} />
                <path d={top ?? ""} fill="none" stroke="var(--surface)" strokeWidth={1.5} />
              </g>
            );
          })}
          {ceiling ? (
            <path
              clipPath={`url(#${clip})`}
              d={line<number>().x((_, k) => x(times[k])).y((v) => y(v)).curve(curveMonotoneX)(ceiling) ?? ""}
              fill="none"
              stroke="var(--ink-2)"
              strokeWidth={1.25}
              strokeDasharray="2 3"
            />
          ) : null}
          <line className="axis" x1={pad.l} x2={w - pad.r} y1={height - pad.b} y2={height - pad.b} />
          {today ? (
            <g>
              <line className="today" x1={x(today)} x2={x(today)} y1={pad.t} y2={height - pad.b} />
              <text x={x(today) + 4} y={pad.t + 10}>Today</text>
            </g>
          ) : null}
          {i != null ? <line className="cross" x1={x(times[i])} x2={x(times[i])} y1={pad.t} y2={height - pad.b} /> : null}
        </svg>
      ) : (
        <div style={{ height }} />
      )}
      {i != null && width > 0 ? (
        <div className="tip" style={{ left: Math.min(x(times[i]) + 14, w - 210), top: 8 }}>
          <div className="tip-date">{monthYear(times[i])}</div>
          {[...stacked].reverse().filter((s) => s.values[i] > 0.5).map((s) => (
            <div className="tip-row" key={s.key}>
              <i className="swatch line" style={{ background: s.color }} />
              <span>{s.label}</span>
              <b>{format(s.values[i])}</b>
            </div>
          ))}
          <div className="tip-sep" />
          <div className="tip-row">
            <i />
            <span>Total</span>
            <b>{format(totals[i])}</b>
          </div>
          {ceiling ? (
            <div className="tip-row">
              <i />
              <span>{ceilingLabel}</span>
              <b>{format(ceiling[i])}</b>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
