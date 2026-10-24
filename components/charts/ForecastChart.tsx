"use client";

import { useMemo, useState } from "react";
import { area, curveMonotoneX, curveStepAfter, line } from "d3-shape";
import { scaleLinear, scaleUtc } from "d3-scale";
import type { DailyClose, Tier } from "@/data/types";
import type { Point } from "@/lib/forecast";
import { TIERS, tierLabel } from "@/lib/scenario";
import { tierVar } from "@/lib/palette";
import { monthYear, mw, mwTick, px, usdCompact, usdTick } from "@/lib/format";
import { useSize } from "@/components/ui";
import { domainMax, nearestIndex, yearTicks } from "@/components/charts/axes";

const PANES = { price: 230, mw: 150, rev: 140 };
const GAP = 34;
const pad = { l: 56, r: 16, t: 22, b: 26 };

export function ForecastChart({
  color,
  history,
  street,
  path,
  implied,
  points,
  today,
  events = [],
}: {
  color: string;
  history: DailyClose[];
  street: { mean: number | null; low: number | null; high: number | null };
  path: { t: number; v: number }[];
  implied: number | null;
  points: Point[];
  today: number;
  events?: { t: number; title: string }[];
}) {
  const [ref, width] = useSize<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const w = Math.max(280, width);
  const height = pad.t + PANES.price + GAP + PANES.mw + GAP + PANES.rev + pad.b;

  const hist = useMemo(() => history.map((d) => ({ t: Date.parse(d.date), v: d.close })), [history]);
  const t0 = hist[0]?.t ?? Date.parse("2025-10-01");
  const t1 = points[points.length - 1]?.t ?? Date.parse("2030-12-31");
  const x = scaleUtc().domain([t0, t1]).range([pad.l, w - pad.r]);

  const top1 = pad.t;
  const top2 = top1 + PANES.price + GAP;
  const top3 = top2 + PANES.mw + GAP;

  const pathMax = path.length ? Math.max(...path.map((p) => p.v)) : 0;
  const histMax = hist.length ? Math.max(...hist.map((p) => p.v)) : 1;
  const priceMax = domainMax(Math.max(histMax, street.high ?? 0, implied ?? 0, 1), Math.max(pathMax, 1));
  const yP = scaleLinear().domain([0, priceMax]).nice(4).range([top1 + PANES.price, top1]);

  const mwStack = useMemo(() => stack(points, (p) => p.mw), [points]);
  const revStack = useMemo(() => stack(points, (p) => p.revenue), [points]);
  const on = (r: Record<Tier, number>) => TIERS.reduce((a, t) => a + r[t], 0);
  const mwMax = domainMax(Math.max(0, ...points.map((p) => on(p.mw))), Math.max(0, ...points.map((p) => p.mwAll)));
  const revMax = domainMax(Math.max(0, ...points.map((p) => on(p.revenue))), Math.max(0, ...points.map((p) => p.revenueAll)));
  const yM = scaleLinear().domain([0, mwMax]).nice(3).range([top2 + PANES.mw, top2]);
  const yR = scaleLinear().domain([0, revMax]).nice(3).range([top3 + PANES.rev, top3]);

  const histLine = line<{ t: number; v: number }>().x((d) => x(d.t)).y((d) => yP(d.v))(hist) ?? "";
  const futureLine = line<{ t: number; v: number }>().x((d) => x(d.t)).y((d) => yP(Math.max(0, d.v))).curve(curveMonotoneX)(path) ?? "";
  const streetT = today + 365 * 86_400_000;

  const times = useMemo(() => {
    const lastHist = hist.length ? hist[hist.length - 1].t : 0;
    return [...hist.map((h) => h.t), ...points.map((p) => p.t).filter((t) => t > lastHist)];
  }, [hist, points]);

  const ht = hover != null ? times[hover] : null;
  const near = ht != null ? events.filter((e) => Math.abs(e.t - ht) <= 4 * 86_400_000) : [];
  const hp = ht != null ? pointNear(points, ht) : null;
  const hPrice = ht != null ? priceAt(hist, path, ht) : null;

  return (
    <div className="chart" ref={ref}>
      {width > 0 ? (
        <svg
          width={w}
          height={height}
          role="img"
          aria-label="Share price with implied value, capacity online and revenue run-rate through 2030"
          onPointerLeave={() => setHover(null)}
          onPointerMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const t = x.invert(e.clientX - rect.left).getTime();
            if (t < t0 || t > t1) return setHover(null);
            setHover(nearestIndex(times, t));
          }}
        >
          <defs>
            <clipPath id="fc-price"><rect x={pad.l} y={top1 - 2} width={w - pad.l - pad.r} height={PANES.price + 2} /></clipPath>
            <clipPath id="fc-mw"><rect x={pad.l} y={top2 - 2} width={w - pad.l - pad.r} height={PANES.mw + 2} /></clipPath>
            <clipPath id="fc-rev"><rect x={pad.l} y={top3 - 2} width={w - pad.l - pad.r} height={PANES.rev + 2} /></clipPath>
          </defs>
          {yearTicks(t0, t1).map((t) => (
            <g key={t}>
              <line className="grid" x1={x(t)} x2={x(t)} y1={top1} y2={top3 + PANES.rev} />
              <text x={x(t)} y={height - 8} textAnchor="middle">{new Date(t).getUTCFullYear()}</text>
            </g>
          ))}

          {/* Share price */}
          <text className="pane-label" x={pad.l} y={top1 - 8}>Share price · history and implied value</text>
          {yP.ticks(4).map((v) => (
            <g key={`p${v}`}>
              <line className="grid" x1={pad.l} x2={w - pad.r} y1={yP(v)} y2={yP(v)} />
              <text x={pad.l - 8} y={yP(v) + 4} textAnchor="end">${v}</text>
            </g>
          ))}
          <line className="axis" x1={pad.l} x2={w - pad.r} y1={yP(0)} y2={yP(0)} />
          <path d={histLine} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
          {path.length ? <path clipPath="url(#fc-price)" d={futureLine} fill="none" stroke={color} strokeWidth={2} strokeDasharray="5 4" opacity={0.9} /> : null}
          {street.mean != null ? (
            <g>
              {street.low != null && street.high != null ? (
                <line x1={x(streetT)} x2={x(streetT)} y1={yP(street.low)} y2={yP(street.high)} stroke="var(--muted)" strokeWidth={1.5} />
              ) : null}
              <rect x={x(streetT) - 4} y={yP(street.mean) - 4} width={8} height={8} transform={`rotate(45 ${x(streetT)} ${yP(street.mean)})`} fill="var(--surface)" stroke="var(--ink-2)" strokeWidth={1.5} />
              <text x={x(streetT) + 9} y={yP(street.mean) + 4} style={{ paintOrder: "stroke", stroke: "var(--surface)", strokeWidth: 4 }}>Street target {px(street.mean)}</text>
            </g>
          ) : null}
          {events.filter((e) => e.t >= t0 && e.t <= t1).map((e, i) => {
            const v = priceAt(hist, path, e.t);
            const cy = v != null ? yP(v) : yP(0);
            return (
              <g key={`${e.t}-${i}`}>
                <line x1={x(e.t)} x2={x(e.t)} y1={cy + 6} y2={yP(0)} stroke="var(--ink-2)" strokeWidth={1} strokeDasharray="1 3" opacity={0.6} />
                <circle cx={x(e.t)} cy={cy} r={4.5} fill="var(--surface)" stroke="var(--ink)" strokeWidth={1.5} />
              </g>
            );
          })}
          {implied != null && implied > 0 ? (
            <g>
              <circle cx={x(today)} cy={yP(implied)} r={5} fill="var(--surface)" stroke={color} strokeWidth={2} />
              <text x={x(today) + 10} y={yP(implied) + 16} style={{ fill: "var(--ink)", fontWeight: 600, paintOrder: "stroke", stroke: "var(--surface)", strokeWidth: 4 }}>Implied today {px(implied)}</text>
            </g>
          ) : null}

          {/* Capacity */}
          <text className="pane-label" x={pad.l} y={top2 - 8}>Critical IT online</text>
          {yM.ticks(3).map((v) => (
            <g key={`m${v}`}>
              <line className="grid" x1={pad.l} x2={w - pad.r} y1={yM(v)} y2={yM(v)} />
              <text x={pad.l - 8} y={yM(v) + 4} textAnchor="end">{mwTick(v)}</text>
            </g>
          ))}
          <Stack stack={mwStack} points={points} x={x} y={yM} />
          <path clipPath="url(#fc-mw)" d={line<Point>().x((p) => x(p.t)).y((p) => yM(p.mwAll)).curve(curveStepAfter)(points) ?? ""} fill="none" stroke="var(--ink-2)" strokeWidth={1.25} strokeDasharray="2 3" />
          <line className="axis" x1={pad.l} x2={w - pad.r} y1={yM(0)} y2={yM(0)} />

          {/* Revenue */}
          <text className="pane-label" x={pad.l} y={top3 - 8}>Annual revenue run-rate</text>
          {yR.ticks(3).map((v) => (
            <g key={`r${v}`}>
              <line className="grid" x1={pad.l} x2={w - pad.r} y1={yR(v)} y2={yR(v)} />
              <text x={pad.l - 8} y={yR(v) + 4} textAnchor="end">{usdTick(v)}</text>
            </g>
          ))}
          <Stack stack={revStack} points={points} x={x} y={yR} />
          <path clipPath="url(#fc-rev)" d={line<Point>().x((p) => x(p.t)).y((p) => yR(p.revenueAll)).curve(curveStepAfter)(points) ?? ""} fill="none" stroke="var(--ink-2)" strokeWidth={1.25} strokeDasharray="2 3" />
          <line className="axis" x1={pad.l} x2={w - pad.r} y1={yR(0)} y2={yR(0)} />

          <line className="today" x1={x(today)} x2={x(today)} y1={top1} y2={top3 + PANES.rev} />
          <text x={x(today) + 4} y={top1 + 10}>Today</text>
          {ht != null ? <line className="cross" x1={x(ht)} x2={x(ht)} y1={top1} y2={top3 + PANES.rev} /> : null}
        </svg>
      ) : (
        <div style={{ height }} />
      )}
      {ht != null && width > 0 ? (
        <div className="tip" style={{ left: x(ht) > w / 2 ? x(ht) - 214 : x(ht) + 14, top: top1 + 4 }}>
          <div className="tip-date">{ht <= today ? new Date(ht).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : monthYear(ht)}</div>
          {hPrice != null ? (
            <div className="tip-row">
              <i className="swatch line" style={{ background: color }} />
              <span>{ht <= today ? "Close" : "Implied value"}</span>
              <b>{px(hPrice)}</b>
            </div>
          ) : null}
          {near.map((e, i) => (
            <div className="tip-event" key={i}>{e.title}</div>
          ))}
          {hp ? (
            <>
              <div className="tip-sep" />
              {[...TIERS].reverse().filter((t) => hp.mw[t] > 0.5).map((t) => (
                <div className="tip-row" key={t}>
                  <i className="swatch" style={{ background: tierVar(t) }} />
                  <span>{tierLabel[t]}</span>
                  <b>{mw(hp.mw[t])}</b>
                </div>
              ))}
              <div className="tip-row">
                <i />
                <span>Revenue run-rate</span>
                <b>{usdCompact(TIERS.reduce((a, t) => a + hp.revenue[t], 0))}</b>
              </div>
              {hp.mwAll - TIERS.reduce((a, t) => a + hp.mw[t], 0) > 1 ? (
                <div className="tip-row">
                  <i />
                  <span>Switched off</span>
                  <b>{mw(hp.mwAll - TIERS.reduce((a, t) => a + hp.mw[t], 0))}</b>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
      <div className="legend" style={{ marginTop: 8 }}>
        <span><i className="swatch line" style={{ background: color }} />Close</span>
        <span><svg width="16" height="4" aria-hidden="true"><line x1="0" x2="16" y1="2" y2="2" stroke={color} strokeWidth="2" strokeDasharray="5 4" /></svg>Implied value at run-rate</span>
        {TIERS.map((t) => <span key={t}><i className="swatch" style={{ background: tierVar(t) }} />{tierLabel[t]}</span>)}
        <span><svg width="16" height="4" aria-hidden="true"><line x1="0" x2="16" y1="2" y2="2" stroke="var(--ink-2)" strokeWidth="1.25" strokeDasharray="2 3" /></svg>Everything switched on</span>
        {events.length ? <span><svg width="10" height="10" aria-hidden="true"><circle cx="5" cy="5" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>Announcement</span> : null}
      </div>
    </div>
  );
}

type Stacked = { tier: Tier; lo: number[]; hi: number[] }[];

function stack(points: Point[], pick: (p: Point) => Record<Tier, number>): Stacked {
  const base = points.map(() => 0);
  return TIERS.map((tier) => {
    const lo = [...base];
    points.forEach((p, i) => (base[i] += pick(p)[tier]));
    return { tier, lo, hi: [...base] };
  });
}

function Stack({ stack: s, points, x, y }: { stack: Stacked; points: Point[]; x: (t: number) => number; y: (v: number) => number }) {
  return (
    <g>
      {s.map((layer) => {
        if (layer.hi.every((v, i) => v - layer.lo[i] < 1e-6)) return null;
        const d = area<Point>()
          .x((p) => x(p.t))
          .y0((_, i) => y(layer.lo[i]))
          .y1((_, i) => y(layer.hi[i]))
          .curve(curveMonotoneX)(points);
        return <path key={layer.tier} d={d ?? ""} fill={tierVar(layer.tier)} stroke="var(--surface)" strokeWidth={1} />;
      })}
    </g>
  );
}

function pointNear(points: Point[], t: number): Point | null {
  if (!points.length || t < points[0].t - 31 * 86_400_000) return null;
  return points[nearestIndex(points.map((p) => p.t), t)];
}

function priceAt(hist: { t: number; v: number }[], path: { t: number; v: number }[], t: number): number | null {
  const lastHist = hist[hist.length - 1];
  if (lastHist && t <= lastHist.t) return hist[nearestIndex(hist.map((h) => h.t), t)].v;
  if (!path.length) return null;
  return Math.max(0, path[nearestIndex(path.map((p) => p.t), t)].v);
}
