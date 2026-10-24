"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { book, watchlist } from "@/data/ledger";
import type { Company, MarketBook, Tier } from "@/data/types";
import { backlog, blocks, liveMw, series, signedMw, sumTiers, tierMw, TODAY, valuation, type Point, type Valuation } from "@/lib/forecast";
import { TIERS, tierLabel } from "@/lib/scenario";
import { companyVar, tierVar } from "@/lib/palette";
import { mw, mwTick, px, usdCompact, usdTick } from "@/lib/format";
import { quoteFor } from "@/lib/quotes";
import { useHref, useScenario } from "@/components/ScenarioProvider";
import { Delta, Segmented, Tweened } from "@/components/ui";
import { PresetPicker, TierToggles } from "@/components/ScenarioControls";
import { StackedArea } from "@/components/charts/StackedArea";
import { Sparkline } from "@/components/charts/Sparkline";
import { UsMap, type Pin } from "@/components/charts/UsMap";

interface Row {
  company: Company;
  points: Point[];
  value: Valuation;
  signed: number;
  live: number;
  tiers: Record<Tier, number>;
  cap: number | null;
}

type SortKey = "ticker" | "cap" | "signed" | "perMw" | "revenue" | "implied" | "upside";

export function BoardView({ market, states, pins, mapSize }: { market: MarketBook; states: string[]; pins: Pin[]; mapSize: [number, number] }) {
  const { scenario, set } = useScenario();
  const href = useHref();
  const router = useRouter();
  const [metric, setMetric] = useState<"mw" | "revenue">("mw");
  const [highlight, setHighlight] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "upside", dir: -1 });

  const rows: Row[] = useMemo(
    () =>
      book.map((company) => {
        const quote = quoteFor(market, company.ticker);
        const list = blocks(company, scenario);
        return {
          company,
          points: series(list, scenario),
          value: valuation(list, scenario, quote),
          signed: signedMw(company, scenario),
          live: liveMw(company, scenario),
          tiers: tierMw(company, scenario),
          cap: quote?.marketCap ?? null,
        };
      }),
    [market, scenario],
  );

  const times = rows[0]?.points.map((p) => p.t) ?? [];
  const pick = (p: Point) => (metric === "mw" ? sumTiers(p.mw) : sumTiers(p.revenue));
  const layers = rows.map((r) => ({ key: r.company.ticker, label: r.company.ticker, color: companyVar(r.company.ticker), values: r.points.map(pick) }));
  const ceiling = times.map((_, i) => rows.reduce((a, r) => a + (metric === "mw" ? r.points[i].mwAll : r.points[i].revenueAll), 0));

  const totalSigned = rows.reduce((a, r) => a + r.signed, 0);
  const totalLive = rows.reduce((a, r) => a + r.live, 0);
  const totalBacklog = book.reduce((a, c) => a + backlog(c), 0);
  const totalCap = rows.reduce((a, r) => a + (r.cap ?? 0), 0);
  const targetRevenue = rows.reduce((a, r) => a + sumTiers(r.value.target.revenue), 0);
  const allRamps = book.flatMap((c) => c.ramps);
  const openMw = rows.reduce((a, r) => a + r.tiers.announced + r.tiers.pipeline, 0);

  const sorted = [...rows].sort((a, b) => {
    const v = (r: Row): number | string => {
      switch (sort.key) {
        case "ticker": return r.company.ticker;
        case "cap": return r.cap ?? -1;
        case "signed": return r.signed;
        case "perMw": return r.cap && r.signed ? r.cap / r.signed : Infinity;
        case "revenue": return sumTiers(r.value.target.revenue);
        case "implied": return r.value.price ?? -Infinity;
        case "upside": return r.value.upside ?? -Infinity;
      }
    };
    const av = v(a);
    const bv = v(b);
    return (av < bv ? -1 : av > bv ? 1 : 0) * sort.dir;
  });
  const perMwRows = rows.filter((r) => r.cap && r.signed).map((r) => ({ t: r.company.ticker, v: r.cap! / r.signed })).sort((a, b) => a.v - b.v);
  const perMwMax = Math.max(...perMwRows.map((r) => r.v), 1);

  const th = (key: SortKey, label: string, right = true) => (
    <th className={right ? "r" : ""} aria-sort={sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button type="button" onClick={() => setSort({ key, dir: sort.key === key ? (sort.dir === 1 ? -1 : 1) : -1 })}>
        {label}
        {sort.key === key ? <span aria-hidden="true">{sort.dir === 1 ? "↑" : "↓"}</span> : null}
      </button>
    </th>
  );

  return (
    <main className="wrap">
      <section className="hero">
        <h1>
          <em>{mw(totalSigned)}</em> of AI capacity signed across eight former bitcoin miners.
        </h1>
        <p className="lede">
          Every campus, lease and build cost, with a forecast you can change. Switch sites in or out, set the lease rate and multiple, and every valuation updates.
        </p>
      </section>

      <div className="stats" style={{ marginTop: 28 }}>
        <div className="stat"><span className="eyebrow">Signed critical IT</span><strong><Tweened value={totalSigned} format={(v) => mw(v)} /></strong><small>In service plus contracted</small></div>
        <div className="stat"><span className="eyebrow">In service today</span><strong>{mw(totalLive)}</strong><small>{Math.round((totalLive / Math.max(1, totalSigned)) * 100)}% of signed</small></div>
        <div className="stat"><span className="eyebrow">Revenue run-rate, end {scenario.year}</span><strong><Tweened value={targetRevenue} format={usdCompact} /></strong><small>Capacity switched on</small></div>
        <div className="stat"><span className="eyebrow">Contract value on record</span><strong>{usdCompact(totalBacklog)}</strong><small>Base terms, before renewals</small></div>
        <div className="stat"><span className="eyebrow">Combined market cap</span><strong>{usdCompact(totalCap)}</strong><small>{mw(openMw)} of power still open</small></div>
      </div>

      <section className="section" style={{ paddingTop: 28 }}>
        <div className="card">
          <div className="toolbar">
            <TierToggles ramps={allRamps} />
            <span className="grow" />
            <Segmented label="Measure" value={metric} onChange={setMetric} options={[{ value: "mw", label: "Capacity" }, { value: "revenue", label: "Revenue" }]} />
            <PresetPicker />
          </div>
          <div style={{ padding: "18px 16px 12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
              <div>
                <h2 style={{ fontSize: 18 }}>{metric === "mw" ? "Critical IT online, by company" : "Annual revenue run-rate, by company"}</h2>
                <p className="note" style={{ marginTop: 2 }}>Each company&apos;s ramp stacked on the dates it gave. The dotted line adds every announced and pipeline site.</p>
              </div>
              <div className="legend">
                {rows.map((r) => (
                  <button
                    key={r.company.ticker}
                    type="button"
                    onPointerEnter={() => setHighlight(r.company.ticker)}
                    onPointerLeave={() => setHighlight(null)}
                    onFocus={() => setHighlight(r.company.ticker)}
                    onBlur={() => setHighlight(null)}
                    onClick={() => router.push(href(`/companies/${r.company.ticker}`))}
                  >
                    <i className="swatch" style={{ background: companyVar(r.company.ticker) }} />
                    {r.company.ticker}
                  </button>
                ))}
              </div>
            </div>
            <StackedArea
              times={times}
              layers={layers}
              height={340}
              format={metric === "mw" ? (v) => mw(v) : (v) => (v ? usdCompact(v) : "$0")}
              tick={metric === "mw" ? mwTick : usdTick}
              ceiling={ceiling}
              ceilingLabel="Everything switched on"
              today={Date.parse(TODAY)}
              label="Stacked capacity or revenue by company through 2030"
              highlight={highlight}
            />
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <h2>The companies</h2>
            <p>Implied price is the end-{scenario.year} run-rate at {scenario.multiple}× {scenario.basis === "pe" ? "earnings" : "EBITDA"}, discounted to today. Open a company for the site-by-site breakdown.</p>
          </div>
        </div>
        <div className="grid-cards">
          {rows.map((r) => <ProviderCard key={r.company.ticker} row={r} market={market} href={href(`/companies/${r.company.ticker}`)} year={scenario.year} />)}
        </div>
        <div style={{ marginTop: 18 }} className="note">
          Watchlist, waiting on a filing read:{" "}
          {watchlist.map((c, i) => (
            <span key={c.ticker}>{i ? ", " : ""}<Link className="link" href={href(`/companies/${c.ticker}`)}>{c.name}</Link></span>
          ))}
          .
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <h2>Relative value</h2>
            <p>What the market pays for each signed megawatt today, and what your scenario says each share is worth.</p>
          </div>
          <Segmented label="Valuation year" value={scenario.year} onChange={(y) => set({ year: y })} options={[2026, 2027, 2028, 2029, 2030].map((y) => ({ value: y, label: String(y) }))} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.7fr) minmax(0, 1fr)", gap: 14 }} className="rv-grid">
          <div className="card table-wrap">
            <table className="data">
              <thead>
                <tr>
                  {th("ticker", "Company", false)}
                  {th("cap", "Market cap")}
                  {th("signed", "Signed IT")}
                  {th("perMw", "Cap per MW")}
                  {th("revenue", `Run-rate ${scenario.year}`)}
                  {th("implied", "Implied")}
                  {th("upside", "vs last")}
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => {
                  const q = quoteFor(market, r.company.ticker);
                  return (
                    <tr key={r.company.ticker} className="click" onClick={() => router.push(href(`/companies/${r.company.ticker}`))}>
                      <td>
                        <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                          <i className="dot" style={{ background: companyVar(r.company.ticker) }} />
                          <b>{r.company.ticker}</b>
                        </span>
                        <small>{px(q?.price ?? null)}</small>
                      </td>
                      <td className="r">{r.cap ? usdCompact(r.cap) : "—"}</td>
                      <td className="r">{r.signed ? mw(r.signed) : "—"}</td>
                      <td className="r">{r.cap && r.signed ? usdCompact(r.cap / r.signed) : "—"}</td>
                      <td className="r">{usdCompact(sumTiers(r.value.target.revenue))}</td>
                      <td className="r"><b>{r.value.price != null && r.value.price > 0 ? px(r.value.price) : "—"}</b></td>
                      <td className="r">{r.value.price != null && r.value.price > 0 ? <Delta value={(r.value.upside ?? 0) * 100} digits={0} /> : <span className="muted">no HPC</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="card card-pad">
            <h3 style={{ fontSize: 15 }}>Market cap per signed megawatt</h3>
            <p className="note" style={{ margin: "4px 0 16px" }}>Lower means the market pays less for each megawatt under contract.</p>
            <div className="bars">
              {perMwRows.map((r) => (
                <div className="bar-row" key={r.t}>
                  <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><i className="dot" style={{ background: companyVar(r.t) }} />{r.t}</span>
                  <div className="track"><div className="fill" style={{ width: `${(r.v / perMwMax) * 100}%`, background: companyVar(r.t) }} /></div>
                  <b>{usdCompact(r.v)}</b>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <h2>Where the power is</h2>
            <p>Every US campus with a known location. Texas carries most of it, with Kentucky, New York, Louisiana and North Dakota close behind.</p>
          </div>
        </div>
        <div className="card" style={{ overflow: "hidden" }}>
          <UsMap states={states} pins={pins} width={mapSize[0]} height={mapSize[1]} tickers={book.map((c) => c.ticker)} />
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <h2>The demand behind it</h2>
            <p>Forecasts put US data-center electricity at 2–4.5× its 2024 level by 2030. <Link className="link" href={href("/demand")}>See every study side by side</Link>.</p>
          </div>
        </div>
      </section>
      <style>{`@media (max-width: 1000px) { .rv-grid { grid-template-columns: 1fr !important; } }`}</style>
    </main>
  );
}

function ProviderCard({ row, market, href, year }: { row: Row; market: MarketBook; href: string; year: number }) {
  const { company, value, tiers } = row;
  const q = quoteFor(market, company.ticker);
  const total = TIERS.reduce((a, t) => a + tiers[t], 0);
  const color = companyVar(company.ticker);
  return (
    <Link href={href} className="card pcard">
      <div className="pcard-top">
        <div className="pcard-id">
          <i className="dot" style={{ background: color, width: 10, height: 10 }} />
          <div>
            <b>{company.ticker}</b>
            <span>{company.name}</span>
          </div>
        </div>
        <div className="pcard-px">
          <b>{px(q?.price ?? null)}</b>
          <Delta value={q?.changePercent ?? null} />
        </div>
      </div>
      <Sparkline data={q?.history ?? []} color={color} />
      <div>
        <div className="tierbar" aria-hidden="true">
          {TIERS.map((t) => (tiers[t] > 0 ? <i key={t} style={{ width: `${(tiers[t] / total) * 100}%`, background: tierVar(t) }} /> : null))}
        </div>
        <div className="tierbar-legend">
          {TIERS.filter((t) => tiers[t] > 0).map((t) => (
            <span key={t}><i className="swatch" style={{ background: tierVar(t), width: 8, height: 8 }} /><b>{mw(tiers[t])}</b> {tierLabel[t].toLowerCase()}</span>
          ))}
        </div>
      </div>
      <div className="pcard-foot">
        <div>
          <span className="eyebrow">Implied today</span>
          <b>{value.price != null && value.price > 0 ? px(value.price) : "—"}</b>{" "}
          {value.price != null && value.price > 0 ? <Delta value={(value.upside ?? 0) * 100} digits={0} /> : null}
        </div>
        <div>
          <span className="eyebrow">Run-rate, end {year}</span>
          <b>{usdCompact(sumTiers(value.target.revenue))}</b>
        </div>
      </div>
    </Link>
  );
}
