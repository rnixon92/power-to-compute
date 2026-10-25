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
        <p>Company figures always win. Where a lease has no disclosed rent, the model uses your lease rate as a starting rent. The default, $125 per kW-month, is where the group&apos;s disclosed leases start. IREN sells compute, so uncontracted GPU-cloud capacity signs at a price per megawatt instead: $20M a year on a 3-year contract, the level IREN reports for its recent deals. Where IREN has not given a cost, the site pays for both the GPUs and the building, $34M plus $12M per megawatt. The GPU figure comes from the ~2-year payback IREN gives at $20M of revenue. The Childress air-cooled halls already stand, so they pay for GPUs only. The Microsoft halls stay at the disclosed $29M of GPUs. Missing margins and other build costs work the same way, and every row on a company page says which numbers are disclosed and which are yours.</p>

        <h2>Rent escalators</h2>
        <p>Most leases step their rent up each year. Hut 8 discloses 3% on River Bend and Beacon Point. TeraWulf says its leases escalate without giving the rate. Where a company is silent, the model uses your escalator, 3% by default. GPU cloud contracts stay flat.</p>
        <p>A disclosed contract value already includes those steps, so &quot;$19B over 20 years&quot; is an average of $950M a year that starts lower and ends higher. The model takes each disclosed average back to its first-year rent and grows it from there. Lake Mariner is the check: on TeraWulf&apos;s own terms, the model reaches about $716M of annual rent once fully ramped in early 2027.</p>

        <h2>From capacity to a share price</h2>
        <p>Each month the model adds up the capacity online, its rent and its NOI. Corporate overhead comes off, using each company&apos;s trailing twelve months, with stock-based pay counted unless you leave it out. Overhead is shared between the AI business and anything else the company runs, such as mining, by gross profit.</p>
        <p>The default for the landlords is a lease DCF. It takes every month of rent to 2050 on the sites switched on, after their share of overhead and tax, and subtracts build cost in the month it is spent. Each site is then sold at your exit cap rate in 2050, and everything comes back to today at your required return, 8% by default. The site-level rent rises with its escalator, so later years of a lease count in full.</p>
        <p>Most leases here run 10 to 20 years, shorter than the forecast. When a signed term ends, the model assumes the tenant renews and the rent carries on at its escalated level, which is why 2050 can reach past every lease. Each company page splits the value into rent over the signed terms, rent from renewals, and the 2050 sale, so you can see how much rests on contracts already signed. You can cut the rent at renewal, charge a refit cost each time a lease rolls, or switch to signed terms only: rent stops at each term&apos;s end, overhead stops when the last lease does, and each building is sold at its remaining book value as its lease ends. That last view is a floor. A 10-year lease at a 17% yield on cost returns about 11% before tax with nothing left at the end, and about 15% with the building kept at book value, so most of the equity value sits in renewals.</p>
        <p>Tax is charged month by month on NOI after overhead and tax depreciation, with losses carried forward against up to 80% of later profits, as US rules allow. The rate is the 21% federal rate plus state tax where each company&apos;s sites are, weighted by megawatts and deductible federally, using the Tax Foundation&apos;s 2026 top rates. Texas has no income tax, so its 0.75% margin tax stands in. Buildings depreciate over 39 years for tax, as US law sets for nonresidential property. You can write part of each landlord&apos;s build cost off up front: cooling, power and electrical gear qualifies for 100% bonus depreciation, which cost studies put at 20–40% of a data center. The default writes off 30%. It brings tax forward without removing it, so it moves values by a few percent at most. GPUs qualify for bonus depreciation in full, so IREN writes off new and replacement GPUs when it buys them. Each company&apos;s existing tax losses count too, at the tax value in its latest 10-K before any valuation allowance, net of the deferred tax on its property: where a company has already taken depreciation early, as Hut 8 and IREN have, that comes off. Galaxy is valued from book equity, which already includes them.</p>
        <p>The exit cap rate is the price a buyer pays for a site in 2050, written as a yield: the site&apos;s NOI divided by the cap rate. At 7%, a site sells for about 14 times its NOI. It works like the terminal value in any DCF. A required return of 8% and an exit cap of 7% imply about 1% growth after 2050, below the 3% rent escalator before then, which leaves room for an ageing building.</p>
        <p>The cap-rate option values the buildings the way a property analyst would. Each site&apos;s NOI, averaged over its lease with escalators, is divided by your cap rate once the site is fully online, then brought back to today at your required return. Build cost comes off as it is spent, NOI earned during the ramp-up is added, and overhead is capitalized at the same rate. Like a property valuation, it is pre-tax. Today&apos;s prices imply about a 10% cap rate for most of the group.</p>
        <p>Earnings and EBITDA value a single year instead: the end of the year you pick, brought back to today with the cash earned before then. </p>

        <h2>GPU cloud</h2>
        <p>IREN rents out GPUs, so it has its own method, a compute DCF. Each hall&apos;s GPUs are a batch with a life of their own. A batch earns its contract price for the contract&apos;s length: Microsoft pays $9.7M per megawatt a year for five years, and newer deals pay $20M for three. Once the contract ends, the batch keeps running at a share of that price, half by default, while power and running costs stay the same. When the GPUs reach the end of their life, six years by default, the hall buys new GPUs at your GPU cost and signs a new contract, or sits empty if you choose. Halls go live on different dates, so batches retire and get replaced every year rather than all at once.</p>
        <p>The cash from every batch, after overhead and tax and less the GPUs and halls as they are bought, is discounted at your required return, 10% by default, to 2050. After that the halls keep running and buying GPUs, and that steady cash is held flat. You can switch IREN to an earnings multiple instead. It uses the same contract and re-let path, valued at the end of one year.</p>
        <p>Sites with no signed tenant count at your chance of leasing, 50% by default, once you switch them on. Their rent and build cost both scale by that share, so a site adds its expected value. Each one is tagged with the share it counts at.</p>
        <p>Then the balance sheet, from each company&apos;s latest 10-Q. Cash, bitcoin at the live price and other assets are added. Debt, warrants, minority interests and preferred stock come off. So does the build cost still to spend on capacity running by your valuation year. Cost already spent is in the cash and debt. Mining and other businesses add a multiple of their gross profit after their share of overhead. Galaxy, a financial firm, is counted at book equity with Helios taken out at cost.</p>
        <p>What&apos;s left, divided by the share count grown at your dilution rate, is the implied price. Equity cannot fall below zero, so a negative result reads as &quot;Under $0&quot;.</p>

        <h2>Presets</h2>
        <p><b>Bear</b> keeps signed capacity only, pushes every future delivery out six months, cuts rents 15% and uses 14× earnings. <b>Base</b> is the default. <b>Bull</b> assumes sites with no tenant yet get leased on time, with rents up 10%, at 25×.</p>
      </div>
    </main>
  );
}
