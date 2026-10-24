# Power to Compute

An investor tracker for the bitcoin miners turning their power into AI data centers: IREN, TeraWulf, Galaxy, Core Scientific, Cipher, Applied Digital, Hut 8, MARA, Riot and CleanSpark.

It covers every site and phase, every signed lease, what each campus costs to build and how it's financed, each company's balance sheet, and a valuation you control. Switch any site on or off (including power with no tenant yet, at the chance of leasing you set), pick a lease DCF, a cap rate or a multiple, and every implied share price updates. Every scenario lives in the URL, so you can share it as a link.

**Live site:** https://rnixon92.github.io/power-to-compute/ — rebuilt hourly through the US trading day.

## Pages

| Route | What's on it |
| --- | --- |
| `/` | Group totals, capacity and revenue ramps stacked by company, a card per company, relative value (market cap per signed MW, implied price, and the return or cap rate today's price implies), a map of every site, and the latest deals. |
| `/companies/[ticker]` | The deep dive. A plain-English summary of what the market pays and what's left out, the price breakdown from leases to balance sheet, a chart of price, capacity and revenue on one timeline, every site with a switch for each phase, contracts, a deal timeline, build cost and debt, a five-year model and sources. |
| `/demand` | US data-center power forecasts side by side, grid queues at PJM, Dominion and ERCOT, usage growth, and the unsold power in the group. |
| `/method` | How the model works, in plain English. |

## Running it

```bash
nvm use            # Node 22
npm install
npm run refresh    # fetch prices and filings; the build needs them
npm run dev        # http://localhost:3000
```

| Script | |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Static export to `out/` |
| `npm test` | Model tests (Vitest) |
| `npm run typecheck` | TypeScript |
| `npm run check` | Both of the above |
| `npm run refresh` | Fetch prices (Nasdaq), bitcoin (Coinbase) and the latest SEC filings into `data/snapshots/` |

## How data flows

**Prices update on a schedule.** The site is static. `npm run refresh` pulls last sale, a rolling year of closes, market cap, 52-week range and Street targets from Nasdaq's public endpoints, bitcoin from Coinbase, and each company's latest SEC filing, into `data/snapshots/`. The build bakes those in. Locally, run `npm run refresh` to update the numbers on the dev server.

**The ledger is read by a person.** `data/ledger.ts` holds every company, campus, phase, ramp, contract, build cost and financing line, each tied to a source with a date. `lib/edgar.ts` checks SEC EDGAR for filings newer than each company's `reviewedAt` date and flags them on the company page. Numbers only change when someone reads the filing and edits the ledger.

**The model is yours.** `lib/forecast.ts` turns ramps into monthly capacity, revenue, NOI, depreciation, interest and earnings, then values the run-rate in the target year and discounts it back to today. `lib/scenario.ts` holds the assumptions, the Bear, Base and Bull presets, and the URL encoding.

## Updating the ledger

When a company files something new:

1. Add the filing to that company's `sources` with its date.
2. Update or add **ramps**. These drive the forecast. A ramp is one block of capacity:
   - `tier`: `live` (built and earning), `contracted` (tenant signed), `announced` (company-dated power with the tenant still open) or `pipeline` (power the company controls, timing estimated).
   - `mw` and `unit`. Gross and utility megawatts are converted to critical IT at the scenario's conversion factor.
   - `start`, optional `full`, and `timing: "company" | "estimate"`.
   - Whatever the company disclosed: `revenue`, `noi` or `margin`, `contractValue`, `termYears`, `capexPerMw` or `capexTotal`. Leave a field out and the scenario assumption fills it, with the gap labelled on screen.
3. Update `phases` on the campus so the site breakdown and map stay accurate. Phases are descriptive and don't drive the model.
4. Set `reviewedAt` to today.
5. Run `npm run check`. The tests confirm every ramp points to a real campus and source, IDs are unique, and the headline totals still hold.

Two rules keep the totals honest:

- **Count each megawatt once.** If a contract covers capacity already in a ramp (IREN's Microsoft deal sits inside its $4B ARR book), it goes in `deals` for display, never in a second ramp.
- **Company figures win.** Fill a gap with an assumption only when the company hasn't given a number.

## Deploying

The site is a static export hosted on GitHub Pages. `.github/workflows/deploy.yml` runs on every push to `main`, hourly through the US trading day on weekdays, and once daily. Each run refreshes prices and filings, tests, builds under the repo's subpath and publishes. Nasdaq prices are kept out of the repo: the last good snapshot sits in the Actions cache, and a run uses it if Nasdaq does not answer. The daily run commits the SEC filings snapshot, which also keeps the schedule from being paused.

To set up a fork: in **Settings › Pages**, set the source to **GitHub Actions**. That is all.

## Design

- **Palette.** Company colors use a fixed categorical palette. The eight slots were checked for colorblind separation in both themes, and the first three go to IREN, WULF and GLXY. Riot and CleanSpark share a neutral gray, always labeled with their tickers. Capacity tiers use a single-hue ordinal blue ramp, so "how firm" reads light to dark. See `lib/palette.ts` and the tokens in `app/globals.css`.
- **No dual axes.** Price, capacity and revenue each get their own pane on a shared timeline, with one crosshair across all three.
- **Light and dark** follow the system setting, with a toggle in the top bar.
- **Mobile.** The scenario panel turns into a bottom bar that opens as a sheet.

## Stack

Next.js 15 (App Router), React 19 and TypeScript. Charts are hand-built SVG using `d3-scale`, `d3-shape` and `d3-geo`, and the map uses `us-atlas`. Plain CSS with design tokens, no UI framework. Tests run on Vitest.

## Disclaimer

A research tool. Company figures are their own disclosures, including forward-looking ones. Implied prices are the viewer's assumptions applied to those figures. Not investment advice.

## License

Code: [MIT](LICENSE). Research data in `data/`: [CC BY 4.0](data/LICENSE.md). Share prices are fetched at build time from Nasdaq's public quote pages and are not part of this repository.
