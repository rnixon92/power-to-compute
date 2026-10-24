"use client";

import { useMemo, useState } from "react";
import type { Company, Quote } from "@/data/types";
import { blocks, sumTiers, upside, valuation, type Valuation } from "@/lib/forecast";
import { tierLabel } from "@/lib/scenario";
import { tierVar } from "@/lib/palette";
import { mw, px, quarter, usdCompact } from "@/lib/format";
import { useScenario } from "@/components/ScenarioProvider";

const SHOWN = 5;

function signedDollars(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (Math.abs(n) < 0.005) return "$0.00";
  return `${n > 0 ? "+" : "−"}${px(Math.abs(n))}`;
}

export function Summary({ company, quote, value, multiple }: { company: Company; quote?: Quote; value: Valuation; multiple: number | null }) {
  const { scenario: s, toggleRamp, setRamps, set } = useScenario();
  const [all, setAll] = useState(false);
  const rows = useMemo(() => upside(company, s, quote), [company, s, quote]);
  const name = company.name;
  const onMw = sumTiers(value.target.mw);
  const cap = quote?.marketCap ? usdCompact(quote.marketCap) : null;
  const ok = value.price != null && value.price > 0;
  const basis = s.basis === "pe" ? "earnings" : "EBITDA";

  const offMw = rows.reduce((a, r) => a + r.block.itMw, 0);
  const lastYear = rows.reduce((a, r) => Math.max(a, r.builtYear), s.year);
  const allOn = useMemo(() => {
    if (!rows.length) return null;
    const sc = { ...s, year: lastYear, on: [...s.on, ...rows.map((r) => r.block.ramp.id)], off: s.off.filter((id) => !rows.some((r) => r.block.ramp.id === id)) };
    const base = { ...s, year: lastYear };
    const a = valuation(blocks(company, sc), sc, quote).price;
    const b = valuation(blocks(company, base), base, quote).price;
    return a != null && b != null ? a - b : null;
  }, [rows, s, lastYear, company, quote]);
  const shown = all ? rows : rows.slice(0, SHOWN);

  return (
    <div className="card summary">
      <div className="summary-text">
        {ok ? (
          <>
            <p className="lead">
              At {px(quote?.price ?? null)}{cap ? `, the market values ${name} at ${cap}` : ""}. Your scenario puts the {mw(onMw)} switched on at{" "}
              <b>{px(value.price)}</b> a share, {pctWord(value.upside)} today&apos;s price.
            </p>
            <p>
              {multiple != null
                ? <>Put another way, today&apos;s price pays <b>{multiple.toFixed(1)}×</b> {basis} at the end-{s.year} run-rate. Your scenario uses {s.multiple}×.</>
                : <>Earnings at the end of {s.year} are negative in your scenario, so there&apos;s no market multiple to compare.</>}
            </p>
          </>
        ) : onMw > 0 ? (
          <p className="lead">
            {name}&apos;s switched-on capacity earns less than it costs to carry at the end of {s.year} in your scenario. Try a later year in the panel, a higher margin or a longer depreciation life.
          </p>
        ) : (
          <p className="lead">
            {name} has no signed AI lease yet, so {cap ? `its ${cap} market value` : "its market value"} rests on the rest of the business today. Its power is listed below as options you can switch on.
          </p>
        )}
        {rows.length ? (
          <p>
            <b>Not in this price:</b> {mw(offMw)} of power with no tenant yet or held as a future option.
            {allOn != null && allOn > 0 ? <> Leased at your rate, all of it would add about <b>{px(allOn)}</b> a share once built, valued at the end of {lastYear}.</> : null}
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
                  <th className="r">Adds, end {s.year}</th>
                  <th className="r">Adds once built</th>
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
                    <td className="r muted">{signedDollars(r.addNow)}</td>
                    <td className="r">
                      <b>{signedDollars(r.addBuilt)}</b>
                      {r.builtYear !== s.year ? (
                        <small>
                          <button type="button" className="link" onClick={() => set({ year: r.builtYear })}>valued at {r.builtYear}</button>
                        </small>
                      ) : null}
                    </td>
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
            <span className="note">Each figure is per share today, at your lease rate and build cost, with nothing else changed.</span>
            <button type="button" className="btn" onClick={() => setRamps(rows.map((r) => r.block.ramp), true)}>Include all</button>
          </div>
        </>
      ) : null}
    </div>
  );
}

function pctWord(upside: number | null): string {
  if (upside == null) return "against";
  const p = Math.round(Math.abs(upside) * 100);
  if (p === 0) return "in line with";
  return `${p}% ${upside > 0 ? "above" : "below"}`;
}
