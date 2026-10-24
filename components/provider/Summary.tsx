"use client";

import { useMemo, useState } from "react";
import type { Company } from "@/data/types";
import { blocks, priceByYear, sumTiers, upside, valuation, type Ctx, type Valuation } from "@/lib/forecast";
import { appliedBasis, scenarioChip, tierLabel } from "@/lib/scenario";
import { tierVar } from "@/lib/palette";
import { isoToLabel, mw, px, quarter, usdCompact } from "@/lib/format";
import { useScenario } from "@/components/ScenarioProvider";

const SHOWN = 5;

function signedDollars(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (Math.abs(n) < 0.005) return "$0.00";
  return `${n > 0 ? "+" : "−"}${px(Math.abs(n))}`;
}

export function Summary({ company, ctx, value, multiple }: { company: Company; ctx: Ctx; value: Valuation; multiple: number | null }) {
  const quote = ctx.quote;
  const { scenario: s, toggleRamp, setRamps, set, openPanel } = useScenario();
  const chip = scenarioChip(s);
  const gpu = company.model === "gpu-cloud";
  const [all, setAll] = useState(false);
  const rows = useMemo(() => upside(company, s, ctx), [company, s, ctx]);
  const name = company.name;
  const onMw = sumTiers(value.target.mw);
  const cap = quote?.marketCap ? usdCompact(quote.marketCap) : null;
  const ok = value.price != null && value.price > 0;
  const basis = appliedBasis(company.model, s);
  const basisWord = basis === "cap" ? "NOI" : basis === "pe" ? "earnings" : "EBITDA";

  const offMw = rows.reduce((a, r) => a + r.block.itMw, 0);
  const lastYear = rows.reduce((a, r) => Math.max(a, r.builtYear), s.year);
  const allOn = useMemo(() => {
    if (!rows.length) return null;
    const sc = { ...s, year: lastYear, on: [...s.on, ...rows.map((r) => r.block.ramp.id)], off: s.off.filter((id) => !rows.some((r) => r.block.ramp.id === id)) };
    const base = { ...s, year: lastYear };
    const a = valuation(company, blocks(company, sc), sc, ctx).price;
    const b = valuation(company, blocks(company, base), base, ctx).price;
    return a != null && b != null ? a - b : null;
  }, [rows, s, lastYear, company, ctx]);
  const shown = all ? rows : rows.slice(0, SHOWN);
  // Once every site is built by the valuation year, "now" and "once built" are the same number.
  const later = rows.some((r) => r.builtYear !== s.year);
  const years = useMemo(() => priceByYear(company, s, ctx), [company, s, ctx]);

  return (
    <div className="card summary">
      <button type="button" className="scenario-line" onClick={openPanel}>
        <span className="eyebrow">Book scenario</span>
        <b>{chip.main} · {chip.scope}</b>
        <span className="note">{gpu ? "IREN is a GPU cloud, so it stays on the earnings multiple. A cap rate does not apply here." : s.basis === "cap" ? "This price capitalizes NOI at your cap rate and subtracts project debt." : "The lease rate fills sites with no disclosed rent. It does not move IREN."}</span>
      </button>
      <div className="summary-text">
        {onMw === 0 ? (
          <p className="lead">
            {name} has no AI lease switched on.{" "}
            {ok
              ? <>Its cash, bitcoin and other businesses, less debt, come to <b>{px(value.price)}</b> a share, {pctWord(value.upside)} today&apos;s price. The rest of {cap ? `its ${cap} market value` : "its market value"} is a bet on the power listed below.</>
              : <>Its debt and other claims come to more than its cash, bitcoin and other businesses, so the rest of {cap ? `its ${cap} market value` : "its market value"} is a bet on the power listed below.</>}
          </p>
        ) : ok ? (
          <p className="lead">
            At {px(quote?.price ?? null)}{cap ? `, the market values ${name} at ${cap}` : ""}. Your scenario puts the {mw(onMw)} switched on, plus the rest of the balance sheet, at{" "}
            <b>{px(value.price)}</b> a share, {pctWord(value.upside)} today&apos;s price.
          </p>
        ) : (
          <p className="lead">
            In your scenario, {name}&apos;s debt, other claims and the build cost still to spend come to more than its AI business and other assets are worth at the end of {s.year}, so the shares come out at zero.
          </p>
        )}
        {onMw > 0 ? (
          <p>
            {multiple != null && basis === "cap"
              ? <>Today&apos;s price implies a <b>{(multiple * 100).toFixed(1)}%</b> cap rate on the end-{s.year} NOI after overhead, with the balance sheet as it is. Your scenario uses {(s.capRate * 100).toFixed(1)}%.</>
              : multiple != null
                ? <>Put another way, today&apos;s price pays <b>{multiple.toFixed(1)}×</b> {basisWord} at the end-{s.year} run-rate, with the balance sheet as it is. Your scenario uses {s.multiple}×.</>
                : <>Earnings after overhead are negative at the end of {s.year} in your scenario, so there&apos;s no market multiple to compare.</>}
          </p>
        ) : null}
        <div className="year-row">
          <span className="note">Implied today, valuing the run-rate at the end of</span>
          <div className="year-strip" role="radiogroup" aria-label="Valuation year">
            {years.map((y) => (
              <button key={y.year} type="button" role="radio" aria-checked={y.year === s.year} className={y.year === s.year ? "on" : ""} onClick={() => set({ year: y.year })}>
                <span>{y.year}</span>
                <b>{y.price != null && y.price > 0 ? px(y.price) : "—"}</b>
              </button>
            ))}
          </div>
        </div>
        {rows.length ? (
          <p>
            <b>Not in this price:</b> {mw(offMw)} of power with no tenant yet or held as a future option.
            {allOn != null && allOn > 0 ? <> {gpu ? "At your GPU rate" : "Leased at your rate"}, all of it would add about <b>{px(allOn)}</b> a share once built, valued at the end of {lastYear}.</> : null}
          </p>
        ) : (
          <p className="muted">Every site in the ledger is switched on.</p>
        )}
      </div>

      {rows.length ? (
        <>
          <div className="table-wrap">
            <table className="data upside">
              <thead>
                <tr>
                  <th>Site</th>
                  <th className="r">IT capacity</th>
                  <th>Fully online</th>
                  <th className="r">{later ? `Adds, end ${s.year}` : `Adds to the end-${s.year} price`}</th>
                  {later ? <th className="r">Adds once built</th> : null}
                  <th className="r"><span className="sr">Switch</span></th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.block.ramp.id}>
                    <td>
                      <b>{r.block.ramp.label}</b>
                      <small>
                        <i className="swatch" style={{ background: tierVar(r.block.ramp.tier), width: 8, height: 8, marginRight: 6, verticalAlign: "middle" }} />
                        {tierLabel[r.block.ramp.tier]}
                      </small>
                    </td>
                    <td className="r">{mw(r.block.itMw)}</td>
                    <td>{quarter(r.block.full)}</td>
                    {later ? (
                      <>
                        <td className="r muted">{signedDollars(r.addNow)}</td>
                        <td className="r">
                          <b>{signedDollars(r.addBuilt)}</b>
                          {r.builtYear !== s.year ? (
                            <small>
                              <button type="button" className="link" onClick={() => set({ year: r.builtYear })}>valued at {r.builtYear}</button>
                            </small>
                          ) : null}
                        </td>
                      </>
                    ) : (
                      <td className="r"><b>{signedDollars(r.addNow)}</b></td>
                    )}
                    <td className="r"><button type="button" className="btn" onClick={() => toggleRamp(r.block.ramp)}>Include</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="summary-foot">
            {rows.length > SHOWN ? (
              <button type="button" className="btn ghost" onClick={() => setAll(!all)}>{all ? "Show fewer" : `Show all ${rows.length}`}</button>
            ) : <span />}
            <span className="note">{gpu ? "Each figure is per share today. Sites without a disclosed contract use your GPU rate and GPU cost." : "Each figure is per share today. Sites without a disclosed rent use your lease rate and build cost."}</span>
            <button type="button" className="btn" onClick={() => setRamps(rows.map((r) => r.block.ramp), true)}>Include all</button>
          </div>
        </>
      ) : null}
    </div>
  );
}

