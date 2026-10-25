"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { book } from "@/data/ledger";
import { disclosedLeaseRate } from "@/lib/forecast";
import { defaultScenario, scenarioChip, tierLabel, TIERS } from "@/lib/scenario";
import { useScenario } from "@/components/ScenarioProvider";
import { PresetPicker, TierToggles } from "@/components/ScenarioControls";
import { Segmented, Slider } from "@/components/ui";

const YEARS = [2026, 2027, 2028, 2029, 2030];

export function Assumptions({ btc }: { btc: { price: number; asOf: string } | null }) {
  const { scenario: s, set, replace, panel, closePanel } = useScenario();
  const onIren = usePathname().toLowerCase() === "/companies/iren";
  const [copied, setCopied] = useState(false);
  const leaseHint = disclosedLeaseRate(book, s);
  const chip = scenarioChip(s);
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const ramps = book.flatMap((c) => c.ramps);

  const dialog = useRef<HTMLElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);

  // Move focus into the drawer, keep Tab inside it, and hand focus back to the opener on close.
  useEffect(() => {
    if (!panel) return;
    const opener = document.activeElement as HTMLElement | null;
    closeBtn.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        closePanel();
        return;
      }
      if (e.key !== "Tab" || !dialog.current) return;
      const focusable = Array.from(dialog.current.querySelectorAll<HTMLElement>("button, input, summary, a[href], [tabindex]:not([tabindex='-1'])")).filter((el) => el.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      opener?.focus();
    };
  }, [panel, closePanel]);

  if (!panel) return null;

  const rate = (v: number, digits = 2) => `${(v * 100).toFixed(digits).replace(/\.?0+$/, "")}%`;
  const runRate = s.basis !== "dcf";
  const unsigned = s.tiers.announced || s.tiers.pipeline || s.on.length > 0;
  const sitesSummary = [
    TIERS.filter((t) => s.tiers[t]).map((t) => tierLabel[t].toLowerCase()).join(" + ") || "none",
    unsigned ? `unsigned at ${pct(s.leaseOdds)}` : null,
    s.slip ? `${s.slip} months late` : null,
  ].filter(Boolean).join(" · ");
  const methodSummary = s.basis === "dcf"
    ? `Lease DCF · ${rate(s.dcfRate)} return · ${rate(s.exitCap)} exit`
    : s.basis === "cap"
      ? `${rate(s.capRate, 1)} cap rate · ${rate(s.dcfRate)} return`
      : `${s.multiple}× ${s.basis === "pe" ? "earnings" : "EBITDA"} · end ${s.year}`;

  return (
    <div className="assume-root">
      <button type="button" className="assume-backdrop" aria-label="Close assumptions" onClick={closePanel} />
      <aside className="assume" role="dialog" aria-modal="true" aria-labelledby="assume-title" ref={dialog}>
        <div className="assume-head">
          <div>
            <h2 id="assume-title">Assumptions</h2>
            <p className="note">One scenario across every company. The page behind updates as you move these.</p>
          </div>
          <button type="button" className="btn ghost" onClick={closePanel} ref={closeBtn}>Close</button>
        </div>

        <div className="assume-row">
          <PresetPicker />
          <button type="button" className="btn ghost" onClick={() => replace({ ...defaultScenario })}>Reset</button>
        </div>
        <p className="note assume-now">{chip.main} · {chip.scope}</p>

        <Section title="Sites counted" summary={sitesSummary} open>
          <TierToggles ramps={ramps} />
          <Slider label="Chance unsigned power gets leased" value={s.leaseOdds} min={0} max={1} step={0.05} format={pct} hint="Applies to sites with no tenant yet and future options you switch on. Their rent and build cost count at this share." onChange={(v) => set({ leaseOdds: v })} />
          <Slider label="Delay on future deliveries" value={s.slip} min={0} max={24} format={(v) => (v ? `${v} months` : "On schedule")} onChange={(v) => set({ slip: v })} />
        </Section>

        <Section title="Valuation" summary={methodSummary} open>
          <Segmented label="Valuation method" size="sm" value={s.basis} onChange={(b) => set({ basis: b })} options={[{ value: "dcf", label: "Lease DCF" }, { value: "cap", label: "Cap rate" }, { value: "pe", label: "Earnings" }, { value: "ebitda", label: "EBITDA" }]} />
          {s.basis === "dcf" ? (
            <>
              <p className="note">Every month of rent over each lease, after overhead and tax, less build cost as it is spent. Each site is sold at the exit cap rate in 2050.</p>
              <Slider label="Required return" value={s.dcfRate} min={0.05} max={0.14} step={0.0025} format={(v) => rate(v)} hint="Investment-grade project debt here costs 6–7.75%. Equity asks more." onChange={(v) => set({ dcfRate: v })} />
              <Slider label="Exit cap rate, 2050" value={s.exitCap} min={0.05} max={0.1} step={0.0025} format={(v) => rate(v)} hint="What a powered, leased site sells for at the end. Higher is more cautious." onChange={(v) => set({ exitCap: v })} />
            </>
          ) : s.basis === "cap" ? (
            <>
              <p className="note">Each site&apos;s average NOI over its lease, divided by the cap rate once the site is fully online, less build cost as it is spent. Pre-tax, like a property valuation.</p>
              <Slider label="Cap rate" value={s.capRate} min={0.05} max={0.12} step={0.001} format={(v) => rate(v, 1)} hint="Morgan Stanley uses 6.7% for Hut 8. Today's prices imply about 10% for most of the group." onChange={(v) => set({ capRate: v })} />
              <Slider label="Required return" value={s.dcfRate} min={0.05} max={0.14} step={0.0025} format={(v) => rate(v)} hint="Brings each site's value back from the date it is fully online." onChange={(v) => set({ dcfRate: v })} />
            </>
          ) : (
            <>
              <p className="note">One year&apos;s run-rate, valued and brought back to today with the cash earned before then. A quick cross-check.</p>
              <Slider label="Multiple" value={s.multiple} min={6} max={40} format={(v) => `${v}×`} onChange={(v) => set({ multiple: v })} />
              <YearPicker value={s.year} onChange={(y) => set({ year: y })} />
              <Slider label="Discount rate" value={s.discount} min={0} max={0.2} step={0.005} format={(v) => rate(v, 1)} onChange={(v) => set({ discount: v })} />
            </>
          )}
        </Section>

        <Section title="Rents and costs" summary={`$${s.leaseRate}/kW·mo · rising ${rate(s.escalator)} · $${s.buildCost}M/MW`}>
          <p className="note">Used only where a lease has no disclosed figure. Company numbers always come first.</p>
          <Slider label="Starting lease rate" value={s.leaseRate} min={80} max={300} step={5} format={(v) => `$${v}/kW·mo`} hint={`Disclosed leases in the group start at about $${Math.round(leaseHint)}/kW·mo.`} onChange={(v) => set({ leaseRate: v })} />
          <Slider label="Rent escalator" value={s.escalator} min={0} max={0.06} step={0.0025} format={(v) => `${rate(v)} a year`} hint="Hut 8 discloses 3%. Hyperscale leases usually step up 2–4% a year." onChange={(v) => set({ escalator: v })} />
          <Slider label="NOI margin" value={s.coloMargin} min={0.5} max={0.98} step={0.01} format={pct} hint="Galaxy reports 90%+, Core Scientific 80–85%, TeraWulf 85%." onChange={(v) => set({ coloMargin: v })} />
          <Slider label="Build cost, where undisclosed" value={s.buildCost} min={5} max={20} step={0.5} format={(v) => `$${v}M/MW`} hint="Default $12M. TeraWulf guides $8–10M, Hut 8 $9–11M, Galaxy built at $13.5M. A company figure replaces this." onChange={(v) => set({ buildCost: v })} />
          <Slider label="Building depreciation life" value={s.shellLife} min={10} max={40} format={(v) => `${v} years`} onChange={(v) => set({ shellLife: v })} />
        </Section>

        <Section title="Rest of the company" summary={`Stock pay ${s.stockPay ? "counted" : "left out"} · mining ${s.otherMultiple ? `${s.otherMultiple}×` : "off"}`}>
          <p className="note">Cash, bitcoin, debt and other claims come from each company&apos;s latest 10-Q. Overhead is shared between the AI business and anything else by gross profit.</p>
          <div style={{ display: "grid", gap: 8 }}>
            <div className="slider-top"><span>Stock-based pay</span></div>
            <Segmented label="Stock-based pay" size="sm" value={s.stockPay ? "count" : "skip"} onChange={(v) => set({ stockPay: v === "count" })} options={[{ value: "count", label: "Count as a cost" }, { value: "skip", label: "Leave it out" }]} />
            <small className="note">A real cost to shareholders, paid in new shares. Several of these companies pay $100M+ a year this way. Most sell-side models leave it out.</small>
          </div>
          <Slider label="Mining and other businesses" value={s.otherMultiple} min={0} max={10} step={0.5} format={(v) => (v ? `${v}× gross profit` : "Not counted")} hint="On annual gross profit after the business's share of overhead. A business that loses money counts as zero." onChange={(v) => set({ otherMultiple: v })} />
          <p className="note">Bitcoin is valued at {btc ? `$${Math.round(btc.price).toLocaleString("en-US")}, from Coinbase when the site was built` : "the June 30 price of $58,540"}.</p>
        </Section>

        <Section title="IREN, GPU cloud" summary={s.gpuMethod === "dcf" ? `Compute DCF ${rate(s.gpuReturn)} · $${s.gpuRate}M/MW new · ${s.gpuLife}-year GPUs` : `${s.multiple}× earnings · end ${s.year} · $${s.gpuRate}M/MW new`} open={onIren}>
          <Segmented label="GPU cloud method" size="sm" value={s.gpuMethod} onChange={(v) => set({ gpuMethod: v })} options={[{ value: "dcf", label: "Compute DCF" }, { value: "pe", label: "Earnings" }]} />
          {s.gpuMethod === "dcf" ? (
            <>
              <p className="note">Each batch of GPUs earns its contract, keeps running at a lower price once the contract ends, and retires at the end of its life. Halls come online on different dates, so GPUs are bought and retired every year.</p>
              <Slider label="Required return" value={s.gpuReturn} min={0.06} max={0.2} step={0.0025} format={(v) => rate(v)} hint="GPU contracts are shorter and riskier than leases, so this sits above the lease return." onChange={(v) => set({ gpuReturn: v })} />
            </>
          ) : (
            <>
              <p className="note">One year&apos;s earnings at a multiple, with the same contract, re-let and refill path as the DCF.</p>
              <Slider label="Earnings multiple" value={s.multiple} min={6} max={40} format={(v) => `${v}×`} onChange={(v) => set({ multiple: v })} />
              <YearPicker value={s.year} onChange={(y) => set({ year: y })} />
            </>
          )}
          <Slider label="Price on new contracts" value={s.gpuRate} min={3} max={30} step={0.5} format={(v) => `$${v.toFixed(1)}M/MW·yr`} hint="IREN's recent 3-year contracts are above $20M per MW a year, with talks near $25M. Used for capacity with no contract yet and for refilled halls." onChange={(v) => set({ gpuRate: v })} />
          <Slider label="New contract length" value={s.gpuTerm} min={1} max={7} format={(v) => `${v} year${v === 1 ? "" : "s"}`} hint="Recent IREN contracts run 3 years. Microsoft's runs 5." onChange={(v) => set({ gpuTerm: v })} />
          <Slider label="Price once the contract ends, share of it" value={s.gpuRelet} min={0} max={1} step={0.05} format={pct} hint="Older GPUs keep running at a lower price. IREN says prices for older generations have been climbing." onChange={(v) => set({ gpuRelet: v })} />
          <Slider label="GPU useful life" value={s.gpuLife} min={3} max={10} format={(v) => `${v} years`} hint="When a batch retires. CoreWeave depreciates its GPUs over six years." onChange={(v) => set({ gpuLife: v })} />
          <div style={{ display: "grid", gap: 8 }}>
            <div className="slider-top"><span>When GPUs retire</span></div>
            <Segmented label="When GPUs retire" size="sm" value={s.gpuRefresh ? "refill" : "empty"} onChange={(v) => set({ gpuRefresh: v === "refill" })} options={[{ value: "refill", label: "Buy new GPUs" }, { value: "empty", label: "Leave the hall empty" }]} />
            <small className="note">New GPUs cost the GPU figure below and sign at the new contract price.</small>
          </div>
          <Slider label="Project EBITDA margin" value={s.gpuMargin} min={0.3} max={0.95} step={0.01} format={pct} hint="IREN targets 85% on the Microsoft contract. Running costs stay the same after a contract ends, so the margin narrows." onChange={(v) => set({ gpuMargin: v })} />
          <Slider label="GPU cost, where undisclosed" value={s.gpuCost} min={10} max={60} format={(v) => `$${v}M/MW`} hint={`IREN's ~2-year payback at $20M of revenue points to about $34M. New halls add the $${s.buildCost}M building cost. The Microsoft contract stays at its disclosed $29M of GPUs.`} onChange={(v) => set({ gpuCost: v })} />
        </Section>

        <Section title="Financing and details" summary={`${pct(s.leverage)} debt at ${rate(s.interest)} · tax ${pct(s.tax)}`}>
          <p className="note">The build debt, tax and share count behind the earnings figures.</p>
          <Slider label="Debt share of build" value={s.leverage} min={0} max={0.9} step={0.05} format={pct} onChange={(v) => set({ leverage: v })} />
          <Slider label="Interest rate" value={s.interest} min={0.03} max={0.14} step={0.0025} format={(v) => rate(v)} onChange={(v) => set({ interest: v })} />
          <Slider label="Tax rate" value={s.tax} min={0} max={0.3} step={0.01} format={pct} onChange={(v) => set({ tax: v })} />
          <Slider label="Share dilution per year" value={s.dilution} min={0} max={0.2} step={0.01} format={pct} onChange={(v) => set({ dilution: v })} />
          <Slider label="IT MW per gross MW" value={s.conversion} min={0.5} max={0.9} step={0.01} format={(v) => v.toFixed(2)} hint="Helios, River Bend and Beacon Point sit at 0.67–0.74." onChange={(v) => set({ conversion: v })} />
        </Section>

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

/** A collapsible group. Its header shows the current values, so a closed section still reads at a glance. */
function Section({ title, summary, open, children }: { title: string; summary: string; open?: boolean; children: React.ReactNode }) {
  return (
    <details className="assume-sec" open={open}>
      <summary>
        <span className="assume-sec-title">{title}</span>
        <span className="assume-sec-sum">{summary}</span>
        <svg className="chev" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
      </summary>
      <div className="assume-sec-body">{children}</div>
    </details>
  );
}

function YearPicker({ value, onChange }: { value: number; onChange: (y: number) => void }) {
  return (
    <div>
      <div className="slider-top" style={{ marginBottom: 8 }}><span>Value the run-rate at the end of</span></div>
      <Segmented label="Valuation year" size="sm" value={value} onChange={onChange} options={YEARS.map((y) => ({ value: y, label: String(y) }))} />
    </div>
  );
}
