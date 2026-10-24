# Power to Compute

An investor tracker for the bitcoin miners turning their power into AI data centers: IREN, TeraWulf, Galaxy, Core Scientific, Cipher, Applied Digital, Hut 8 and MARA, with Riot and CleanSpark on a watchlist.

It covers every site and phase, every signed lease, what each campus costs to build and how it's financed, and a forecast you control. Switch any site on or off (including announced sites with no tenant yet), set the lease rate, multiple and delays, and the implied share price updates. Every scenario lives in the URL, so you can share it as a link.

## Pages

| Route | What's on it |
| --- | --- |
| `/` | Group totals, capacity and revenue ramps stacked by company, a card per company, relative value (market cap per signed MW, implied price vs last), and a map of every site. |
| `/companies/[ticker]` | The deep dive. One chart with price history and implied value, capacity online and revenue run-rate on a shared timeline. Then a breakdown of each site with a switch for every phase, plus contracts, build cost, debt, a five-year model and sources. The scenario panel stays on screen as you scroll. |
| `/demand` | US data-center power forecasts from EPRI, LBNL, Goldman Sachs and S&P side by side, the gap between scheduled and built capacity, and OpenRouter token growth. |
| `/method` | How the model works, in plain English. |

## Running it

```bash
nvm use            # Node 22
npm install
npm run dev        # http://localhost:3000
```

| Script | |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build and server |
| `npm test` | Model tests (Vitest) |
| `npm run typecheck` | TypeScript |
| `npm run check` | Both of the above |
| `npm run refresh` | Pull fresh prices from Nasdaq into `data/snapshots/market.json` |

## How data flows

**Prices update on their own.** `lib/nasdaq.ts` pulls last sale, a rolling year of closes, market cap, 52-week range and Street targets from Nasdaq's public endpoints. `lib/market.ts` holds a pull for 15 minutes and falls back to the saved snapshot if Nasdaq is slow. The `refresh-market` GitHub Action saves a new snapshot after each weekday close.

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

## Design

- **Palette.** Company colors use a fixed eight-slot categorical palette, checked for colorblind separation in both themes. The first three slots go to IREN, WULF and GLXY. Capacity tiers use a single-hue ordinal blue ramp, so "how firm" reads light to dark. See `lib/palette.ts` and the tokens in `app/globals.css`.
- **No dual axes.** Price, capacity and revenue each get their own pane on a shared timeline, with one crosshair across all three.
- **Light and dark** follow the system setting, with a toggle in the top bar.
- **Mobile.** The scenario panel turns into a bottom bar that opens as a sheet.

## Stack

Next.js 15 (App Router), React 19 and TypeScript. Charts are hand-built SVG using `d3-scale`, `d3-shape` and `d3-geo`, and the map uses `us-atlas`. Plain CSS with design tokens, no UI framework. Tests run on Vitest.

## Disclaimer

A research tool. Company figures are their own disclosures, including forward-looking ones. Implied prices are the viewer's assumptions applied to those figures. Not investment advice.
