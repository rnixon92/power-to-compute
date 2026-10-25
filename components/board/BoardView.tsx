"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { book, watchlist } from "@/data/ledger";
import type { Company, MarketBook, Tier } from "@/data/types";
import { backlog, blocks, ctxFor, liveMw, marketMultiple, series, signedMw, sumTiers, tierMw, TODAY, valuation, type Point, type Valuation } from "@/lib/forecast";
import { appliedBasis, methodLine, TIERS, tierLabel } from "@/lib/scenario";
import { companyVar, hasSlot, tierVar } from "@/lib/palette";
import { implied, mw, mwTick, px, UNDER_ZERO, usdCompact, usdTick } from "@/lib/format";
import { quoteFor } from "@/lib/quotes";
import { useHref, useScenario } from "@/components/ScenarioProvider";
import { Delta, Segmented, Tweened } from "@/components/ui";
import { StackedArea } from "@/components/charts/StackedArea";
import { EventList } from "@/components/EventList";
import { allEvents } from "@/lib/events";
import { Sparkline } from "@/components/charts/Sparkline";
import { UsMap, type Pin } from "@/components/charts/UsMap";
import { BuildCalendar } from "@/components/BuildCalendar";
import { calendar } from "@/lib/calendar";

interface Row {
  company: Company;
  points: Point[];
  value: Valuation;
  signed: number;
  live: number;
  tiers: Record<Tier, number>;
  cap: number | null;
  multiple: number | null;
}

type SortKey = "ticker" | "cap" | "signed" | "perMw" | "revenue" | "implied" | "upside" | "multiple";

