export type ModelKind = "colo-lease" | "gpu-cloud" | "power-owner";

export type PhaseStatus =
  | "in-service"
  | "delivering"
  | "construction"
  | "contracted"
  | "planned"
  | "mining"
  | "pending-close"
  | "monetizing";

export type MwUnit = "critical-it" | "leased-power" | "gross" | "utility" | "nameplate";

/** How firm a block of capacity is. Drives the default switch state and the chart shading. */
export type Tier = "live" | "contracted" | "announced" | "pipeline";

export interface Source {
  id: string;
  title: string;
  url: string;
  asOf: string;
}

export interface Phase {
  id: string;
  name: string;
  mw?: number;
  unit: MwUnit;
  status: PhaseStatus;
  /** ISO date the company gave. */
  when?: string;
  tenant?: string;
  note?: string;
  source: string;
}

export interface Campus {
  id: string;
  name: string;
  place: string;
  state?: string;
  lat?: number;
  lng?: number;
  /** Total power the company describes for the site, any unit. */
  powerMw?: number;
  powerUnit?: MwUnit;
  note?: string;
  phases: Phase[];
}

/**
 * One block of capacity that can be switched in or out of the forecast.
 * Every dollar figure here is the company's, or arithmetic on the company's figures.
 * Anything missing is filled by a scenario assumption and labelled as such on screen.
 */
export interface Ramp {
  id: string;
  campus: string;
  label: string;
  tier: Tier;
  tenant?: string;
  mw: number;
  unit: "critical-it" | "leased-power" | "gross" | "utility";
  /** First capacity online. */
  start: string;
  /** Fully online. The forecast ramps linearly between start and full. */
  full?: string;
  /** Power is already connected and running at the site, so it could be leased without waiting on the grid. */
  energized?: boolean;
  /** "company" when both dates come from a disclosure, "estimate" when we placed them. */
  timing: "company" | "estimate";
  /** Annual revenue at full ramp. */
  revenue?: number;
  /** Annual NOI or project EBITDA at full ramp, when disclosed. */
  noi?: number;
  /** Disclosed margin on revenue, when NOI itself is not given. */
  margin?: number;
  termYears?: number;
  contractValue?: number;
  /** Annual rent escalator, when the company discloses it. Otherwise the scenario's rate applies. */
  escalator?: number;
  /**
   * What the disclosed revenue figure is. Most are the average over the term, such as contract value
   * divided by years. "first-year" means the rent the lease starts at.
   */
  rentBasis?: "average" | "first-year";
  capexPerMw?: number;
  capexTotal?: number;
  capexKind?: "shell" | "gpu" | "landlord";
  /** GPUs go into a building the company already has, so an undisclosed cost covers the GPUs only. */
  retrofit?: boolean;
  /** One line on where the build cost comes from. */
  capexNote?: string;
  source: string;
  note?: string;
}

export interface Deal {
  id: string;
  name: string;
  tenant: string;
  status: "live" | "contracted" | "planned" | "exited";
  itMw?: number;
  termYears?: number;
  contractValueUsd?: number;
  annualRevenueUsd?: number;
  annualNoiUsd?: number;
  note: string;
  source: string;
}

export interface BuildCost {
  id: string;
  label: string;
  kind: "shell" | "gpu" | "landlord-cash" | "generation" | "equity" | "sell-side";
  usdPerMw?: number;
  lowPerMw?: number;
  highPerMw?: number;
  totalUsd?: number;
  mw?: number;
  includes: string;
  note?: string;
  source: string;
}

export interface CapitalItem {
  id: string;
  kind: "committed" | "seeking" | "guarantee" | "derived";
  amountUsd?: number;
  asOf: string;
  label: string;
  note: string;
  source: string;
}

export interface BalanceLine {
  label: string;
  value: number;
  note?: string;
}

/**
 * The rest of the business, from the latest 10-Q or 10-K. Everything here is a reported
 * balance at `asOf`, except overhead and gross profit, which annualize the latest quarter.
 */
export interface Balance {
  asOf: string;
  source: string;
  /** Cash, equivalents and restricted cash. */
  cash: number;
  /** Bitcoin held, in coins, including any loaned or pledged. Valued at the live price. */
  bitcoin?: number;
  otherAssets?: BalanceLine[];
  /** Every borrowing, including convertible notes and finance leases, at carrying amount. */
  debt: number;
  debtNote: string;
  /** Annual interest cost on that debt, expensed and capitalized, from the latest quarter. Drives the tax saved on interest. */
  interest?: number;
  interestNote?: string;
  /** Other claims ahead of common shareholders: warrants, minority interests, preferred stock. */
  claims?: BalanceLine[];
  /**
   * For a financial firm whose book already marks its holdings: total equity replaces the cash,
   * bitcoin and debt lines, and the AI build cost already spent comes out of it.
   */
  bookEquity?: number;
  bookNote?: string;
  /** Annual corporate overhead: selling, general and administrative cost, latest quarter × 4. */
  overhead: number;
  /** The stock-based pay inside that overhead, annualized the same way. */
  stockPay: number;
  /** Tax value of loss carryforwards in the latest 10-K, before any valuation allowance. It shelters future tax, up to 80% of each year's. */
  taxLosses?: { value: number; asOf: string; filing: string };
  overheadNote: string;
  /** Operations outside the AI forecast, such as bitcoin mining, as annual gross profit before overhead. */
  other?: { label: string; grossProfit: number; note: string };
}

export type EventKind = "lease" | "financing" | "delivery" | "power" | "deal";

/** Something that changed the investment case, on the day it became public. */
export interface CompanyEvent {
  date: string;
  /** The filing gives a month only. Shown as the month, never as a day. */
  monthOnly?: boolean;
  kind: EventKind;
  title: string;
  detail?: string;
  source: string;
}

export interface Company {
  ticker: string;
  name: string;
  model: ModelKind;
  cik: number;
  /** Names sourced from filings count toward board totals. Watchlist names have a page only. */
  inBook: boolean;
  /** One or two sentences an investor reads first. */
  summary: string;
  reviewedAt: string;
  sources: Source[];
  campuses: Campus[];
  ramps: Ramp[];
  deals: Deal[];
  costs: BuildCost[];
  capital?: CapitalItem[];
  /** Business lines the HPC model leaves out, so the reader knows what else is in the share price. */
  outside?: string;
  balance?: Balance;
  events?: CompanyEvent[];
}

export interface DailyClose {
  date: string;
  close: number;
}

export interface StreetPoint {
  date: string;
  target: number;
}

export interface Quote {
  ticker: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  asOf: string | null;
  volume: number | null;
  marketCap: number | null;
  shares: number | null;
  week52High: number | null;
  week52Low: number | null;
  summaryTarget: number | null;
  streetMean: number | null;
  streetLow: number | null;
  streetHigh: number | null;
  buy: number | null;
  hold: number | null;
  sell: number | null;
  history: DailyClose[];
  streetHistory: StreetPoint[];
  error?: string;
}

export interface MarketBook {
  fetchedAt: string;
  source: string;
  stale: boolean;
  note: string;
  quotes: Quote[];
  /** Bitcoin spot price, for valuing coins on balance sheets. */
  btc?: { price: number; asOf: string } | null;
}
