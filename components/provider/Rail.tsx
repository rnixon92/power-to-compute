"use client";

import { useState } from "react";
import type { Company, Quote } from "@/data/types";
import { sumTiers, type Valuation } from "@/lib/forecast";
import { defaultScenario } from "@/lib/scenario";
import { px, usdCompact } from "@/lib/format";
import { useScenario } from "@/components/ScenarioProvider";
import { Delta, Segmented, Slider, Tweened } from "@/components/ui";
import { PresetPicker } from "@/components/ScenarioControls";

export function Rail({ company, quote, value, leaseHint, years }: { company: Company; quote?: Quote; value: Valuation; leaseHint: number; years: { year: number; price: number | null; upside: number | null }[] }) {
  const { scenario: s, set, replace } = useScenario();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const gpu = company.model === "gpu-cloud";
  const t = value.target;
  const revenue = sumTiers(t.revenue);
  const pretax = t.noi - t.da - t.interest;
  const tax = pretax > 0 ? pretax * s.tax : 0;
  const ok = value.price != null && value.price > 0;
  const pctFmt = (v: number) => `${Math.round(v * 100)}%`;

  return (
    <>
      <aside className={open ? "rail open" : "rail"} aria-label="Scenario">
        {open ? (
          <button type="button" className="btn ghost" style={{ alignSelf: "flex-end" }} onClick={() => setOpen(false)}>Close</button>
        ) : null}
        <div className="card rail-out">
          <div className="eyebrow">Implied value per share today</div>
          <div className="big">{ok ? <Tweened value={value.price} format={px} /> : "—"}</div>
          <div className="row">
            <span>vs last <b>{px(quote?.price ?? null)}</b> {ok ? <Delta value={(value.upside ?? 0) * 100} digits={0} /> : null}</span>
            {quote?.streetMean ? <span>Street <b>{px(quote.streetMean)}</b></span> : null}
          </div>
          <p className="how">
            {ok
              ? `End-${s.year} run-rate at ${s.multiple}× ${s.basis === "pe" ? "earnings" : "EBITDA"} is ${px(value.futurePrice)} a share, discounted ${value.years.toFixed(1)} years at ${Math.round(s.discount * 100)}%.`
              : revenue > 0
                ? "Earnings are negative at this point in your scenario. Try a later year, a longer depreciation life or a higher margin."
                : "No capacity is switched on for this company. Switch on a site below to value it."}
            {company.outside ? ` Leaves out ${company.outside.charAt(0).toLowerCase()}${company.outside.slice(1)}` : ""}
          </p>
        </div>

        <div className="card rail-ctl">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <PresetPicker />
            <button type="button" className="btn ghost" onClick={() => replace({ ...defaultScenario })}>Reset</button>
          </div>
          <div>
            <div className="slider-top" style={{ marginBottom: 8 }}><span>Implied today, valuing the run-rate at the end of</span></div>
            <div className="year-strip" role="radiogroup" aria-label="Valuation year">
              {years.map((y) => (
                <button key={y.year} type="button" role="radio" aria-checked={y.year === s.year} className={y.year === s.year ? "on" : ""} onClick={() => set({ year: y.year })}>
                  <span>{y.year}</span>
                  <b>{y.price != null && y.price > 0 ? `$${y.price >= 100 ? y.price.toFixed(0) : y.price.toFixed(2)}` : "—"}</b>
                </button>
              ))}
            </div>
            <small className="note" style={{ display: "block", marginTop: 8 }}>Later years count more capacity but are discounted for longer.</small>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            <div className="slider-top"><span>Multiple on</span></div>
            <Segmented label="Valuation basis" size="sm" value={s.basis} onChange={(b) => set({ basis: b })} options={[{ value: "pe", label: "Earnings" }, { value: "ebitda", label: "EBITDA" }]} />
            <Slider label="Multiple" value={s.multiple} min={6} max={40} format={(v) => `${v}×`} onChange={(v) => set({ multiple: v })} />
          </div>
          {gpu ? (
            <Slider label="GPU cloud revenue, uncontracted MW" value={s.gpuRate} min={3} max={20} step={0.1} format={(v) => `$${v.toFixed(1)}M/MW·yr`} hint="Microsoft contract works out to $9.7M per MW a year." onChange={(v) => set({ gpuRate: v })} />
          ) : (
            <Slider label="Lease rate, where rent is private" value={s.leaseRate} min={80} max={300} step={5} format={(v) => `$${v}/kW·mo`} hint={`Disclosed leases in the group average $${Math.round(leaseHint)}/kW·mo.`} onChange={(v) => set({ leaseRate: v })} />
          )}
          <Slider label="Delay on future deliveries" value={s.slip} min={0} max={24} format={(v) => (v ? `${v} months` : "On schedule")} onChange={(v) => set({ slip: v })} />
          <details className="adv">
            <summary>More assumptions <span aria-hidden="true">+</span></summary>
            <div className="rail-grid">
              {gpu ? (
                <>
                  <Slider label="Project EBITDA margin" value={s.gpuMargin} min={0.3} max={0.95} step={0.01} format={pctFmt} hint="IREN targets 85% on the Microsoft contract." onChange={(v) => set({ gpuMargin: v })} />
                  <Slider label="GPU capex, where undisclosed" value={s.gpuCost} min={10} max={60} format={(v) => `$${v}M/MW`} onChange={(v) => set({ gpuCost: v })} />
                  <Slider label="GPU depreciation life" value={s.gpuLife} min={3} max={8} format={(v) => `${v} years`} onChange={(v) => set({ gpuLife: v })} />
                </>
              ) : (
                <>
                  <Slider label="NOI margin, where undisclosed" value={s.coloMargin} min={0.5} max={0.98} step={0.01} format={pctFmt} hint="Galaxy reports 90%+, Core Scientific 80–85%." onChange={(v) => set({ coloMargin: v })} />
                  <Slider label="Build cost, where undisclosed" value={s.buildCost} min={5} max={20} step={0.5} format={(v) => `$${v}M/MW`} hint="TeraWulf guides $8–10M, Hut 8 $9–11M, Galaxy built at $13.5M." onChange={(v) => set({ buildCost: v })} />
                  <Slider label="Building depreciation life" value={s.shellLife} min={10} max={40} format={(v) => `${v} years`} onChange={(v) => set({ shellLife: v })} />
                </>
              )}
              <Slider label="Debt share of build" value={s.leverage} min={0} max={0.9} step={0.05} format={pctFmt} onChange={(v) => set({ leverage: v })} />
              <Slider label="Interest rate" value={s.interest} min={0.03} max={0.14} step={0.0025} format={(v) => `${(v * 100).toFixed(2)}%`} onChange={(v) => set({ interest: v })} />
              <Slider label="Tax rate" value={s.tax} min={0} max={0.3} step={0.01} format={pctFmt} onChange={(v) => set({ tax: v })} />
              <Slider label="Discount rate" value={s.discount} min={0} max={0.2} step={0.005} format={(v) => `${(v * 100).toFixed(1)}%`} onChange={(v) => set({ discount: v })} />
              <Slider label="Share dilution per year" value={s.dilution} min={0} max={0.2} step={0.01} format={pctFmt} onChange={(v) => set({ dilution: v })} />
              <Slider label="IT MW per gross MW" value={s.conversion} min={0.5} max={0.9} step={0.01} format={(v) => v.toFixed(2)} hint="Helios, River Bend and Beacon Point sit at 0.67–0.74." onChange={(v) => set({ conversion: v })} />
            </div>
          </details>
        </div>

        <div className="card rail-ctl">
          <div className="eyebrow">How the number is built, end {s.year}</div>
          <div className="bridge">
            <div><span>Revenue run-rate</span><b>{usdCompact(revenue)}</b></div>
            <div><span>{gpu ? "Project EBITDA" : "NOI"}{revenue ? ` · ${Math.round((t.noi / revenue) * 100)}%` : ""}</span><b>{usdCompact(t.noi)}</b></div>
            {s.basis === "pe" ? (
              <>
                <div><span>Depreciation</span><b>−{usdCompact(t.da)}</b></div>
                <div><span>Interest on {Math.round(s.leverage * 100)}% debt</span><b>−{usdCompact(t.interest)}</b></div>
                <div><span>Tax</span><b>−{usdCompact(tax)}</b></div>
                <div className="total"><span>Earnings</span><b>{usdCompact(t.earnings)}</b></div>
              </>
            ) : (
              <div><span>Project debt</span><b>−{usdCompact(t.debt)}</b></div>
            )}
            <div><span>× {s.multiple} = equity value</span><b>{usdCompact(value.equity)}</b></div>
            <div><span>÷ {value.shares ? `${(value.shares / 1e6).toFixed(0)}M shares` : "shares"}</span><b>{px(value.futurePrice)}</b></div>
            <div className="total"><span>Discounted to today</span><b>{ok ? px(value.price) : "—"}</b></div>
          </div>
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
        </div>
      </aside>
      {!open ? (
        <div className="rail-mobile">
          <div>
            <div className="eyebrow">Implied today</div>
            <b>{ok ? px(value.price) : "—"}</b> {ok ? <Delta value={(value.upside ?? 0) * 100} digits={0} /> : null}
          </div>
          <button type="button" className="btn" onClick={() => setOpen(true)}>Adjust scenario</button>
        </div>
      ) : null}
    </>
  );
}