export function BoardView({ market, states, pins, mapSize }: { market: MarketBook; states: string[]; pins: Pin[]; mapSize: [number, number] }) {
  const { scenario, set, openPanel, showIren, setShowIren } = useScenario();
  const href = useHref();
  const router = useRouter();
  const [metric, setMetric] = useState<"mw" | "revenue">("mw");
  const [highlight, setHighlight] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "upside", dir: -1 });

  const rows: Row[] = useMemo(
    () =>
      book.map((company) => {
        const ctx = ctxFor(market, company.ticker);
        const quote = ctx.quote;
        const list = blocks(company, scenario);
        const value = valuation(company, list, scenario, ctx);
        return {
          company,
          points: series(list, scenario),
          value,
          multiple: marketMultiple(company, value, scenario, ctx),
          signed: signedMw(company, scenario),
          live: liveMw(company, scenario),
          tiers: tierMw(company, scenario),
          cap: quote?.marketCap ?? null,
        };
      }),
    [market, scenario],
  );

  const shown = showIren ? rows : rows.filter((r) => r.company.model !== "gpu-cloud");
  const gpuRow = rows.find((r) => r.company.model === "gpu-cloud");
  const times = shown[0]?.points.map((p) => p.t) ?? [];
  const pick = (p: Point) => (metric === "mw" ? sumTiers(p.mw) : sumTiers(p.revenue));
  const slotted = shown.filter((r) => hasSlot(r.company.ticker));
  const rest = shown.filter((r) => !hasSlot(r.company.ticker));
  // Name only the gray companies that put capacity on the chart under this scenario.
  const restDrawn = rest.filter((r) => r.points.some((p) => pick(p) > 0));
  const restLabel = (restDrawn.length ? restDrawn : rest).map((r) => r.company.ticker).join(", ");
  const layers = [
    ...slotted.map((r) => ({ key: r.company.ticker, label: r.company.ticker, color: companyVar(r.company.ticker), values: r.points.map(pick) })),
    ...(rest.length
      ? [{ key: "rest", label: restLabel, color: "var(--s-watch)", values: times.map((_, i) => rest.reduce((a, r) => a + pick(r.points[i]), 0)) }]
      : []),
  ];
  const ceiling = times.map((_, i) => shown.reduce((a, r) => a + (metric === "mw" ? r.points[i].mwAll : r.points[i].revenueAll), 0));

  const totalSigned = shown.reduce((a, r) => a + r.signed, 0);
  const totalLive = shown.reduce((a, r) => a + r.live, 0);
  const totalBacklog = shown.reduce((a, r) => a + backlog(r.company), 0);
  const totalCap = shown.reduce((a, r) => a + (r.cap ?? 0), 0);
  const targetRevenue = shown.reduce((a, r) => a + sumTiers(r.value.target.revenue), 0);
  const openMw = shown.reduce((a, r) => a + r.tiers.announced + r.tiers.pipeline, 0);
  const irenRate = `${(scenario.gpuReturn * 100).toFixed(1).replace(/\.0$/, "")}%`;
  const irenLine = !showIren ? null : scenario.gpuMethod === "dcf" ? <> IREN is valued on its GPU contracts at {irenRate}.</> : <> IREN is on {scenario.multiple}× earnings.</>;
  const irenMarket = !showIren ? null : scenario.gpuMethod === "dcf" ? ` For IREN it is the return on its GPU contracts, against your ${irenRate}.` : " IREN stays on an earnings multiple.";
  const shownCompanies = useMemo(() => shown.map((r) => r.company), [shown]);
  const soon = useMemo(() => calendar(shownCompanies, scenario).counts.slice(0, 2).reduce((a, n) => a + n, 0), [shownCompanies, scenario]);

  const sorted = [...shown].sort((a, b) => {
    const v = (r: Row): number | string => {
      switch (sort.key) {
        case "ticker": return r.company.ticker;
        case "cap": return r.cap ?? -1;
        case "signed": return r.signed;
        case "perMw": return r.cap && r.signed ? r.cap / r.signed : Infinity;
        case "revenue": return sumTiers(r.value.target.revenue);
        case "implied": return r.value.price ?? -Infinity;
        case "upside": return r.value.upside ?? -Infinity;
        case "multiple": return r.multiple ?? Infinity;
      }
    };
    const av = v(a);
    const bv = v(b);
    return (av < bv ? -1 : av > bv ? 1 : 0) * sort.dir;
  });
  const perMwRows = shown.filter((r) => r.cap && r.signed).map((r) => ({ t: r.company.ticker, v: r.cap! / r.signed })).sort((a, b) => a.v - b.v);
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
          <em>{mw(totalSigned)}</em> signed to AI.
        </h1>
        <p className="lede">
          Every campus, lease and build cost, with a forecast you can change. Switch sites in or out, set the lease rate and multiple, and every valuation updates.
        </p>
        <div style={{ marginTop: 16 }}>
          <Segmented
            label="IREN in the overview"
            value={showIren ? "on" : "off"}
            onChange={(v) => setShowIren(v === "on")}
            options={[{ value: "off", label: "Landlords only" }, { value: "on", label: "Include IREN" }]}
          />
        </div>
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
            <button type="button" className="btn" onClick={openPanel}>Assumptions</button>
            <span className="grow" />
            <Segmented label="Measure" value={metric} onChange={setMetric} options={[{ value: "mw", label: "Capacity" }, { value: "revenue", label: "Revenue" }]} />
          </div>
          <div style={{ padding: "18px 16px 12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
              <div>
                <h2 style={{ fontSize: 18 }}>{metric === "mw" ? "Critical IT online, by company" : "Annual revenue run-rate, by company"}</h2>
                <p className="note" style={{ marginTop: 2 }}>
                  {metric === "mw"
                    ? showIren
                      ? "Critical IT, stacked on the dates each company gave. Megawatts are comparable across landlords and IREN."
                      : "Critical IT for the landlords, stacked on the dates each company gave."
                    : showIren
                      ? "IREN's dollars are GPU-cloud revenue. Everyone else's are rent. The dotted line adds every site with no tenant yet and every future option."
                      : "Rent, not GPU-cloud revenue. The dotted line adds every site with no tenant yet and every future option."}
                </p>
              </div>
              <div className="legend">
                {slotted.map((r) => (
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
                {rest.length ? (
                  <button
                    type="button"
                    onPointerEnter={() => setHighlight("rest")}
                    onPointerLeave={() => setHighlight(null)}
                    onFocus={() => setHighlight("rest")}
                    onBlur={() => setHighlight(null)}
                  >
                    <i className="swatch" style={{ background: "var(--s-watch)" }} />
                    {restLabel}
                  </button>
                ) : null}
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
            <h2>Build calendar</h2>
            <p>{soon} go-lives in this quarter and next across the sites you have switched on. The shaded column is this quarter, and the dates move with the delay setting in Assumptions.</p>
          </div>
        </div>
        <BuildCalendar companies={shownCompanies} />
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <h2>The companies</h2>
            <p>{scenario.basis === "dcf"
              ? <>Landlords are valued on every month of rent over each lease&apos;s life, discounted at {(scenario.dcfRate * 100).toFixed(1).replace(/\.0$/, "")}%, plus the balance sheet.{irenLine}</>
              : scenario.basis === "cap"
              ? <>Landlords are each site&apos;s average NOI over its lease at a {(scenario.capRate * 100).toFixed(1)}% cap rate, less build cost, plus the balance sheet.{irenLine}</>
              : <>Implied price is the end-{scenario.year} run-rate at {scenario.multiple}× {scenario.basis === "pe" ? "earnings" : "EBITDA"}, discounted to today.{scenario.gpuMethod === "dcf" ? irenLine : null}</>} Open a company for the site-by-site breakdown.</p>
          </div>
        </div>
        {!showIren && gpuRow ? <GpuStrip row={gpuRow} market={market} href={href(`/companies/${gpuRow.company.ticker}`)} onInclude={() => setShowIren(true)} /> : null}
        <div className="grid-cards">
          {shown.map((r) => <ProviderCard key={r.company.ticker} row={r} market={market} href={href(`/companies/${r.company.ticker}`)} year={scenario.year} />)}
        </div>
        {watchlist.length ? (
          <div style={{ marginTop: 18 }} className="note">
            Watchlist, waiting on a filing read:{" "}
            {watchlist.map((c, i) => (
              <span key={c.ticker}>{i ? ", " : ""}<Link className="link" href={href(`/companies/${c.ticker}`)}>{c.name}</Link></span>
            ))}
            .
          </div>
        ) : null}
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <h2>Relative value</h2>
            <p>What the market pays for each signed megawatt, and what your scenario says each share is worth. {scenario.basis === "dcf"
              ? <>The last column is the annual return today&apos;s price implies on the leases. Your scenario asks for {(scenario.dcfRate * 100).toFixed(1).replace(/\.0$/, "")}%.{irenMarket}</>
              : scenario.basis === "cap"
              ? <>The last column is the cap rate today&apos;s price implies on stabilized NOI. Your scenario uses {(scenario.capRate * 100).toFixed(1)}%.{irenMarket}</>
              : <>The last column is the {scenario.basis === "pe" ? "earnings" : "EBITDA"} multiple today&apos;s price implies. Your scenario uses {scenario.multiple}×.{scenario.gpuMethod === "dcf" ? irenMarket : null}</>}{showIren ? " IREN is a GPU cloud, so its dollars per megawatt measure compute sales and sit apart from the leases." : null}</p>
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
                  {th("multiple", "Market pays")}
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
                          {r.company.model === "gpu-cloud" ? <span className="pill">GPU cloud</span> : null}
                        </span>
                        <small>{px(q?.price ?? null)}</small>
                      </td>
                      <td className="r">{r.cap ? usdCompact(r.cap) : "—"}</td>
                      <td className="r">{r.signed ? mw(r.signed) : "—"}</td>
                      <td className="r">{r.cap && r.signed ? usdCompact(r.cap / r.signed) : "—"}</td>
                      <td className="r">{usdCompact(sumTiers(r.value.target.revenue))}</td>
                      <td className="r"><b title={r.value.price != null && r.value.price <= 0 ? UNDER_ZERO : undefined}>{implied(r.value.price)}</b></td>
                      <td className="r">{r.value.price != null && r.value.price > 0 ? <Delta value={(r.value.upside ?? 0) * 100} digits={0} /> : <span className="muted" title="Debt, claims and build cost still to spend exceed the value in this scenario">below zero</span>}</td>
                      <td className="r">{formatMarket(r.multiple, appliedBasis(r.company.model, scenario))}</td>
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
          <UsMap states={states} pins={showIren ? pins : pins.filter((p) => p.ticker !== "IREN")} width={mapSize[0]} height={mapSize[1]} tickers={shown.map((r) => r.company.ticker)} />
          <p className="note" style={{ margin: "0 16px 14px" }}>A site appears here only when the company has named a US town. Anything still off the map is listed on the company page.</p>
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
      <section className="section">
        <div className="section-head">
          <div>
            <h2>What changed lately</h2>
            <p>Leases, financings, deliveries and power, newest first, with how each stock moved over the next five trading days.</p>
          </div>
        </div>
        <EventList events={allEvents(shown.map((r) => r.company))} market={market} limit={8} showTicker />
      </section>
      <style>{`@media (max-width: 1000px) { .rv-grid { grid-template-columns: 1fr !important; } }`}</style>
    </main>
  );
}

function formatMarket(multiple: number | null, basis: string): string {
  if (multiple == null) return "—";
  if (basis === "dcf") return `${(multiple * 100).toFixed(1)}% a year`;
  if (basis === "cap") return `${(multiple * 100).toFixed(1)}%`;
  return `${multiple.toFixed(1)}×`;
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
            <span>{company.model === "gpu-cloud" ? "GPU cloud" : company.name}</span>
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
          <b title={value.price != null && value.price <= 0 ? UNDER_ZERO : undefined}>{implied(value.price)}</b>{" "}
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

/** IREN sits outside the landlord overview by default. This keeps it one glance and one click away. */
function GpuStrip({ row, market, href, onInclude }: { row: Row; market: MarketBook; href: string; onInclude: () => void }) {
  const { scenario } = useScenario();
  const { company, value } = row;
  const q = quoteFor(market, company.ticker);
  const method = methodLine(company.model, scenario);
  return (
    <div className="card gpu-strip">
      <Link href={href} className="gpu-strip-main">
        <i className="dot" style={{ background: companyVar(company.ticker), width: 10, height: 10 }} />
        <div>
          <span className="eyebrow">GPU cloud, valued separately</span>
          <b>{company.ticker}</b> <span className="muted">{px(q?.price ?? null)}</span>
        </div>
        <div>
          <span className="eyebrow">Implied today</span>
          <b title={value.price != null && value.price <= 0 ? UNDER_ZERO : undefined}>{implied(value.price)}</b>{" "}
          {value.price != null && value.price > 0 ? <Delta value={(value.upside ?? 0) * 100} digits={0} /> : null}
        </div>
        <div className="gpu-strip-method">
          <span className="eyebrow">Valued on</span>
          <span>{method.label}, {mw(row.signed)} signed</span>
        </div>
      </Link>
      <button type="button" className="btn" onClick={onInclude}>Add to the overview</button>
    </div>
  );
}

