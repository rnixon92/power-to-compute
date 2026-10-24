"use client";

import { useEffect, useState } from "react";
import { book } from "@/data/ledger";
import { disclosedLeaseRate } from "@/lib/forecast";
import { defaultScenario, scenarioChip } from "@/lib/scenario";
import { useScenario } from "@/components/ScenarioProvider";
import { PresetPicker, TierToggles } from "@/components/ScenarioControls";
import { Segmented, Slider } from "@/components/ui";

const YEARS = [2026, 2027, 2028, 2029, 2030];

export function Assumptions() {
  const { scenario: s, set, replace, panel, closePanel } = useScenario();
  const [copied, setCopied] = useState(false);
  const leaseHint = disclosedLeaseRate(book);
  const chip = scenarioChip(s);
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const ramps = book.flatMap((c) => c.ramps);

  useEffect(() => {
    if (!panel) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closePanel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel, closePanel]);

  if (!panel) return null;

  return (
    <div className="assume-root">
      <button type="button" className="assume-backdrop" aria-label="Close assumptions" onClick={closePanel} />
      <aside className="assume" role="dialog" aria-modal="true" aria-labelledby="assume-title">
        <div className="assume-head">
          <div>
            <h2 id="assume-title">Assumptions</h2>
            <p className="note">One scenario for all ten companies. The page behind this panel updates as you move these.</p>
          </div>
          <button type="button" className="btn ghost" onClick={closePanel}>Close</button>
        </div>

        <div className="assume-row">
          <PresetPicker />
          <button type="button" className="btn ghost" onClick={() => replace({ ...defaultScenario })}>Reset</button>
        </div>
        <p className="note assume-now">{chip.main} · {chip.scope}</p>

        <section className="assume-group">
          <h3>Whole book</h3>
          <p className="note">The multiple, the year, the delay and which kinds of sites are included. These move every company, including IREN.</p>
          <div>
            <div className="slider-top" style={{ marginBottom: 8 }}><span>Value the run-rate at the end of</span></div>
            <Segmented label="Valuation year" value={s.year} onChange={(y) => set({ year: y })} options={YEARS.map((y) => ({ value: y, label: String(y) }))} />
          </div>
          <TierToggles ramps={ramps} />
          <div className="slider-top"><span>Value landlords on</span></div>
          <Segmented label="Valuation basis" size="sm" value={s.basis} onChange={(b) => set({ basis: b })} options={[{ value: "pe", label: "Earnings" }, { value: "ebitda", label: "EBITDA" }, { value: "cap", label: "Cap rate" }]} />
          {s.basis === "cap" ? (
            <Slider label="Cap rate" value={s.capRate} min={0.05} max={0.1} step={0.001} format={(v) => `${(v * 100).toFixed(1)}%`} hint="Morgan Stanley's terminal rate on Hut 8 is 6.7%. A higher cap rate is a lower price. The default here is 7.5%." onChange={(v) => set({ capRate: v })} />
          ) : null}
          <Slider label={s.basis === "cap" ? "IREN earnings multiple" : "Multiple"} value={s.multiple} min={6} max={40} format={(v) => `${v}×`} hint={s.basis === "cap" ? "IREN sells compute, so a cap rate does not apply. It stays on earnings." : undefined} onChange={(v) => set({ multiple: v })} />
          <Slider label="Delay on future deliveries" value={s.slip} min={0} max={24} format={(v) => (v ? `${v} months` : "On schedule")} onChange={(v) => set({ slip: v })} />
          <details className="adv">
            <summary>Discount, debt and tax <span aria-hidden="true">+</span></summary>
            <div className="rail-grid">
              <Slider label="Discount rate" value={s.discount} min={0} max={0.2} step={0.005} format={(v) => `${(v * 100).toFixed(1)}%`} onChange={(v) => set({ discount: v })} />
              <Slider label="Debt share of build" value={s.leverage} min={0} max={0.9} step={0.05} format={pct} onChange={(v) => set({ leverage: v })} />
              <Slider label="Interest rate" value={s.interest} min={0.03} max={0.14} step={0.0025} format={(v) => `${(v * 100).toFixed(2)}%`} onChange={(v) => set({ interest: v })} />
              <Slider label="Tax rate" value={s.tax} min={0} max={0.3} step={0.01} format={pct} onChange={(v) => set({ tax: v })} />
              <Slider label="Share dilution per year" value={s.dilution} min={0} max={0.2} step={0.01} format={pct} onChange={(v) => set({ dilution: v })} />
              <Slider label="IT MW per gross MW" value={s.conversion} min={0.5} max={0.9} step={0.01} format={(v) => v.toFixed(2)} hint="Helios, River Bend and Beacon Point sit at 0.67–0.74." onChange={(v) => set({ conversion: v })} />
            </div>
          </details>
        </section>

        <section className="assume-group">
          <h3>Landlords</h3>
          <p className="note">Fills a gap only where a company has not disclosed rent, margin or build cost. Moves WULF, GLXY, CORZ, CIFR, APLD, HUT, RIOT, CLSK and MARA. Does not move IREN.</p>
          <Slider label="Lease rate, where rent is private" value={s.leaseRate} min={80} max={300} step={5} format={(v) => `$${v}/kW·mo`} hint={`Disclosed leases in the group average $${Math.round(leaseHint)}/kW·mo.`} onChange={(v) => set({ leaseRate: v })} />
          <Slider label="NOI margin, where undisclosed" value={s.coloMargin} min={0.5} max={0.98} step={0.01} format={pct} hint="Galaxy reports 90%+, Core Scientific 80–85%." onChange={(v) => set({ coloMargin: v })} />
          <Slider label="Build cost, where undisclosed" value={s.buildCost} min={5} max={20} step={0.5} format={(v) => `$${v}M/MW`} hint="TeraWulf guides $8–10M, Hut 8 $9–11M, Galaxy built at $13.5M." onChange={(v) => set({ buildCost: v })} />
          <Slider label="Building depreciation life" value={s.shellLife} min={10} max={40} format={(v) => `${v} years`} onChange={(v) => set({ shellLife: v })} />
        </section>

        <section className="assume-group">
          <h3>GPU cloud</h3>
          <p className="note">IREN sells the compute, not the building. These fill sites where IREN has not disclosed revenue or GPU cost. They do not move the landlords.</p>
          <Slider label="GPU cloud revenue, uncontracted MW" value={s.gpuRate} min={3} max={20} step={0.1} format={(v) => `$${v.toFixed(1)}M/MW·yr`} hint="Microsoft contract works out to $9.7M per MW a year." onChange={(v) => set({ gpuRate: v })} />
          <Slider label="Project EBITDA margin" value={s.gpuMargin} min={0.3} max={0.95} step={0.01} format={pct} hint="IREN targets 85% on the Microsoft contract." onChange={(v) => set({ gpuMargin: v })} />
          <Slider label="GPU capex, where undisclosed" value={s.gpuCost} min={10} max={60} format={(v) => `$${v}M/MW`} onChange={(v) => set({ gpuCost: v })} />
          <Slider label="GPU depreciation life" value={s.gpuLife} min={3} max={8} format={(v) => `${v} years`} onChange={(v) => set({ gpuLife: v })} />
        </section>

        <button
          type="button"
          className="btn"
          onClick={() => {
            navigator.clipboard.writeText(window.location.href).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1600);
            });
          }}
        >
          {copied ? "Link copied" : "Copy a link to this scenario"}
        </button>
      </aside>
    </div>
  );
}
