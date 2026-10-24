"use client";

import Link from "next/link";
import { useState } from "react";
import { scaleBand, scaleLinear } from "d3-scale";
import { book } from "@/data/ledger";
import {
  azureGrowth,
  bcgShare,
  dominionPlan,
  dominionQueue,
  epriSource,
  epriTwh,
  ercotQueue,
  goldman,
  goldmanBuildGap,
  lbnl2030,
  nvidiaDc,
  openaiScale,
  openRouter,
  openRouterRankings,
  pjmLoad,
  sp,
  twhAverage2030,
} from "@/data/studies";
import { signedMw } from "@/lib/forecast";
import { inventory, pileTotal, type InventoryItem, type Pile } from "@/lib/inventory";
import { tenantRows } from "@/lib/tenants";
import { useHref, useScenario } from "@/components/ScenarioProvider";
import { useSize } from "@/components/ui";
import { isoToLabel, mw } from "@/lib/format";
import { UsMap, type Pin } from "@/components/charts/UsMap";

interface LineSeries {
  key: string;
  label: string;
  color: string;
  points: { year: number; v: number }[];
}

function YearChart({
  lines,
  band,
  marks,
  unit,
  label,
  height = 300,
}: {
  lines: LineSeries[];
  band?: { color: string; points: { year: number; lo: number; hi: number }[] };
  marks?: { year: number; v: number; lo?: number; hi?: number; color: string; label: string; shape: "dot" | "diamond" }[];
  unit: string;
  label: string;
  height?: number;
}) {
  const [ref, width] = useSize<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const w = Math.max(260, width);
  const pad = { l: 48, r: 96, t: 30, b: 28 };
  const years = [2024, 2025, 2026, 2027, 2028, 2029, 2030];
  const all = [...lines.flatMap((l) => l.points.map((p) => p.v)), ...(band?.points.map((p) => p.hi) ?? []), ...(marks?.map((m) => m.hi ?? m.v) ?? [])];
  const x = scaleLinear().domain([2024, 2030]).range([pad.l, w - pad.r]);
  const y = scaleLinear().domain([0, Math.max(...all) * 1.08]).nice(4).range([height - pad.b, pad.t]);
  const d = (pts: { year: number; v: number }[]) => pts.map((p, i) => `${i ? "L" : "M"}${x(p.year)},${y(p.v)}`).join("");

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
            const r = e.currentTarget.getBoundingClientRect();
            const yr = Math.round(x.invert(e.clientX - r.left));
            setHover(yr >= 2024 && yr <= 2030 ? yr : null);
          }}
        >
          {y.ticks(4).map((v) => (
            <g key={v}>
              <line className="grid" x1={pad.l} x2={w - pad.r} y1={y(v)} y2={y(v)} />
              <text x={pad.l - 8} y={y(v) + 4} textAnchor="end">{v}</text>
            </g>
          ))}
          <text x={pad.l - 8} y={12} textAnchor="end">{unit}</text>
          {years.map((yr) => <text key={yr} x={x(yr)} y={height - 8} textAnchor="middle">{yr}</text>)}
          <line className="axis" x1={pad.l} x2={w - pad.r} y1={y(0)} y2={y(0)} />
          {band ? (
            <path
              d={`${band.points.map((p, i) => `${i ? "L" : "M"}${x(p.year)},${y(p.hi)}`).join("")}${[...band.points].reverse().map((p) => `L${x(p.year)},${y(p.lo)}`).join("")}Z`}
              fill={band.color}
              fillOpacity={0.16}
            />
          ) : null}
          {lines.map((l) => (
            <g key={l.key}>
              <path d={d(l.points)} fill="none" stroke={l.color} strokeWidth={2} />
              {l.points.map((p) => <circle key={p.year} cx={x(p.year)} cy={y(p.v)} r={3.5} fill={l.color} stroke="var(--surface)" strokeWidth={2} />)}
              <text x={x(l.points[l.points.length - 1].year) + 8} y={y(l.points[l.points.length - 1].v) + (marks?.length ? 16 : 4)} style={{ fill: "var(--ink-2)", fontWeight: 550 }}>{l.label}</text>
            </g>
          ))}
          {marks?.map((m) => (
            <g key={m.label}>
              {m.lo != null && m.hi != null ? <line x1={x(m.year)} x2={x(m.year)} y1={y(m.lo)} y2={y(m.hi)} stroke={m.color} strokeWidth={1.5} /> : null}
              {m.shape === "dot" ? (
                <circle cx={x(m.year)} cy={y(m.v)} r={5} fill={m.color} stroke="var(--surface)" strokeWidth={2} />
              ) : (
                <rect x={x(m.year) - 5} y={y(m.v) - 5} width={10} height={10} transform={`rotate(45 ${x(m.year)} ${y(m.v)})`} fill="var(--surface)" stroke={m.color} strokeWidth={2} />
              )}
              <text x={x(m.year) + 10} y={y(m.v) - 6} style={{ fill: "var(--ink-2)", fontWeight: 550 }}>{m.label}</text>
            </g>
          ))}
          {hover != null ? <line className="cross" x1={x(hover)} x2={x(hover)} y1={pad.t} y2={height - pad.b} /> : null}
        </svg>
      ) : (
        <div style={{ height }} />
      )}
      {hover != null && width > 0 ? (
        <div className="tip" style={{ left: Math.min(x(hover) + 12, w - 200), top: 10 }}>
          <div className="tip-date">{hover}</div>
          {band?.points.filter((p) => p.year === hover).map((p) => (
            <div className="tip-row" key="band"><i className="swatch" style={{ background: band.color, opacity: 0.4 }} /><span>Range</span><b>{p.lo}–{p.hi}</b></div>
          ))}
          {lines.map((l) => {
            const p = l.points.find((q) => q.year === hover);
            return p ? <div className="tip-row" key={l.key}><i className="swatch line" style={{ background: l.color }} /><span>{l.label}</span><b>{p.v} {unit}</b></div> : null;
          })}
          {marks?.filter((m) => m.year === hover).map((m) => (
            <div className="tip-row" key={m.label}><i className="swatch line" style={{ background: m.color }} /><span>{m.label}</span><b>{Math.round(m.v)} {unit}</b></div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function AdditionsChart() {
  const [ref, width] = useSize<HTMLDivElement>();
  const w = Math.max(260, width);
  const h = 240;
  const pad = { l: 40, r: 12, t: 14, b: 28 };
  const rows = [
    ...goldman.realizedAdditionsGw.map((r) => ({ ...r, kind: "Built" as const })),
    ...goldman.scheduledAdditionsGw.map((r) => ({ ...r, kind: "Scheduled" as const })),
  ];
  const x = scaleBand<number>().domain(rows.map((r) => r.year)).range([pad.l, w - pad.r]).padding(0.35);
  const y = scaleLinear().domain([0, 40]).nice(4).range([h - pad.b, pad.t]);
  return (
    <div className="chart" ref={ref}>
      {width > 0 ? (
        <svg width={w} height={h} role="img" aria-label="Data-center capacity built versus scheduled, gigawatts">
          {y.ticks(4).map((v) => (
            <g key={v}>
              <line className="grid" x1={pad.l} x2={w - pad.r} y1={y(v)} y2={y(v)} />
              <text x={pad.l - 8} y={y(v) + 4} textAnchor="end">{v}</text>
            </g>
          ))}
          {rows.map((r) => (
            <g key={r.year}>
              <rect x={x(r.year)} y={y(r.gw)} width={x.bandwidth()} height={y(0) - y(r.gw)} rx={4} fill="var(--s1)" fillOpacity={r.kind === "Built" ? 0.9 : 0.35} stroke="var(--s1)" strokeDasharray={r.kind === "Built" ? undefined : "4 3"} />
              <text x={(x(r.year) ?? 0) + x.bandwidth() / 2} y={y(r.gw) - 6} textAnchor="middle" style={{ fill: "var(--ink)", fontWeight: 600 }}>{r.gw} GW</text>
              <text x={(x(r.year) ?? 0) + x.bandwidth() / 2} y={h - 8} textAnchor="middle">{r.year} · {r.kind.toLowerCase()}</text>
            </g>
          ))}
          <line className="axis" x1={pad.l} x2={w - pad.r} y1={y(0)} y2={y(0)} />
        </svg>
      ) : (
        <div style={{ height: h }} />
      )}
    </div>
  );
}

/** OpenAI compute and revenue, each rebased to 2023. Same years, each line rebased to 1 in 2023. */
function ScaleChart() {
  const [ref, width] = useSize<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const w = Math.max(260, width);
  const h = 260;
  const pad = { l: 36, r: 88, t: 16, b: 28 };
  const baseC = openaiScale.points[0].computeGw;
  const baseR = openaiScale.points[0].arrBn;
  const lines: LineSeries[] = [
    { key: "compute", label: "Compute", color: "var(--s1)", points: openaiScale.points.map((p) => ({ year: p.year, v: p.computeGw / baseC })) },
    { key: "revenue", label: "Revenue", color: "var(--s2)", points: openaiScale.points.map((p) => ({ year: p.year, v: p.arrBn / baseR })) },
  ];
  const x = scaleLinear().domain([2023, 2025]).range([pad.l, w - pad.r]);
  const y = scaleLinear().domain([0, 12]).range([h - pad.b, pad.t]);
  const d = (pts: { year: number; v: number }[]) => pts.map((p, i) => `${i ? "L" : "M"}${x(p.year)},${y(p.v)}`).join("");

  return (
    <div className="chart" ref={ref}>
      {width > 0 ? (
        <svg
          width={w}
          height={h}
          role="img"
          aria-label="OpenAI compute and revenue, indexed to 2023"
          onPointerLeave={() => setHover(null)}
          onPointerMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const yr = Math.round(x.invert(e.clientX - r.left));
            setHover(yr >= 2023 && yr <= 2025 ? yr : null);
          }}
        >
          {y.ticks(4).map((v) => (
            <g key={v}>
              <line className="grid" x1={pad.l} x2={w - pad.r} y1={y(v)} y2={y(v)} />
              <text x={pad.l - 8} y={y(v) + 4} textAnchor="end">{v}×</text>
            </g>
          ))}
          {[2023, 2024, 2025].map((yr) => <text key={yr} x={x(yr)} y={h - 8} textAnchor="middle">{yr}</text>)}
          <line className="axis" x1={pad.l} x2={w - pad.r} y1={y(0)} y2={y(0)} />
          {lines.map((l) => (
            <g key={l.key}>
              <path d={d(l.points)} fill="none" stroke={l.color} strokeWidth={2} />
              {l.points.map((p) => <circle key={p.year} cx={x(p.year)} cy={y(p.v)} r={3.5} fill={l.color} stroke="var(--surface)" strokeWidth={2} />)}
              <text x={x(2025) + 8} y={y(l.points[l.points.length - 1].v) + 4} style={{ fill: "var(--ink-2)", fontWeight: 550 }}>{l.label}</text>
            </g>
          ))}
          {hover != null ? <line className="cross" x1={x(hover)} x2={x(hover)} y1={pad.t} y2={h - pad.b} /> : null}
        </svg>
      ) : (
        <div style={{ height: h }} />
      )}
      {hover != null && width > 0 ? (
        <div className="tip" style={{ left: Math.min(x(hover) + 12, w - 180), top: 8 }}>
          <div className="tip-date">{hover}</div>
          {lines.map((l) => {
            const p = l.points.find((q) => q.year === hover);
            const raw = openaiScale.points.find((q) => q.year === hover);
            const detail = l.key === "compute" ? `${raw?.computeGw} GW` : `$${raw?.arrBn}B`;
            return p ? <div className="tip-row" key={l.key}><i className="swatch line" style={{ background: l.color }} /><span>{l.label}</span><b>{p.v % 1 ? p.v.toFixed(1) : p.v}× · {detail}</b></div> : null;
          })}
        </div>
      ) : null}
    </div>
  );
}

const PILES: { id: Pile; label: string; color: string; hint: string }[] = [
  { id: "ready", label: "Already running", color: "var(--s3)", hint: "Power connected and running today, mostly bitcoin mining, with no AI tenant named yet." },
  { id: "claimed", label: "A tenant has a claim", color: "var(--s4)", hint: "An option, a right of first offer or exclusivity, short of a signed lease." },
  { id: "open", label: "No tenant yet", color: "var(--s1)", hint: "Development sites, letters of intent, and power still being built out." },
];

function PileList({ items, pile, href }: { items: InventoryItem[]; pile: Pile; href: (path: string) => string }) {
  const rows = items.filter((i) => i.pile === pile);
  const shown = rows.slice(0, 4);
  const meta = PILES.find((p) => p.id === pile)!;
  return (
    <div className="card card-pad">
      <div className="eyebrow" style={{ color: meta.color }}>{meta.label}</div>
      <ul>
        {shown.map((i) => (
          <li key={i.id}>
            <Link className="link" href={href(`/companies/${i.ticker}#site-${i.campus}`)}>{i.ticker} · {i.label}</Link>
            <span>{mw(i.itMw)}</span>
          </li>
        ))}
      </ul>
      {rows.length > shown.length ? <p className="note" style={{ marginTop: 10 }}>{rows.length - shown.length} more in this pile.</p> : null}
    </div>
  );
}

export function DemandView({ states, pins, mapSize }: { states: string[]; pins: Pin[]; mapSize: [number, number] }) {
  const href = useHref();
  const { scenario, showIren } = useScenario();
  const avg = twhAverage2030();
  const epri2024 = epriTwh[0].mid;
  const multiple = avg.average / epri2024;
  const group = showIren ? book : book.filter((c) => c.model !== "gpu-cloud");
  const signedIt = group.reduce((a, c) => a + signedMw(c, scenario), 0);
  const signedUtility = signedIt / scenario.conversion;
  const goldmanGrowth = goldman.demandGw[goldman.demandGw.length - 1].gw - goldman.demandGw[0].gw;
  const spGrowth = sp.gw[sp.gw.length - 1].gw - sp.gw[0].gw;
  const gap = goldmanBuildGap();
  const tenants = tenantRows(group, scenario);
  const tenantMax = Math.max(...tenants.map((t) => t.itMw), 1);
  const first = openRouter.points[0];
  const last = openRouter.points[openRouter.points.length - 1];
  const months = Math.round((Date.parse(last.weekOf) - Date.parse(first.weekOf)) / (30.44 * 86_400_000));
  const tokenMultiple = Math.round(last.trillion / first.trillion);
  const unsold = inventory(book, scenario);
  const pileMax = Math.max(...PILES.map((p) => pileTotal(unsold, p.id)), 1);
  const sellTickers = new Set(unsold.map((i) => i.ticker));
  const openPins = pins.filter((p) => p.open > 0 && sellTickers.has(p.ticker));
  const offMap = unsold.filter((i) => !i.plotted);
  const offMapNames = [...new Map(offMap.map((i) => [i.campus, i])).values()];

  return (
    <main className="wrap">
      <section className="hero">
        <h1>Requests for power are running ahead of the power that gets connected.</h1>
        <p className="lede">
          Central cases put US data-center electricity near {Math.round(avg.average)} TWh in 2030, about {multiple.toFixed(1)}× the {epri2024} TWh EPRI counts for 2024.
          PJM, Dominion and ERCOT are each holding a request list well beyond the 2030 plan.
          Signed critical IT {showIren ? "in this book" : "for the landlords"} covers about {Math.round((signedUtility / 1000 / spGrowth) * 100)}% of S&amp;P&apos;s growth from 2025 to 2030.
        </p>
      </section>

      <div className="stats" style={{ marginTop: 28 }}>
        <div className="stat"><span className="eyebrow">2030, average of central cases</span><strong>{Math.round(avg.average)} TWh</strong><small>{avg.left} and {avg.right}</small></div>
        <div className="stat"><span className="eyebrow">Against 2024</span><strong>{multiple.toFixed(1)}×</strong><small>EPRI counted {epri2024} TWh in 2024. The 2030 studies span {epriTwh.find((p) => p.year === 2030)!.low}–{lbnl2030.highTwh} TWh.</small></div>
        <div className="stat"><span className="eyebrow">PJM data-center peak growth</span><strong>{pjmLoad.dataCenterGw} GW</strong><small>Of {pjmLoad.peakGrowthGw} GW from {pjmLoad.from} to {pjmLoad.to}. The board says some may still go unmet.</small></div>
        <div className="stat"><span className="eyebrow">Signed, share of S&amp;P growth</span><strong>{Math.round((signedUtility / 1000 / spGrowth) * 100)}%</strong><small>{mw(signedIt)} critical IT, {mw(signedUtility)} once scaled to utility power. S&amp;P adds {Math.round(spGrowth)} GW from 2025 to 2030.</small></div>
      </div>

      <section className="section">
        <div className="section-head">
          <div>
            <h2>How large it gets</h2>
            <p>EPRI and LBNL count electricity. Goldman and S&amp;P count power. Each pair measures a different perimeter, so each gets its own chart.</p>
          </div>
        </div>
        <div className="two-col">
          <div className="card card-pad">
            <h2 style={{ fontSize: 18 }}>Electricity used by US data centers</h2>
            <p className="note" style={{ margin: "4px 0 14px" }}>EPRI&apos;s low-to-high band with its medium case, and LBNL&apos;s 2030 reference with its range.</p>
            <YearChart
              unit="TWh"
              label="US data-center electricity forecasts, terawatt-hours"
              band={{ color: "var(--s1)", points: epriTwh.map((p) => ({ year: p.year, lo: p.low, hi: p.high })) }}
              lines={[{ key: "epri", label: "EPRI medium", color: "var(--s1)", points: epriTwh.map((p) => ({ year: p.year, v: p.mid })) }]}
              marks={[
                { year: 2030, v: lbnl2030.referenceTwh, lo: lbnl2030.lowTwh, hi: lbnl2030.highTwh, color: "var(--s2)", label: "LBNL", shape: "dot" },
                { year: 2030, v: avg.average, color: "var(--ink)", label: "", shape: "diamond" },
              ]}
            />
            <div className="legend" style={{ marginTop: 10 }}>
              <span><i className="swatch" style={{ background: "var(--s1)", opacity: 0.35 }} />EPRI low to high</span>
              <span><i className="swatch line" style={{ background: "var(--s1)" }} />EPRI medium</span>
              <span><i className="swatch" style={{ background: "var(--s2)", borderRadius: 5 }} />LBNL reference and range</span>
              <span><i className="swatch" style={{ background: "transparent", border: "2px solid var(--ink)", transform: "rotate(45deg)", width: 8, height: 8 }} />Average, {Math.round(avg.average)} TWh</span>
            </div>
          </div>
          <div className="card card-pad">
            <h2 style={{ fontSize: 18 }}>Power demand in gigawatts</h2>
            <p className="note" style={{ margin: "4px 0 14px" }}>Goldman counts demand. S&amp;P counts utility power to a wider set of sites, including crypto mining.</p>
            <YearChart
              unit="GW"
              label="US data-center power demand forecasts, gigawatts"
              lines={[
                { key: "gs", label: "Goldman", color: "var(--s1)", points: goldman.demandGw.map((p) => ({ year: p.year, v: p.gw })) },
                { key: "sp", label: "S&P", color: "var(--s2)", points: sp.gw.map((p) => ({ year: p.year, v: p.gw })) },
              ]}
            />
            <div className="legend" style={{ marginTop: 10 }}>
              <span><i className="swatch line" style={{ background: "var(--s1)" }} />Goldman Sachs</span>
              <span><i className="swatch line" style={{ background: "var(--s2)" }} />451 Research / S&amp;P</span>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <h2>Two clocks</h2>
            <p>Goldman is the next two years of construction. The grids are the 2030 plans, set next to the requests in their queues. A request is a customer asking to connect, and many never do.</p>
          </div>
        </div>
        <div className="stats">
          <div className="stat">
            <span className="eyebrow">PJM · data-center peak growth</span>
            <strong>{pjmLoad.dataCenterGw} GW</strong>
            <small>From {pjmLoad.from} to {pjmLoad.to}, inside {pjmLoad.peakGrowthGw} GW of total peak growth. October 2025. The board says some of it may still go unmet. No single shortfall number.</small>
          </div>
          <div className="stat">
            <span className="eyebrow">Dominion · requests in the queue</span>
            <strong>{dominionQueue.requestsGw} GW</strong>
            <small>February 2026. The September 2026 forecast puts {dominionPlan.capacity2030Gw} GW of contract capacity in 2030, and {dominionPlan.demand2030Gw} GW of demand, because new contracts take about five years to fill. About {dominionQueue.datedThrough2031Gw} GW of the queue has a date through 2031. System peak was {dominionQueue.peakGw} GW.</small>
          </div>
          <div className="stat">
            <span className="eyebrow">ERCOT · requests being watched</span>
            <strong>{ercotQueue.requestsGw} GW</strong>
            <small>December 2025, up from {ercotQueue.requestsPriorGw} GW a year earlier. Planners put about {ercotQueue.newDemand2030Gw} GW of new demand in the 2030 forecast. Much of the queue is duplicate or speculative.</small>
          </div>
        </div>
        <div className="two-col" style={{ marginTop: 14 }}>
          <div className="card card-pad">
            <h2 style={{ fontSize: 18 }}>Built against the schedule</h2>
            <p className="note" style={{ margin: "4px 0 14px" }}>
              Solid bars are capacity Goldman says was built. Dashed bars are what is scheduled. The jump in 2027 is the year this gap either closes or shows up.
            </p>
            <AdditionsChart />
          </div>
          <div className="card card-pad">
            <h2 style={{ fontSize: 18 }}>The near clock, in Goldman&apos;s own numbers</h2>
            <div className="stats" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 14 }}>
              <div className="stat"><span className="eyebrow">Scheduled, 2026–27</span><strong>{gap.scheduled} GW</strong><small>{goldman.scheduledAdditionsGw.map((r) => `${r.gw} in ${r.year}`).join(", ")}</small></div>
              <div className="stat"><span className="eyebrow">Built, 2024–25</span><strong>{gap.built} GW</strong><small>{goldman.realizedAdditionsGw.map((r) => `${r.gw} in ${r.year}`).join(", ")}</small></div>
              <div className="stat"><span className="eyebrow">Schedule minus those two years</span><strong>{gap.gap.toFixed(1)} GW</strong><small>Arithmetic on Goldman. Not a second forecast.</small></div>
              <div className="stat"><span className="eyebrow">Demand growth, 2025–27</span><strong>{gap.demandGrowth} GW</strong><small>{goldman.demandGw[0].gw} GW to {goldman.demandGw[goldman.demandGw.length - 1].gw} GW. This series stops in 2027.</small></div>
            </div>
            <p className="note" style={{ marginTop: 14 }}>
              A build pace that stays at {gap.built} GW leaves the {gap.demandGrowth} GW of new demand uncovered. Goldman&apos;s own path to about {goldman.capacityEnd2027Gw} GW of capacity by the end of 2027 assumes {goldman.utilization * 100}% utilization.
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <h2>What this book can sell</h2>
            <p>
              Signed critical IT {showIren ? "in the book" : "for the landlords"} is {mw(signedIt)}, about {Math.round((signedUtility / 1000 / goldmanGrowth) * 100)}% of Goldman&apos;s 2025–27 demand growth and {Math.round((signedUtility / 1000 / spGrowth) * 100)}% of S&amp;P&apos;s 2025–30 growth, after scaling to utility power at your conversion of {scenario.conversion.toFixed(2)}.
              The bars are the unsold landlord book, in the same critical-IT terms. IREN sells compute, so it stays out of the piles.
            </p>
          </div>
        </div>
        <div className="card card-pad">
          <div className="bars">
            {PILES.map((p) => {
              const total = pileTotal(unsold, p.id);
              return (
                <div className="bar-row tenant-row" key={p.id}>
                  <span>
                    <b style={{ fontWeight: 600 }}>{p.label}</b>
                    <small style={{ display: "block", color: "var(--muted)", fontSize: 12 }}>{p.hint}</small>
                  </span>
                  <div className="track"><div className="fill" style={{ width: `${(total / pileMax) * 100}%`, background: p.color }} /></div>
                  <b>{mw(total)}</b>
                </div>
              );
            })}
          </div>
        </div>
        <div className="pile-grid">
          {PILES.map((p) => <PileList key={p.id} items={unsold} pile={p.id} href={href} />)}
        </div>

        <div className="card" style={{ marginTop: 14 }}>
          <UsMap states={states} pins={openPins} width={mapSize[0]} height={mapSize[1]} tickers={[...new Set(openPins.map((p) => p.ticker))]} />
        </div>
        {offMapNames.length ? (
          <p className="note" style={{ marginTop: 10 }}>
            Off this map until the company names a town: {offMapNames.map((i) => `${i.label} (${i.place})`).join(" · ")}.
          </p>
        ) : null}
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <h2>Why the forecasts keep rising</h2>
            <p>Usage sits behind the power story. OpenAI published compute and revenue for the same three years, so those two can share a chart. The other reads use different units, so they sit underneath.</p>
          </div>
        </div>
        <div className="card card-pad">
          <h2 style={{ fontSize: 18 }}>OpenAI, indexed to 2023</h2>
          <p className="note" style={{ margin: "4px 0 8px" }}>{openaiScale.note} Both lines are a multiple of the 2023 figure. Compute ends near 9.5×. Revenue ends at 10×.</p>
          <ScaleChart />
          <div className="legend" style={{ marginTop: 8 }}>
            <span><i className="swatch line" style={{ background: "var(--s1)" }} />Compute, 0.2 GW to 1.9 GW</span>
            <span><i className="swatch line" style={{ background: "var(--s2)" }} />Annualized revenue, $2B to $20B+</span>
          </div>
          <div className="fact-row">
            <div>
              <div className="eyebrow">Weekly tokens</div>
              <b style={{ fontSize: 22 }}>{tokenMultiple}×</b>
              <p className="note">OpenRouter, {first.trillion}T in the week of {isoToLabel(first.weekOf)} to {last.trillion}T in the week of {isoToLabel(last.weekOf)}, {months} months. Rankings for the week of {isoToLabel(openRouterRankings.weekOf)} read {openRouterRankings.trillion}T.</p>
            </div>
            <div>
              <div className="eyebrow">NVIDIA data center</div>
              <b style={{ fontSize: 22 }}>+{Math.round(nvidiaDc.yoy * 100)}%</b>
              <p className="note">${nvidiaDc.revenueBn}B in the quarter ended {isoToLabel(nvidiaDc.quarterEnded)}. Global chip sales, a lead indicator for power.</p>
            </div>
            <div>
              <div className="eyebrow">Azure</div>
              <b style={{ fontSize: 22 }}>+{Math.round(azureGrowth.yoy * 100)}%</b>
              <p className="note">Quarter ended {isoToLabel(azureGrowth.quarterEnded)}. Cloud revenue growth, a lead indicator for power.</p>
            </div>
          </div>
          <p className="note" style={{ marginTop: 14 }}>
            BCG puts Amazon, Meta, Microsoft and Google at {Math.round(bcgShare.from * 100)}% of global data-center power, rising toward {Math.round(bcgShare.to * 100)}% by {bcgShare.year}. That share covers the four together, and the AI labs sit inside it as their customers.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <h2>Where the signed megawatts went</h2>
            <p>Signed critical IT in this book, by the tenant the company named. This is the slice each tenant has contracted with these landlords, a small part of its global build. A large block goes to an investment-grade tenant the filing leaves unnamed.</p>
          </div>
        </div>
        <div className="card card-pad">
          <div className="bars">
            {tenants.map((t) => (
              <div className="bar-row tenant-row" key={t.name}>
                <span>
                  <b style={{ fontWeight: 600 }}>{t.name}</b>
                  <small style={{ display: "block", color: "var(--muted)", fontSize: 12 }}>{t.kind} · {t.tickers.join(", ")}</small>
                </span>
                <div className="track"><div className="fill" style={{ width: `${(t.itMw / tenantMax) * 100}%`, background: "var(--s1)" }} /></div>
                <b>{mw(t.itMw)}</b>
              </div>
            ))}
          </div>
          <p className="note" style={{ marginTop: 14 }}>Fluidstack includes the Lake Mariner lease shared with Core42. Microsoft is IREN&apos;s contracted book, which the company describes as Microsoft and others. Meta is the guarantor of the Sandersville lease. CoreWeave, Fluidstack and Anthropic are neoclouds and labs, shown here because they are who signed, often with a hyperscaler behind the credit.</p>
        </div>
      </section>

      <section className="section">
        <div className="section-head"><div><h2>The studies</h2></div></div>
        <div className="card card-pad sources">
          <a href={epriSource.url} target="_blank" rel="noreferrer"><span>{epriSource.title}. {epriSource.note}</span><span className="muted">TWh</span></a>
          <a href={lbnl2030.url} target="_blank" rel="noreferrer"><span>{lbnl2030.title}. 2030 reference {lbnl2030.referenceTwh} TWh, range {lbnl2030.lowTwh}–{lbnl2030.highTwh} TWh.</span><span className="muted">TWh</span></a>
          <a href={goldman.url} target="_blank" rel="noreferrer"><span>{goldman.title}. Capacity near {goldman.capacityEnd2027Gw} GW by the end of 2027 at {goldman.utilization * 100}% utilization.</span><span className="muted">GW</span></a>
          <a href={sp.url} target="_blank" rel="noreferrer"><span>{sp.title}. {sp.note}</span><span className="muted">GW</span></a>
          <a href={pjmLoad.url} target="_blank" rel="noreferrer"><span>{pjmLoad.title}. {pjmLoad.note}</span><span className="muted">Grid</span></a>
          <a href={dominionPlan.url} target="_blank" rel="noreferrer"><span>{dominionPlan.title}. {dominionPlan.note}</span><span className="muted">Grid</span></a>
          <a href={dominionQueue.url} target="_blank" rel="noreferrer"><span>{dominionQueue.title}. {dominionQueue.note}</span><span className="muted">Grid</span></a>
          <a href={ercotQueue.url} target="_blank" rel="noreferrer"><span>{ercotQueue.title}. {ercotQueue.note}</span><span className="muted">Grid</span></a>
          <a href={openaiScale.url} target="_blank" rel="noreferrer"><span>{openaiScale.title}. {openaiScale.note}</span><span className="muted">Usage</span></a>
          <a href={openRouter.url} target="_blank" rel="noreferrer"><span>{openRouter.title}. {openRouter.note}</span><span className="muted">Tokens</span></a>
          <a href={openRouterRankings.url} target="_blank" rel="noreferrer"><span>{openRouterRankings.title}. {openRouterRankings.note}</span><span className="muted">Tokens</span></a>
          <a href={nvidiaDc.url} target="_blank" rel="noreferrer"><span>{nvidiaDc.title}. {nvidiaDc.note}</span><span className="muted">Chips</span></a>
          <a href={azureGrowth.url} target="_blank" rel="noreferrer"><span>{azureGrowth.title}. {azureGrowth.note}</span><span className="muted">Cloud</span></a>
          <a href={bcgShare.url} target="_blank" rel="noreferrer"><span>{bcgShare.title}. {bcgShare.note}</span><span className="muted">Share</span></a>
        </div>
      </section>
    </main>
  );
}
