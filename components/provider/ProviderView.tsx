"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { book } from "@/data/ledger";
import type { Company, MarketBook } from "@/data/types";
import { backlog, blocks as toBlocks, disclosedLeaseRate, liveMw, marketMultiple, priceByYear, pricePath, series, signedMw, sumTiers, TODAY, valuation, yearTable } from "@/lib/forecast";
import { companyVar } from "@/lib/palette";
import { isoToLabel, mw, px, usdCompact } from "@/lib/format";
import { quoteFor } from "@/lib/quotes";
import { useHref, useScenario } from "@/components/ScenarioProvider";
import { Delta, Tweened } from "@/components/ui";
import { TierToggles } from "@/components/ScenarioControls";
import { ForecastChart } from "@/components/charts/ForecastChart";
import { UsMap, type Pin } from "@/components/charts/UsMap";
import { Rail } from "@/components/provider/Rail";
import { Sites } from "@/components/provider/Sites";
import { Contracts, Financing, Sources, YearTable } from "@/components/provider/Sections";
import { Summary } from "@/components/provider/Summary";

const modelLabel = { "gpu-cloud": "GPU cloud", "colo-lease": "Data-center landlord", "power-owner": "Power portfolio" } as const;

const SECTIONS = [
  { id: "forecast", label: "Forecast" },
  { id: "sites", label: "Sites" },
  { id: "contracts", label: "Contracts" },
  { id: "financing", label: "Build and financing" },
  { id: "model", label: "Year by year" },
  { id: "sources", label: "Sources" },
];
const SECTION_IDS = SECTIONS.map((s) => s.id);

