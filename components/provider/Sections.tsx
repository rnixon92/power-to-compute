"use client";

import type { CapitalItem, Company } from "@/data/types";
import type { Filing } from "@/lib/edgar";
import filingSnapshot from "@/data/snapshots/filings.json";
import { blocks, leaseRateOf, taxRateOf, type Block, type Valuation, type YearRow } from "@/lib/forecast";
import { useScenario } from "@/components/ScenarioProvider";
import { tierLabel } from "@/lib/scenario";
import { tierVar } from "@/lib/palette";
import { isoToLabel, mw, perMw, px, quarter, usdCompact } from "@/lib/format";

export function Contracts({ company, blocks }: { company: Company; blocks: Block[] }) {
  const signed = blocks.filter((b) => b.ramp.tier === "live" || b.ramp.tier === "contracted");
  const campus = Object.fromEntries(company.campuses.map((c) => [c.id, c.name]));
  if (!signed.length) {
    return <div className="card card-pad note">No signed AI contract yet. Switch on sites under Sites to test what a lease would be worth.</div>;
  }
  return (
    <>
      <div className="card table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Phase</th>
              <th>Tenant</th>
              <th className="r">IT MW</th>
              <th className="r">Term</th>
              <th className="r">Contract value</th>
              <th className="r">Rent a year, average</th>
              <th className="r">$/kW·mo</th>
              <th className="r">Escalator</th>
              <th className="r">Margin</th>
              <th>Online</th>
            </tr>
          </thead>
          <tbody>
            {signed.map((b) => {
              const r = b.ramp;
              const rate = leaseRateOf(b);
              return (
                <tr key={r.id}>
                  <td>
                    <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><i className="swatch" style={{ background: tierVar(r.tier), width: 8, height: 8 }} /><b>{r.label}</b></span>
                    <small>{campus[r.campus]} · {tierLabel[r.tier]}</small>
                  </td>
                  <td>{r.tenant ?? "—"}</td>
                  <td className="r">{mw(b.itMw)}</td>
                  <td className="r">{r.termYears ? `${r.termYears} yrs` : "—"}</td>
                  <td className="r">{r.contractValue ? usdCompact(r.contractValue) : r.revenue && r.termYears ? usdCompact(r.revenue * r.termYears) : "—"}</td>
                  <td className="r">{usdCompact(b.revenue)}{b.revenueFrom === "rate" ? <small>your rate</small> : null}</td>
                  <td className="r">{rate ? `$${Math.round(rate)}` : "—"}{rate ? <small>to start</small> : null}</td>
                  <td className="r">{b.escalator ? `${(b.escalator * 100).toFixed(1).replace(/\.0$/, "")}%` : "—"}{b.escalator ? <small>{b.escalatorFrom === "company" ? "disclosed" : "assumed"}</small> : null}</td>
                  <td className="r">{b.revenue ? `${Math.round((b.noi / b.revenue) * 100)}%` : "—"}{b.noiFrom === "assumed margin" ? <small>assumed</small> : null}</td>
                  <td>{quarter(b.start)}{b.full !== b.start ? `–${quarter(b.full)}` : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {company.deals.length ? (
        <div className="cost-grid" style={{ marginTop: 12 }}>
          {company.deals.map((d) => (
            <div className="card" key={d.id}>
              <div className="eyebrow">{d.tenant}</div>
              <h3 style={{ fontSize: 15, marginTop: 4 }}>{d.name}</h3>
              <p style={{ marginTop: 6 }}>{d.note}</p>
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}

const capKind: Record<CapitalItem["kind"], { label: string; color: string }> = {
  committed: { label: "Committed", color: "var(--s1)" },
  derived: { label: "Derived", color: "var(--s3)" },
  guarantee: { label: "Guarantee", color: "var(--s4)" },
  seeking: { label: "Seeking", color: "var(--s-watch)" },
};

export function Financing({ company, blocks }: { company: Company; blocks: Block[] }) {
  const on = blocks.filter((b) => b.enabled);
  const capex = on.reduce((a, b) => a + b.capex, 0);
  const disclosed = on.filter((b) => b.capexFrom === "company").reduce((a, b) => a + b.capex, 0);
  const capital = company.capital ?? [];
  const capTotal = capital.reduce((a, c) => a + (c.amountUsd ?? 0), 0);
  return (
    <>
      <div className="stats">
        <div className="stat"><span className="eyebrow">Build cost, sites switched on</span><strong>{usdCompact(capex)}</strong><small>{capex ? `${Math.round((disclosed / capex) * 100)}% from company figures` : "Nothing switched on"}</small></div>
        <div className="stat"><span className="eyebrow">Capex per IT MW</span><strong>{on.length ? perMw(capex / Math.max(1, on.reduce((a, b) => a + b.itMw, 0))) : "—"}</strong><small>Blended across those sites</small></div>
        <div className="stat"><span className="eyebrow">Financing on record</span><strong>{capTotal ? usdCompact(capTotal) : "—"}</strong><small>All kinds, listed below</small></div>
      </div>
      {company.costs.length ? (
        <div className="cost-grid" style={{ marginTop: 12 }}>
          {company.costs.map((c) => (
            <div className="card" key={c.id}>
              <div className="eyebrow">{c.label}</div>
              <strong>
                {c.usdPerMw ? perMw(c.usdPerMw) : c.lowPerMw && c.highPerMw ? `$${c.lowPerMw / 1e6}–${c.highPerMw / 1e6}M/MW` : c.totalUsd && c.mw ? perMw(c.totalUsd / c.mw) : c.totalUsd ? usdCompact(c.totalUsd) : "—"}
              </strong>
              <p>{c.includes}</p>
              {c.totalUsd && (c.usdPerMw || c.mw) ? <p className="note" style={{ marginTop: 6 }}>{usdCompact(c.totalUsd)} total{c.mw ? ` on ${mw(c.mw)}` : ""}</p> : null}
              {c.note ? <p className="note" style={{ marginTop: 6 }}>{c.note}</p> : null}
            </div>
          ))}
        </div>
      ) : null}
      {capital.length ? (
        <div className="card card-pad" style={{ marginTop: 12 }}>
          <h3 style={{ fontSize: 15 }}>Debt and security</h3>
          <div className="cap-bar" aria-hidden="true">
            {capital.filter((c) => c.amountUsd).map((c) => (
              <i key={c.id} style={{ flex: c.amountUsd, background: capKind[c.kind].color }} title={`${c.label} ${usdCompact(c.amountUsd!)}`} />
            ))}
          </div>
          <div className="legend" style={{ marginBottom: 6 }}>
            {(Object.keys(capKind) as CapitalItem["kind"][]).filter((k) => capital.some((c) => c.kind === k)).map((k) => (
              <span key={k}><i className="swatch" style={{ background: capKind[k].color }} />{capKind[k].label}</span>
            ))}
          </div>
          <div className="cap-list">
            {capital.map((c) => (
              <div key={c.id}>
                <span className="pill" style={{ justifySelf: "start" }}><i className="swatch" style={{ background: capKind[c.kind].color, width: 8, height: 8 }} />{capKind[c.kind].label}</span>
                <div>
                  <b style={{ fontWeight: 560 }}>{c.label}</b>
                  <p>{c.note} {isoToLabel(c.asOf)}.</p>
                </div>
                <b className="tabular">{c.amountUsd ? usdCompact(c.amountUsd) : "To come"}</b>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}

export function YearTable({ rows, gpu }: { rows: YearRow[]; gpu: boolean }) {
  const line = (label: string, get: (r: YearRow) => string, strong = false) => (
    <tr>
      <td>{strong ? <b>{label}</b> : label}</td>
      {rows.map((r) => <td key={r.year} className="r">{strong ? <b>{get(r)}</b> : get(r)}</td>)}
    </tr>
  );
  return (
    <div className="card table-wrap">
      <table className="data year-table">
        <thead>
          <tr><th>Calendar year</th>{rows.map((r) => <th key={r.year} className="r">{r.year}</th>)}</tr>
        </thead>
        <tbody>
          {line("Critical IT at year end", (r) => mw(r.mwEnd))}
          {line("Revenue", (r) => usdCompact(r.revenue))}
          {line(gpu ? "Project EBITDA" : "NOI", (r) => usdCompact(r.noi))}
          {line("Overhead, AI share", (r) => usdCompact(-r.overhead))}
          {line("Depreciation", (r) => usdCompact(-r.da))}
          {line("Interest", (r) => usdCompact(-r.interest))}
          {line("Earnings", (r) => usdCompact(r.earnings), true)}
          {line("Earnings per share", (r) => px(r.eps))}
          {line("Exit revenue run-rate", (r) => usdCompact(r.exitRevenue))}
          {line("Value per share at year end", (r) => (r.value != null && r.value > 0 ? px(r.value) : "—"), true)}
        </tbody>
      </table>
    </div>
  );
}

export function Sources({ company }: { company: Company }) {
  // Checked against SEC EDGAR when the site is built.
  const filings: Filing[] | null = (filingSnapshot.filings as Filing[]).filter((f) => f.ticker === company.ticker);
  const unread = filings?.filter((f) => f.unread) ?? [];
  return (
    <>
      <div className="card card-pad" style={{ marginBottom: 12 }}>
        <div className="flag-bar">
          {unread.length ? (
            <span className="warn">New filing since the last review on {isoToLabel(company.reviewedAt)}. Figures here update once it&apos;s read.</span>
          ) : (
            <span>Up to date with SEC EDGAR as of the {isoToLabel(company.reviewedAt)} review, checked {isoToLabel(filingSnapshot.fetchedAt.slice(0, 10))}.</span>
          )}
          {filings?.map((f) => (
            <a key={`${f.form}-${f.date}`} className="link" href={f.url} target="_blank" rel="noreferrer">Latest {f.form}, {isoToLabel(f.date)}</a>
          ))}
        </div>
      </div>
      <div className="card card-pad sources">
        {company.sources.map((s) => (
          <a key={s.id} href={s.url} target="_blank" rel="noreferrer">
            <span>{s.title}</span>
            <span className="muted tabular">{isoToLabel(s.asOf)}</span>
          </a>
        ))}
      </div>
    </>
  );
}

export function BalanceSheet({ company, value }: { company: Company; value: Valuation }) {
  const { scenario } = useScenario();
  const bal = company.balance;
  if (!bal) return null;
  const taxRate = taxRateOf(company, blocks(company, scenario), scenario);
  const src = company.sources.find((x) => x.id === bal.source);
  const ai = value.ai;
  return (
    <div className="card card-pad" style={{ marginTop: 12 }}>
      <h3 style={{ fontSize: 15 }}>The rest of the company</h3>
      <p className="note" style={{ margin: "4px 0 12px" }}>
        Balance sheet at {isoToLabel(bal.asOf)}{src ? <>, from <a className="link" href={src.url} target="_blank" rel="noreferrer">{src.title}</a></> : null}. These lines sit between the AI business and each share.
      </p>
      <div className="cap-list">
        {value.bridge.lines.filter((l) => l.label !== "Build cost still to spend").map((l) => (
          <div key={l.label}>
            <span className="pill" style={{ justifySelf: "start" }}>{l.value < 0 ? "Less" : "Add"}</span>
            <div>
              <b style={{ fontWeight: 560 }}>{l.label}</b>
              {l.note ? <p>{l.note}</p> : null}
            </div>
            <b className="tabular">{l.value < 0 ? "−" : ""}{usdCompact(Math.abs(l.value))}</b>
          </div>
        ))}
        {bal.other ? (
          <div>
            <span className="pill" style={{ justifySelf: "start" }}>Add</span>
            <div>
              <b style={{ fontWeight: 560 }}>{bal.other.label}</b>
              <p>{bal.other.note} {usdCompact(bal.other.grossProfit)} a year, less {usdCompact(ai.overheadOther)} of overhead, at your multiple.</p>
            </div>
            <b className="tabular">{usdCompact(ai.otherValue)}</b>
          </div>
        ) : null}
        <div>
          <span className="pill" style={{ justifySelf: "start" }}>Cost</span>
          <div>
            <b style={{ fontWeight: 560 }}>Corporate overhead</b>
            <p>{bal.overheadNote} Charged a year: {usdCompact(ai.overheadAi)} to the AI business{ai.overheadOther ? ` and ${usdCompact(ai.overheadOther)} to the rest` : ""}, at the end of your valuation year.</p>
          </div>
          <b className="tabular">{usdCompact(ai.overheadAi + ai.overheadOther)}/yr</b>
        </div>
        {bal.taxLosses && bal.bookEquity == null ? (
          <div>
            <span className="pill" style={{ justifySelf: "start" }}>Tax</span>
            <div>
              <b style={{ fontWeight: 560 }}>Tax losses carried forward</b>
              <p>The tax value of past losses at {isoToLabel(bal.taxLosses.asOf)}, before any valuation allowance, from the <a className="link" href={bal.taxLosses.filing} target="_blank" rel="noreferrer">10-K</a>{bal.taxLosses.property ? <>, {bal.taxLosses.property < 0 ? "less" : "plus"} {usdCompact(Math.abs(bal.taxLosses.property))} of deferred tax on property {bal.taxLosses.property < 0 ? "for deductions already taken early" : "for deductions still to come"}</> : null}. The DCF uses it against future tax, up to 80% of each year&apos;s, at a {(taxRate * 100).toFixed(1)}% federal and state rate on these sites.</p>
            </div>
            <b className="tabular">{usdCompact(Math.max(0, bal.taxLosses.value + bal.taxLosses.property))}</b>
          </div>
        ) : null}
      </div>
    </div>
  );
}
