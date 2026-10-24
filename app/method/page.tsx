import type { Metadata } from "next";

export const metadata: Metadata = { title: "Method — Power to Compute" };

export default function MethodPage() {
  return (
    <main className="wrap">
      <section className="hero prose">
        <h1>How it works</h1>
        <p className="lede">Three layers: prices that update on their own, a ledger someone reads from filings, and a model you control.</p>
      </section>
      <div className="prose">
        <h2>Prices</h2>
        <p>Last sale, a year of daily closes, market cap, the 52-week range and the Street target all come from Nasdaq&apos;s public quote pages. The server reuses a pull for fifteen minutes, and a weekday job saves a snapshot after the close. Share count is market cap divided by price.</p>

        <h2>The ledger</h2>
        <p>Sites, phases, tenants, rents, build costs and debt live in one hand-reviewed file, each with a source and a review date. When a company files a new 8-K, 10-Q or 10-K, the page flags it. Numbers change only once someone reads the filing.</p>
        <p>Every phase that can earn money is a ramp: a block of capacity with a start date, a date it&apos;s fully online, and whatever the company has said about rent, margin and cost. Ramps sit in four groups.</p>
        <p><b>In service</b> is built and earning. <b>Signed</b> has a tenant and is still being built or handed over. <b>Announced</b> has power and a date from the company, with the tenant still open. <b>Pipeline</b> is power the company controls, on a timeline we estimate. The first two are on by default.</p>

        <h2>Units</h2>
        <p>The model works in critical IT megawatts, the power available to servers. Where a company quotes gross or utility power, the model converts it at 0.70 IT MW per gross MW. Helios, River Bend, Beacon Point and Polaris Forge 3 all sit between 0.67 and 0.74. You can change the factor.</p>

        <h2>Filling the gaps</h2>
        <p>Company figures always win. Where a lease has no disclosed rent, the model uses your lease rate. The default, $155 per kW-month, is the weighted average of the disclosed leases in the group. GPU cloud capacity uses revenue per megawatt instead. The default, $9.7M a year, comes from IREN&apos;s Microsoft contract. Missing margins and build costs work the same way, and every row on a company page says which numbers are disclosed and which are yours.</p>

        <h2>From capacity to a share price</h2>
        <p>Each month the model adds up the capacity online, its revenue and its NOI. Depreciation runs on build cost over 25 years for buildings and 5 for GPUs. Interest is charged on the debt share of build cost, then tax on what&apos;s left.</p>
        <p>The implied price takes the run-rate at the end of the year you pick, applies your multiple to earnings or EBITDA, divides by the share count grown at your dilution rate, and discounts back to today. On the EBITDA basis, project debt comes off before dividing.</p>
        <p>The model values the AI data-center business only. Bitcoin mining, coin holdings, cash and other assets sit outside it, and each company page names what&apos;s left out. For MARA, which has no signed AI lease yet, that&apos;s most of the share price.</p>

        <h2>Presets</h2>
        <p><b>Bear</b> keeps signed capacity only, pushes every future delivery out six months, cuts rents 15% and uses 14× earnings. <b>Base</b> is the default. <b>Bull</b> assumes announced sites are leased on time, with rents up 10%, at 25×.</p>
      </div>
    </main>
  );
}