export function ProviderView({ company, market, states, pins, mapSize }: { company: Company; market: MarketBook; states: string[]; pins: Pin[]; mapSize: [number, number] }) {
  const { scenario } = useScenario();
  const href = useHref();
  const quote = quoteFor(market, company.ticker);
  const today = Date.parse(TODAY);
  const color = companyVar(company.ticker);
  const gpu = company.model === "gpu-cloud";

  const list = useMemo(() => toBlocks(company, scenario), [company, scenario]);
  const points = useMemo(() => series(list, scenario), [list, scenario]);
  const value = useMemo(() => valuation(list, scenario, quote), [list, scenario, quote]);
  const path = useMemo(() => pricePath(points, scenario, quote?.shares ?? null), [points, scenario, quote]);
  const rows = useMemo(() => yearTable(list, scenario, quote?.shares ?? null), [list, scenario, quote]);
  const leaseHint = useMemo(() => disclosedLeaseRate(book), []);
  const years = useMemo(() => priceByYear(company, scenario, quote), [company, scenario, quote]);
  const multiple = marketMultiple(value, scenario, quote);
  const active = useScrollSpy(SECTION_IDS);

  const signed = signedMw(company, scenario);
  const live = liveMw(company, scenario);
  const contractValue = backlog(company);
  const runNow = sumTiers(points.reduce((best, p) => (p.t <= today ? p : best), points[0]).revenue);
  const cap = quote?.marketCap ?? null;
  const range = quote?.week52Low != null && quote.week52High != null && quote.price != null
    ? Math.min(100, Math.max(0, ((quote.price - quote.week52Low) / Math.max(0.01, quote.week52High - quote.week52Low)) * 100))
    : null;

  return (
    <main>
      <div className="wrap">
        <header className="p-head">
          <div>
            <div className="p-title">
              <i className="dot" style={{ background: color, width: 14, height: 14 }} />
              <h1>{company.ticker}</h1>
              {company.name !== company.ticker ? <span className="name">{company.name}</span> : null}
              <span className="pill">{modelLabel[company.model]}</span>
              {!company.inBook ? <span className="pill est">Secondary source</span> : null}
            </div>
            <p className="p-summary">{company.summary}</p>
          </div>
          <div className="p-price">
            <strong className="tabular">{px(quote?.price ?? null)}</strong>
            <div className="sub">
              <Delta value={quote?.changePercent ?? null} />
              <span>{quote?.asOf ? `Close ${isoToLabel(quote.asOf)}` : "No quote yet"}</span>
            </div>
            {range != null ? (
              <div className="range52" aria-label="52-week range">
                <div className="track"><span className="mark" style={{ left: `${range}%` }} /></div>
                <div className="labels"><span>{px(quote!.week52Low)}</span><span>52-week range</span><span>{px(quote!.week52High)}</span></div>
              </div>
            ) : null}
          </div>
        </header>

        <div className="stats">
          <div className="stat"><span className="eyebrow">Signed critical IT</span><strong>{signed ? mw(signed) : "—"}</strong><small>{live ? `${mw(live)} in service` : "None in service yet"}</small></div>
          <div className="stat"><span className="eyebrow">Revenue run-rate today</span><strong>{usdCompact(runNow)}</strong><small>From AI capacity</small></div>
          <div className="stat"><span className="eyebrow">Run-rate, end {scenario.year}</span><strong><Tweened value={sumTiers(value.target.revenue)} format={usdCompact} /></strong><small>Capacity switched on</small></div>
          <div className="stat"><span className="eyebrow">Contract value on record</span><strong>{contractValue ? usdCompact(contractValue) : "—"}</strong><small>Base terms</small></div>
          <div className="stat"><span className="eyebrow">Market cap</span><strong>{cap ? usdCompact(cap) : "—"}</strong><small>{cap && signed ? `${usdCompact(cap / signed)} per signed MW` : quote?.streetMean ? `Street target ${px(quote.streetMean)}` : ""}</small></div>
        </div>
      </div>

      <nav className="subnav" aria-label="Sections">
        <div className="wrap subnav-row">
          {SECTIONS.map((s) => <a key={s.id} href={`#${s.id}`} className={active === s.id ? "on" : ""}>{s.label}</a>)}
        </div>
      </nav>

      <div className="wrap p-body">
        <div className="p-main">
          <section id="forecast">
            <Summary company={company} quote={quote} value={value} multiple={multiple} />
            <div className="card fc" style={{ marginTop: 14 }}>
              <div className="fc-head">
                <div>
                  <h2>Price, capacity and revenue on one timeline</h2>
                  <p className="note" style={{ marginTop: 2 }}>The dashed line is what the run-rate is worth each month under your scenario, before discounting.</p>
                </div>
              </div>
              <ForecastChart
                color={color}
                history={quote?.history ?? []}
                street={{ mean: quote?.streetMean ?? null, low: quote?.streetLow ?? null, high: quote?.streetHigh ?? null }}
                path={path}
                implied={value.price}
                points={points}
                today={today}
              />
            </div>
          </section>

          <section id="sites">
            <div className="section-head">
              <div>
                <h2>Sites</h2>
                <p>Each campus, phase by phase. Switch a phase off to take it out of the forecast, or on to test a lease the company hasn&apos;t signed yet.</p>
              </div>
            </div>
            <div className="card tier-bar-card">
              <span className="eyebrow" style={{ marginRight: 4 }}>Include</span>
              <TierToggles ramps={company.ramps} />
            </div>
            {pins.length > 1 ? (
              <div className="card" style={{ overflow: "hidden", marginBottom: 14 }}>
                <UsMap states={states} pins={pins} width={mapSize[0]} height={mapSize[1]} tickers={[company.ticker]} single />
              </div>
            ) : null}
            <Sites company={company} blocks={list} today={today} />
          </section>

          <section id="contracts">
            <div className="section-head"><div><h2>Contracts</h2><p>Every signed lease or cloud contract, with the rent per kilowatt it implies.</p></div></div>
            <Contracts company={company} blocks={list} />
          </section>

          <section id="financing">
            <div className="section-head"><div><h2>Build and financing</h2><p>What the company says it costs to build, and the debt raised against it.</p></div></div>
            <Financing company={company} blocks={list} />
          </section>

          <section id="model">
            <div className="section-head"><div><h2>Year by year</h2><p>Calendar-year results from the sites switched on, with the same assumptions as the panel.</p></div></div>
            <YearTable rows={rows} gpu={gpu} />
          </section>

          <section id="sources">
            <div className="section-head"><div><h2>Sources</h2><p>Every figure on this page traces to one of these.</p></div></div>
            <Sources company={company} />
            <p className="note" style={{ marginTop: 14 }}><Link className="link" href={href("/method")}>How the model works</Link></p>
          </section>
        </div>
        <Rail company={company} quote={quote} value={value} leaseHint={leaseHint} years={years} />
      </div>
    </main>
  );
}

function useScrollSpy(ids: string[]): string {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    const els = ids.map((id) => document.getElementById(id)).filter((e): e is HTMLElement => Boolean(e));
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-140px 0px -60% 0px" },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [ids]);
  return active;
}