export function PriceBridge({ company, value }: { company: Company; value: Valuation }) {
  const { scenario: s } = useScenario();
  const gpu = company.model === "gpu-cloud";
  const basis = appliedBasis(company.model, s);
  const t = value.target;
  const ai = value.ai;
  const revenue = sumTiers(t.revenue);
  const ok = value.price != null && value.price > 0;
  const tax = Math.max(0, ai.noi - t.da - t.interest) * s.tax;
  const asOf = company.balance?.asOf;
  return (
    <div className="card card-pad" style={{ marginTop: 14 }}>
      <div className="bridge-cols">
        <div>
          <div className="eyebrow">The AI business, end {s.year}</div>
          <div className="bridge" style={{ marginTop: 8 }}>
            <div><span>Revenue run-rate</span><b>{usdCompact(revenue)}</b></div>
            <div><span>{gpu ? "Project EBITDA" : "NOI"}{revenue ? ` · ${Math.round((t.noi / revenue) * 100)}%` : ""}</span><b>{usdCompact(t.noi)}</b></div>
            <div><span>Overhead, its share</span><b>−{usdCompact(ai.overheadAi)}</b></div>
            {basis === "pe" ? (
              <>
                <div><span>Depreciation</span><b>−{usdCompact(t.da)}</b></div>
                <div><span>Interest on {Math.round(s.leverage * 100)}% build debt</span><b>−{usdCompact(t.interest)}</b></div>
                <div><span>Tax</span><b>−{usdCompact(tax)}</b></div>
                <div className="total"><span>Earnings × {s.multiple}, plus that build debt</span><b>{usdCompact(ai.ev)}</b></div>
              </>
            ) : basis === "cap" ? (
              <div className="total"><span>NOI ÷ {(s.capRate * 100).toFixed(1)}% cap rate</span><b>{usdCompact(ai.ev)}</b></div>
            ) : (
              <div className="total"><span>NOI × {s.multiple}</span><b>{usdCompact(ai.ev)}</b></div>
            )}
            <div className="total"><span>Discounted {value.years.toFixed(1)} years at {(s.discount * 100).toFixed(1)}%</span><b>{usdCompact(value.aiToday)}</b></div>
          </div>
        </div>
        <div>
          <div className="eyebrow">The rest of the company{asOf ? `, balance sheet at ${isoToLabel(asOf)}` : ""}</div>
          <div className="bridge" style={{ marginTop: 8 }}>
            <div><span>AI business today</span><b>{usdCompact(value.aiToday)}</b></div>
            {company.balance?.other ? (
              <div title={company.balance.other.note}><span>{company.balance.other.label}, {s.otherMultiple}× gross profit after its overhead</span><b>{usdCompact(ai.otherValue)}</b></div>
            ) : null}
            {value.bridge.lines.map((l) => (
              <div key={l.label} title={l.note}><span>{l.label}</span><b>{l.value < 0 ? "−" : "+"}{usdCompact(Math.abs(l.value))}</b></div>
            ))}
            <div className="total"><span>Equity value today</span><b>{usdCompact(value.equity)}</b></div>
            <div><span>÷ {value.shares ? `${(value.shares / 1e6).toFixed(0)}M shares` : "shares"}</span><b>{ok ? px(value.price) : "—"}</b></div>
          </div>
        </div>
      </div>
      {!company.balance ? <p className="note" style={{ marginTop: 10 }}>No balance sheet in the ledger yet, so cash and debt are left out.</p> : null}
    </div>
  );
}

function pctWord(upside: number | null): string {
  if (upside == null) return "against";
  const p = Math.round(Math.abs(upside) * 100);
  if (p === 0) return "in line with";
  return `${p}% ${upside > 0 ? "above" : "below"}`;
}
