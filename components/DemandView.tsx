"use client";

import { useState } from "react";
import { scaleBand, scaleLinear } from "d3-scale";
import { book } from "@/data/ledger";
import { epriSource, epriTwh, goldman, goldmanBuildGap, lbnl2030, openRouter, openRouterRankings, sp, twhAverage2030 } from "@/data/studies";
import { signedMw } from "@/lib/forecast";
import { tenantRows } from "@/lib/tenants";
import { useScenario } from "@/components/ScenarioProvider";
import { useSize } from "@/components/ui";
import { mw } from "@/lib/format";

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
              <rect x={x(r.year)} y={y(r.gw)} width={x.bandwidth()} height={y(0) - y(r.gw)} rx={4} fill={r.kind === "Built" ? "var(--s1)" : "var(--s1)"} fillOpacity={r.kind === "Built" ? 0.9 : 0.35} stroke="var(--s1)" strokeDasharray={r.kind === "Built" ? undefined : "4 3"} />
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

export function DemandView() {
  const { scenario, showIren } = useScenario();
  const avg = twhAverage2030();
  const epri2030 = epriTwh.find((p) => p.year === 2030)!;
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

  return (
    <main className="wrap">
      <section className="hero">
        <h1>US data centers could use 2–4.5× their 2024 power by 2030.</h1>
        <p className="lede">
          The studies put 2030 between {epri2030.low} and {lbnl2030.highTwh} TWh, against {epriTwh[0].mid} TWh in 2024. The build schedule for the next two years is about {Math.round(gap.scheduled / gap.built)}× what the last two years actually delivered.
        </p>
      </section>

      <div className="stats" style={{ marginTop: 28 }}>
        <div className="stat"><span className="eyebrow">US data-center electricity, 2024</span><strong>{epriTwh[0].mid} TWh</strong><small>EPRI</small></div>
        <div className="stat"><span className="eyebrow">2030, average of central cases</span><strong>{Math.round(avg.average)} TWh</strong><small>{avg.left} and {avg.right}</small></div>
        <div className="stat"><span className="eyebrow">Share of US power in 2030</span><strong>{Math.round(lbnl2030.shareLow * 100)}–{Math.round(lbnl2030.shareHigh * 100)}%</strong><small>LBNL range</small></div>
        <div className="stat"><span className="eyebrow">Weekly AI tokens, OpenRouter</span><strong>{Math.round(last.trillion / first.trillion)}×</strong><small>in {months} months</small></div>
      </div>

      <section className="section">
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
            <h2>The shortfall</h2>
            <p>Goldman&apos;s path to about {goldman.capacityEnd2027Gw} GW of capacity by the end of 2027, enough for {goldman.demandGw[goldman.demandGw.length - 1].gw} GW of demand at {goldman.utilization * 100}% utilization, is the schedule below. The last two years did not build at that pace.</p>
          </div>
        </div>
        <div className="stats">
          <div className="stat"><span className="eyebrow">Scheduled, 2026–27</span><strong>{gap.scheduled} GW</strong><small>{goldman.scheduledAdditionsGw.map((r) => `${r.gw} in ${r.year}`).join(", ")}</small></div>
          <div className="stat"><span className="eyebrow">Actually built, 2024–25</span><strong>{gap.built} GW</strong><small>{goldman.realizedAdditionsGw.map((r) => `${r.gw} in ${r.year}`).join(", ")}</small></div>
          <div className="stat"><span className="eyebrow">Gap if the pace holds</span><strong>{gap.gap.toFixed(1)} GW</strong><small>Schedule minus the last two years</small></div>
          <div className="stat"><span className="eyebrow">Demand growth, 2025–27</span><strong>{gap.demandGrowth} GW</strong><small>Goldman, {goldman.demandGw[0].gw} GW to {goldman.demandGw[goldman.demandGw.length - 1].gw} GW</small></div>
        </div>
        <p className="note" style={{ marginTop: 12 }}>The {gap.gap.toFixed(1)} GW is not a second forecast. It is Goldman&apos;s own schedule minus what Goldman says was built in the previous two years. Demand over 2025–27 grows by {gap.demandGrowth} GW, so a build pace that stays at {gap.built} GW leaves the new demand uncovered.</p>
      </section>

      <section className="section">
        <div className="two-col">
          <div className="card card-pad">
            <h2 style={{ fontSize: 18 }}>Built against the schedule</h2>
            <p className="note" style={{ margin: "4px 0 14px" }}>
              Solid bars are capacity Goldman says was built. Dashed bars are what is scheduled. The jump in 2027 is the year the shortfall either closes or shows up.
            </p>
            <AdditionsChart />
          </div>
          <div className="card card-pad">
            <h2 style={{ fontSize: 18 }}>Where this group fits</h2>
            <p className="note" style={{ margin: "4px 0 16px" }}>Signed critical IT {showIren ? "in the book" : "for the landlords"}, scaled up to utility power at your conversion of {scenario.conversion.toFixed(2)} IT MW per gross MW.</p>
            <div className="stats" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <div className="stat"><span className="eyebrow">Signed critical IT</span><strong>{mw(signedIt)}</strong><small>≈ {mw(signedUtility)} of utility power</small></div>
              <div className="stat"><span className="eyebrow">Share of Goldman growth</span><strong>{Math.round((signedUtility / 1000 / goldmanGrowth) * 100)}%</strong><small>{goldmanGrowth} GW added 2025–27</small></div>
              <div className="stat"><span className="eyebrow">Share of S&amp;P growth</span><strong>{Math.round((signedUtility / 1000 / spGrowth) * 100)}%</strong><small>{Math.round(spGrowth)} GW added 2025–30</small></div>
              <div className="stat"><span className="eyebrow">Tokens, latest week</span><strong>{openRouterRankings.trillion}T</strong><small>OpenRouter rankings, week of {openRouterRankings.weekOf}</small></div>
            </div>
            <p className="note" style={{ marginTop: 14 }}>
              OpenRouter weekly tokens went from {first.trillion}T in the week of {first.weekOf} to {last.trillion}T in the week of {last.weekOf}. {openRouter.note}
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <h2>Who is signing</h2>
            <p>Signed critical IT in this book, by the tenant the company named. This is not Microsoft&apos;s or Amazon&apos;s whole global build. It is the slice they, and the neoclouds, have contracted with these landlords. A large block is an investment-grade tenant the filing does not name.</p>
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
          <a href={openRouter.url} target="_blank" rel="noreferrer"><span>{openRouter.title}. {openRouter.note}</span><span className="muted">Tokens</span></a>
          <a href={openRouterRankings.url} target="_blank" rel="noreferrer"><span>{openRouterRankings.title}. {openRouterRankings.note}</span><span className="muted">Tokens</span></a>
        </div>
      </section>
    </main>
  );
}
