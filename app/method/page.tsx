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
        <p><b>In service</b> is built and earning. <b>Signed</b> has a tenant and is still being built or handed over. <b>No tenant yet</b> has power and a date from the company, and still needs a lease. <b>Future option</b> is power the company controls, on a timeline we estimate. The first two are on by default, and each company page lists what the other two would add.</p>

        <h2>Units</h2>
        <p>The model works in critical IT megawatts, the power available to servers. Where a company quotes gross or utility power, the model converts it at 0.70 IT MW per gross MW. Helios, River Bend, Beacon Point and Polaris Forge 3 all sit between 0.67 and 0.74. You can change the factor.</p>

        <h2>Filling the gaps</h2>
        <p>Company figures always win. Where a lease has no disclosed rent, the model uses your lease rate as a starting rent. The default, $125 per kW-month, is where the group&apos;s disclosed leases start. IREN sells compute, so uncontracted GPU-cloud capacity uses revenue per megawatt instead: $16M a year. IREN reports recent 3-year contracts above $20M per MW, and the default spreads that over a GPU&apos;s five years, with the last two re-let near the $9.7M Microsoft pays. Where IREN has not given a cost, the site pays for both the GPUs and the building, $34M plus $12M per megawatt. The GPU figure comes from the ~2-year payback IREN gives at $20M of revenue. The Childress air-cooled halls already stand, so they pay for GPUs only. The Microsoft halls stay at the disclosed $29M of GPUs. Missing margins and other build costs work the same way, and every row on a company page says which numbers are disclosed and which are yours.</p>

        <h2>Rent escalators</h2>
        <p>Most leases step their rent up each year. Hut 8 discloses 3% on River Bend and Beacon Point. TeraWulf says its leases escalate without giving the rate. Where a company is silent, the model uses your escalator, 3% by default. GPU cloud contracts stay flat.</p>
        <p>A disclosed contract value already includes those steps, so &quot;$19B over 20 years&quot; is an average of $950M a year that starts lower and ends higher. The model takes each disclosed average back to its first-year rent and grows it from there. Lake Mariner is the check: on TeraWulf&apos;s own terms, the model reaches about $716M of annual rent once fully ramped in early 2027.</p>

        <h2>From capacity to a share price</h2>
        <p>Each month the model adds up the capacity online, its rent and its NOI. Corporate overhead comes off, using each company&apos;s trailing twelve months, with stock-based pay counted unless you leave it out. Overhead is shared between the AI business and anything else the company runs, such as mining, by gross profit.</p>
        <p>The default for the landlords is a lease DCF. It takes every month of rent to 2050 on the sites switched on, after their share of overhead and tax, and subtracts build cost in the month it is spent. Each site is then sold at your exit cap rate in 2050, and everything comes back to today at your required return, 8% by default. The site-level rent rises with its escalator, so later years of a lease count in full.</p>
        <p>The cap-rate option values the buildings the way a property analyst would. Each site&apos;s NOI, averaged over its lease with escalators, is divided by your cap rate once the site is fully online, then brought back to today at your required return. Build cost comes off as it is spent, NOI earned during the ramp-up is added, and overhead is capitalized at the same rate. Like a property valuation, it is pre-tax. Today&apos;s prices imply about a 10% cap rate for most of the group.</p>
        <p>Earnings and EBITDA value a single year instead: the end of the year you pick, brought back to today with the cash earned before then. IREN sells compute on five-year contracts, so it stays on an earnings multiple under every option.</p>
        <p>Sites with no signed tenant count at your chance of leasing, 50% by default, once you switch them on. Their rent and build cost both scale by that share, so a site adds its expected value. Each one is tagged with the share it counts at.</p>
        <p>Then the balance sheet, from each company&apos;s latest 10-Q. Cash, bitcoin at the live price and other assets are added. Debt, warrants, minority interests and preferred stock come off. So does the build cost still to spend on capacity running by your valuation year. Cost already spent is in the cash and debt. Mining and other businesses add a multiple of their gross profit after their share of overhead. Galaxy, a financial firm, is counted at book equity with Helios taken out at cost.</p>
        <p>What&apos;s left, divided by the share count grown at your dilution rate, is the implied price. Equity cannot fall below zero, so a negative result reads as &quot;Under $0&quot;.</p>

        <h2>Presets</h2>
        <p><b>Bear</b> keeps signed capacity only, pushes every future delivery out six months, cuts rents 15% and uses 14× earnings. <b>Base</b> is the default. <b>Bull</b> assumes sites with no tenant yet get leased on time, with rents up 10%, at 25×.</p>
      </div>
    </main>
  );
}
