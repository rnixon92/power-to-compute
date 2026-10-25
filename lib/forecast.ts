import { BTC_JUN30 } from "@/data/ledger";
import type { Company, MarketBook, Quote, Ramp, Tier } from "@/data/types";
import { appliedBasis, TIERS, type Scenario } from "@/lib/scenario";

/** The build date on the static site, so every page agrees. Falls back to the clock in tests and scripts. */
export const TODAY = process.env.NEXT_PUBLIC_TODAY || new Date().toISOString().slice(0, 10);
export const HORIZON_END = "2030-12-31";

const DAY = 86_400_000;
const YEAR = 365.25 * DAY;

/** A ramp with every number the forecast needs, and where each number came from. */
export interface Block {
  ramp: Ramp;
  ticker: string;
  enabled: boolean;
  itMw: number;
  start: number;
  full: number;
  revenue: number;
  revenueFrom: "company" | "rate";
  noi: number;
  noiFrom: "company" | "company margin" | "assumed margin";
  capex: number;
  capexFrom: "company" | "assumed";
  capexKind: "shell" | "gpu" | "landlord";
  life: number;
  /** Annual rent escalator applied from rent start. Zero for GPU cloud. */
  escalator: number;
  escalatorFrom: "company" | "assumed" | "none";
  /** Divides an average-over-term rent down to the first year's rent. 1 when the figure is already a first-year rent. */
  averageFactor: number;
  /** Share of this block's money that counts: your lease odds for sites with no signed tenant, 1 otherwise. */
  weight: number;
}

/** Average of (1 + g)^k over a term of T years. A rent quoted as the term average is this many times the first year's rent. */
export function averageFactor(g: number, years: number): number {
  if (g <= 0 || years <= 1) return 1;
  return (Math.pow(1 + g, years) - 1) / (g * years);
}

/** Rent and NOI at time t, relative to the figure on the block: grows from rent start, starting below the average. */
export function rentScale(b: Block, t: number): number {
  if (!b.escalator) return 1;
  const years = Math.max(0, (t - b.start) / YEAR);
  return Math.pow(1 + b.escalator, years) / b.averageFactor;
}

export function itMw(ramp: Ramp, s: Scenario): number {
  return ramp.unit === "gross" || ramp.unit === "utility" ? ramp.mw * s.conversion : ramp.mw;
}

export function isEnabled(ramp: Ramp, s: Scenario): boolean {
  if (s.on.includes(ramp.id)) return true;
  if (s.off.includes(ramp.id)) return false;
  return s.tiers[ramp.tier];
}

function shift(iso: string, months: number): number {
  const t = Date.parse(iso);
  if (!months || iso <= TODAY) return t;
  const d = new Date(t);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.getTime();
}

export function block(company: Company, ramp: Ramp, s: Scenario): Block {
  const gpu = company.model === "gpu-cloud";
  const mw = itMw(ramp, s);
  const revenue = ramp.revenue ?? (gpu ? mw * s.gpuRate * 1e6 : mw * 1000 * s.leaseRate * 12);
  let noi: number;
  let noiFrom: Block["noiFrom"];
  if (ramp.noi != null) {
    noi = ramp.noi;
    noiFrom = "company";
  } else if (ramp.margin != null) {
    noi = revenue * ramp.margin;
    noiFrom = "company margin";
  } else {
    noi = revenue * (gpu ? s.gpuMargin : s.coloMargin);
    noiFrom = "assumed margin";
  }
  const kind = ramp.capexKind ?? (gpu ? "gpu" : "shell");
  let capex: number;
  let capexFrom: Block["capexFrom"];
  let life = kind === "gpu" ? s.gpuLife : s.shellLife;
  if (ramp.capexTotal != null) {
    capex = ramp.capexTotal;
    capexFrom = "company";
  } else if (ramp.capexPerMw != null) {
    capex = ramp.capexPerMw * mw;
    capexFrom = "company";
  } else if (kind === "gpu") {
    // IREN builds the hall and buys the GPUs. A disclosed GPU price stays as published. An undisclosed site pays for both.
    const gpuCapex = s.gpuCost * 1e6 * mw;
    const shellCapex = s.buildCost * 1e6 * mw;
    capex = gpuCapex + shellCapex;
    life = capex / (gpuCapex / s.gpuLife + shellCapex / s.shellLife);
    capexFrom = "assumed";
  } else {
    capex = s.buildCost * 1e6 * mw;
    capexFrom = "assumed";
  }
  const start = shift(ramp.start, s.slip);
  const full = Math.max(start, shift(ramp.full ?? ramp.start, s.slip));
  const escalator = gpu ? 0 : ramp.escalator ?? s.escalator;
  const escalatorFrom: Block["escalatorFrom"] = gpu ? "none" : ramp.escalator != null ? "company" : "assumed";
  // A disclosed contract figure is an average over the term unless the ledger says otherwise. Our lease rate is a starting rent.
  const basis = ramp.rentBasis ?? (ramp.revenue != null || ramp.noi != null ? "average" : "first-year");
  return {
    ramp,
    ticker: company.ticker,
    enabled: isEnabled(ramp, s),
    itMw: mw,
    start,
    full,
    revenue,
    revenueFrom: ramp.revenue != null ? "company" : "rate",
    noi,
    noiFrom,
    capex,
    capexFrom,
    capexKind: kind,
    life,
    escalator,
    escalatorFrom,
    averageFactor: basis === "average" ? averageFactor(escalator, ramp.termYears ?? 15) : 1,
    weight: ramp.tier === "announced" || ramp.tier === "pipeline" ? s.leaseOdds : 1,
  };
}

export function blocks(company: Company, s: Scenario): Block[] {
  return company.ramps.map((r) => block(company, r, s));
}

/** Share of a block online at time t, ramping linearly from start to full. */
export function online(b: Block, t: number): number {
  if (t < b.start) return 0;
  if (t >= b.full || b.full === b.start) return 1;
  return (t - b.start) / (b.full - b.start);
}

export interface Point {
  t: number;
  mw: Record<Tier, number>;
  revenue: Record<Tier, number>;
  /** Totals across every ramp, switched on or not. Drawn as the ceiling line. */
  mwAll: number;
  revenueAll: number;
  noi: number;
  da: number;
  interest: number;
  debt: number;
  earnings: number;
}

const zeroTiers = (): Record<Tier, number> => ({ live: 0, contracted: 0, announced: 0, pipeline: 0 });

export function pointAt(list: Block[], s: Scenario, t: number): Point {
  const mw = zeroTiers();
  const revenue = zeroTiers();
  let mwAll = 0;
  let revenueAll = 0;
  let noi = 0;
  let da = 0;
  let interest = 0;
  let debt = 0;
  for (const b of list) {
    const f = online(b, t);
    if (!f) continue;
    const k = rentScale(b, t);
    mwAll += f * b.itMw;
    revenueAll += f * b.revenue * k;
    if (!b.enabled) continue;
    const w = f * b.weight;
    mw[b.ramp.tier] += f * b.itMw;
    revenue[b.ramp.tier] += w * b.revenue * k;
    noi += w * b.noi * k;
    da += (w * b.capex) / b.life;
    const d = w * b.capex * s.leverage;
    debt += d;
    interest += d * s.interest;
  }
  const pretax = noi - da - interest;
  const earnings = pretax > 0 ? pretax * (1 - s.tax) : pretax;
  return { t, mw, revenue, mwAll, revenueAll, noi, da, interest, debt, earnings };
}

export function sumTiers(r: Record<Tier, number>): number {
  return TIERS.reduce((acc, t) => acc + r[t], 0);
}

/** Monthly points from Jan 2026 to the horizon. */
export function series(list: Block[], s: Scenario, from = "2026-01-01"): Point[] {
  const out: Point[] = [];
  const d = new Date(Date.parse(from));
  const end = Date.parse(HORIZON_END);
  while (d.getTime() <= end) {
    out.push(pointAt(list, s, d.getTime()));
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return out;
}

export function sharesAt(shares: number, t: number, s: Scenario): number {
  const years = Math.max(0, (t - Date.parse(TODAY)) / YEAR);
  return shares * Math.pow(1 + s.dilution, years);
}

/** What a valuation needs from the market: the company's quote and the bitcoin price. */
export interface Ctx {
  quote?: Quote;
  btc: number;
}

export function ctxFor(market: MarketBook, ticker: string): Ctx {
  return { quote: market.quotes.find((q) => q.ticker === ticker), btc: market.btc?.price ?? BTC_JUN30 };
}

/** Build spend runs from a year before first capacity until the block is fully online. */
const BUILD_LEAD = 12;

export function spentShare(b: Block, t: number): number {
  const d = new Date(b.start);
  d.setUTCMonth(d.getUTCMonth() - BUILD_LEAD);
  const from = d.getTime();
  if (t <= from) return 0;
  if (t >= b.full) return 1;
  return (t - from) / (b.full - from);
}

export function overheadOf(company: Company, s: Scenario): number {
  const b = company.balance;
  if (!b) return 0;
  return b.overhead - (s.stockPay ? 0 : b.stockPay);
}

export interface AiValue {
  /** Value of the AI business at the point's date, before the balance sheet. */
  ev: number;
  /** NOI after the AI share of overhead. */
  noi: number;
  overheadAi: number;
  overheadOther: number;
  /** Earnings after the AI share of overhead, interest, depreciation and tax. */
  earnings: number;
  /** Businesses outside the AI forecast, at your multiple on gross profit after their share of overhead. */
  otherValue: number;
}

/**
 * Overhead is shared between the AI business and other operations by gross profit,
 * so a mining-heavy company is not charged its whole head office against a small AI book.
 */
export function aiValueAt(company: Company, p: Point, s: Scenario): AiValue {
  const overhead = overheadOf(company, s);
  const gp = Math.max(0, company.balance?.other?.grossProfit ?? 0);
  const aiShare = p.noi > 0 ? p.noi / (p.noi + gp) : gp > 0 ? 0 : 1;
  const overheadAi = overhead * aiShare;
  const overheadOther = overhead - overheadAi;
  const noi = p.noi - overheadAi;
  const pretax = noi - p.da - p.interest;
  const earnings = pretax > 0 ? pretax * (1 - s.tax) : pretax;
  const basis = appliedBasis(company.model, s);
  const ev =
    basis === "cap" ? noi / s.capRate
    : basis === "dcf" ? noi / s.exitCap
    : basis === "ebitda" ? noi * s.multiple
    : earnings * s.multiple + p.debt;
  const otherValue = s.otherMultiple * Math.max(0, (company.balance?.other?.grossProfit ?? 0) - overheadOther);
  return { ev, noi, overheadAi, overheadOther, earnings, otherValue };
}

export interface BridgeLine {
  label: string;
  value: number;
  note?: string;
}

export interface Bridge {
  lines: BridgeLine[];
  /** Sum of the lines: what sits between the AI business and the equity, today. */
  net: number;
  remaining: number;
}

/**
 * From the AI business to the equity, using today's balance sheet.
 * Build cost already spent sits in the cash and debt figures, so only the part still to spend comes off.
 */
export function bridge(company: Company, list: Block[], ctx: Ctx, at: number): Bridge {
  const now = Date.parse(TODAY);
  const on = list.filter((b) => b.enabled);
  // Only capacity earning by the valuation date is in the AI value, so only its build cost comes off.
  const remaining = on.reduce((a, b) => a + b.weight * b.capex * Math.max(0, online(b, at) - spentShare(b, now)), 0);
  const lines: BridgeLine[] = [];
  const bal = company.balance;
  if (bal?.bookEquity != null) {
    const spent = on.reduce((a, b) => a + b.weight * b.capex * spentShare(b, now), 0);
    lines.push({ label: "Book equity", value: bal.bookEquity, note: bal.bookNote });
    lines.push({ label: "AI build cost already in book", value: -spent, note: "Taken out so the data centers are not counted twice." });
  } else if (bal) {
    lines.push({ label: "Cash", value: bal.cash, note: "Including restricted cash." });
    if (bal.bitcoin) lines.push({ label: `Bitcoin, ${bal.bitcoin.toLocaleString("en-US")} coins`, value: bal.bitcoin * ctx.btc, note: `At $${Math.round(ctx.btc).toLocaleString("en-US")} a coin.` });
    for (const a of bal.otherAssets ?? []) lines.push(a);
    lines.push({ label: "Debt", value: -bal.debt, note: bal.debtNote });
    for (const c of bal.claims ?? []) lines.push({ ...c, value: -c.value });
  }
  lines.push({ label: "Build cost still to spend", value: -remaining, note: "On switched-on capacity running by the valuation date." });
  return { lines, net: lines.reduce((a, l) => a + l.value, 0), remaining };
}

/**
 * Cash the AI business earns each month from today to `to`: NOI after its overhead, less tax.
 * On the earnings basis it is also after interest on the modeled build debt, which that basis carries.
 * On the EBITDA and cap-rate bases the actual debt comes off the balance sheet instead, so no interest here.
 * `pv` discounts each month to today. `total` does not.
 */
export function interimCash(company: Company, list: Block[], s: Scenario, to: number): { pv: number; total: number } {
  const now = Date.parse(TODAY);
  const levered = appliedBasis(company.model, s) === "pe";
  let pv = 0;
  let total = 0;
  const d = new Date(now);
  d.setUTCDate(15);
  d.setUTCMonth(d.getUTCMonth() + 1);
  while (d.getTime() <= to) {
    const t = d.getTime();
    const p = pointAt(list, s, t);
    const ai = aiValueAt(company, p, s);
    const interest = levered ? p.interest : 0;
    const tax = Math.max(0, ai.noi - p.da - interest) * s.tax;
    const cash = (ai.noi - interest - tax) / 12;
    total += cash;
    pv += cash / Math.pow(1 + s.discount, (t - now) / YEAR);
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return { pv, total };
}

/** Years over which today's interest cost runs off, as project debt amortizes over its leases. */
const DEBT_RUNOFF_YEARS = 15;

/** Lease DCF runs monthly to here, then values each site at the exit cap rate. */
export const DCF_END = Date.UTC(2050, 11, 31);

export interface Dcf {
  /** NOI after overhead and tax, each month to 2050, discounted. */
  operating: number;
  /** Tax saved because interest on the company's debt is deductible, discounted. */
  shield: number;
  /** Build cost in the month it is spent, discounted. */
  capex: number;
  /** Sites valued at the exit cap rate in 2050, discounted. */
  terminal: number;
}

function nextMonth(t: number): number {
  const d = new Date(t);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.getTime();
}

/** Monthly lease cash flows to 2050. They do not depend on the discount rate, so they are built once and discounted as needed. */
export interface LeaseFlows {
  years: number[];
  operating: number[];
  capex: number[];
  shield: number[];
  /** NOI after overhead in 2050, for the exit value. */
  endNoi: number;
}

export function leaseFlows(company: Company, list: Block[], s: Scenario): LeaseFlows {
  const now = Date.parse(TODAY);
  const on = list.filter((b) => b.enabled);
  const years: number[] = [];
  const operating: number[] = [];
  const capex: number[] = [];
  const shield: number[] = [];
  const interest = company.balance?.interest ?? 0;
  for (let t = now; t < DCF_END; t = nextMonth(t)) {
    const t2 = nextMonth(t);
    const p = pointAt(list, s, t);
    const ai = aiValueAt(company, p, s);
    const taxable = ai.noi - p.da;
    const tax = Math.max(0, taxable) * s.tax;
    // Interest runs off as project debt amortizes. Only the tax actually avoided counts, so a loss year saves nothing.
    const owed = interest * Math.max(0, 1 - (t - now) / YEAR / DEBT_RUNOFF_YEARS);
    years.push((t - now) / YEAR);
    operating.push((ai.noi - tax) / 12);
    shield.push((tax - Math.max(0, taxable - owed) * s.tax) / 12);
    capex.push(on.reduce((a, b) => a + b.weight * b.capex * (spentShare(b, t2) - spentShare(b, t)), 0));
  }
  const endNoi = aiValueAt(company, pointAt(list, s, DCF_END), s).noi;
  return { years, operating, capex, shield, endNoi };
}

export function discountFlows(f: LeaseFlows, r: number, exitCap: number): Dcf {
  let operating = 0;
  let capex = 0;
  let shield = 0;
  for (let i = 0; i < f.years.length; i++) {
    const df = Math.pow(1 + r, f.years[i]);
    operating += f.operating[i] / df;
    capex += f.capex[i] / df;
    shield += f.shield[i] / df;
  }
  const terminal = f.endNoi / exitCap / Math.pow(1 + r, (DCF_END - Date.parse(TODAY)) / YEAR);
  return { operating, shield, capex, terminal };
}

/** Cash flows of the switched-on leases over their life, discounted at rate r. */
export function leaseDcf(company: Company, list: Block[], s: Scenario, r: number): Dcf {
  return discountFlows(leaseFlows(company, list, s), r, s.exitCap);
}

export interface Valuation {
  target: Point;
  targetDate: string;
  years: number;
  ai: AiValue;
  /** AI business value at the target date, discounted to today. */
  aiToday: number;
  /** Cash the AI business earns before the target date, discounted to today. */
  interimToday: number;
  bridge: Bridge;
  /** Set on the lease DCF basis. */
  dcf?: Dcf;
  /** Set on the cap-rate basis. */
  nav?: Nav;
  /** Equity value today. */
  equity: number;
  shares: number | null;
  /** Value per share at the target date, before discounting the AI business. */
  futurePrice: number | null;
  price: number | null;
  upside: number | null;
}

export function valuation(company: Company, list: Block[], s: Scenario, ctx: Ctx): Valuation {
  const basis = appliedBasis(company.model, s);
  if (basis === "dcf") return dcfValuation(company, list, s, ctx, s.dcfRate);
  if (basis === "cap") return capValuation(company, list, s, ctx, s.capRate);
  const targetDate = `${s.year}-12-31`;
  const target = pointAt(list, s, Date.parse(targetDate));
  const ai = aiValueAt(company, target, s);
  const years = Math.max(0, (Date.parse(targetDate) - Date.parse(TODAY)) / YEAR);
  const aiToday = ai.ev / Math.pow(1 + s.discount, years);
  const interim = interimCash(company, list, s, Date.parse(targetDate));
  const br = bridge(company, list, ctx, Date.parse(targetDate));
  const equity = aiToday + interim.pv + ai.otherValue + br.net;
  const shares = ctx.quote?.shares ? sharesAt(ctx.quote.shares, Date.parse(targetDate), s) : null;
  const futurePrice = shares ? (ai.ev + interim.total + ai.otherValue + br.net) / shares : null;
  const price = shares ? equity / shares : null;
  const upside = price != null && ctx.quote?.price ? price / ctx.quote.price - 1 : null;
  return { target, targetDate, years, ai, aiToday, interimToday: interim.pv, bridge: br, equity, shares, futurePrice, price, upside };
}

function dcfValuation(company: Company, list: Block[], s: Scenario, ctx: Ctx, r: number, flows?: LeaseFlows): Valuation {
  const targetDate = `${s.year}-12-31`;
  const target = pointAt(list, s, Date.parse(targetDate));
  const ai = aiValueAt(company, target, s);
  const dcf = discountFlows(flows ?? leaseFlows(company, list, s), r, s.exitCap);
  // Build cost sits inside the cash flows here, so the bridge leaves out its own build line.
  const full = bridge(company, list, ctx, DCF_END);
  const lines = full.lines.filter((l) => l.label !== "Build cost still to spend");
  const br: Bridge = { lines, net: lines.reduce((a, l) => a + l.value, 0), remaining: 0 };
  const aiToday = dcf.operating + dcf.shield - dcf.capex + dcf.terminal;
  const equity = aiToday + ai.otherValue + br.net;
  const shares = ctx.quote?.shares ? sharesAt(ctx.quote.shares, Date.parse(targetDate), s) : null;
  const price = shares ? equity / shares : null;
  const upside = price != null && ctx.quote?.price ? price / ctx.quote.price - 1 : null;
  return { target, targetDate, years: 0, ai, aiToday, interimToday: 0, bridge: br, dcf, equity, shares, futurePrice: price, price, upside };
}

/** What the cap-rate basis adds up, all discounted to today. */
export interface Nav {
  /** Each site at its stabilized NOI divided by the cap rate, from the date it is fully online. */
  sites: number;
  /** NOI earned while each site ramps up, before it is stabilized. */
  rampCash: number;
  /** Build cost as it is spent. */
  capex: number;
  /** The AI business's share of overhead, capitalized at the same cap rate. */
  overhead: number;
  /** Annual NOI of the switched-on sites once stabilized, averaged over each lease. */
  stabilizedNoi: number;
}

/**
 * NAV at a cap rate. Each site's stabilized NOI, its average over the lease with escalators, is capitalized
 * when the site is fully online and discounted from then at the required return. Build cost comes off as it
 * is spent, NOI during the ramp is added, and overhead is capitalized at the same rate. Pre-tax, as cap rates are.
 */
export function capNav(company: Company, list: Block[], s: Scenario, cap: number): Nav {
  const now = Date.parse(TODAY);
  const r = s.dcfRate;
  const df = (t: number) => Math.pow(1 + r, Math.max(0, t - now) / YEAR);
  let sites = 0;
  let rampCash = 0;
  let capex = 0;
  let stabilizedNoi = 0;
  for (const b of list.filter((x) => x.enabled)) {
    const term = b.ramp.termYears ?? 15;
    const avgNoi = (b.weight * b.noi * averageFactor(b.escalator, term)) / b.averageFactor;
    stabilizedNoi += avgNoi;
    sites += avgNoi / cap / df(Math.max(now, b.full));
    for (let t = Math.max(now, b.start); t < b.full; t = nextMonth(t)) {
      rampCash += (b.weight * b.noi * online(b, t) * rentScale(b, t)) / 12 / df(t);
    }
    const from = new Date(b.start);
    from.setUTCMonth(from.getUTCMonth() - BUILD_LEAD);
    for (let t = Math.max(now, from.getTime()); t < b.full; t = nextMonth(t)) {
      capex += (b.weight * b.capex * (spentShare(b, nextMonth(t)) - spentShare(b, t))) / df(t);
    }
  }
  const gp = Math.max(0, company.balance?.other?.grossProfit ?? 0);
  const aiShare = stabilizedNoi > 0 ? stabilizedNoi / (stabilizedNoi + gp) : gp > 0 ? 0 : 1;
  const overhead = (overheadOf(company, s) * aiShare) / cap;
  return { sites, rampCash, capex, overhead, stabilizedNoi };
}

function capValuation(company: Company, list: Block[], s: Scenario, ctx: Ctx, cap: number, nav?: Nav): Valuation {
  const targetDate = `${s.year}-12-31`;
  const target = pointAt(list, s, Date.parse(targetDate));
  const n = nav ?? capNav(company, list, s, cap);
  // The other businesses carry the overhead the AI business does not.
  const gp = Math.max(0, company.balance?.other?.grossProfit ?? 0);
  const overheadOther = overheadOf(company, s) - n.overhead * cap;
  const ai = { ...aiValueAt(company, target, s), otherValue: s.otherMultiple * Math.max(0, gp - overheadOther) };
  const full = bridge(company, list, ctx, DCF_END);
  const lines = full.lines.filter((l) => l.label !== "Build cost still to spend");
  const br: Bridge = { lines, net: lines.reduce((a, l) => a + l.value, 0), remaining: 0 };
  const aiToday = n.sites + n.rampCash - n.capex - n.overhead;
  const equity = aiToday + ai.otherValue + br.net;
  const shares = ctx.quote?.shares ? sharesAt(ctx.quote.shares, Date.parse(targetDate), s) : null;
  const price = shares ? equity / shares : null;
  const upside = price != null && ctx.quote?.price ? price / ctx.quote.price - 1 : null;
  return { target, targetDate, years: 0, ai, aiToday, interimToday: 0, bridge: br, nav: n, equity, shares, futurePrice: price, price, upside };
}

/** Implied value per share at each future month, before discounting. */
export function pricePath(company: Company, list: Block[], points: Point[], s: Scenario, ctx: Ctx): { t: number; v: number }[] {
  const shares = ctx.quote?.shares;
  if (!shares) return [];
  const now = Date.parse(TODAY);
  if (appliedBasis(company.model, s) === "dcf" || appliedBasis(company.model, s) === "cap") {
    // With no dividends, a value built from discounted cash grows at the return it is discounted at.
    const today = valuation(company, list, s, ctx).price ?? 0;
    return points.filter((p) => p.t >= now).map((p) => ({ t: p.t, v: today * Math.pow(1 + s.dcfRate, (p.t - now) / YEAR) }));
  }
  return points
    .filter((p) => p.t >= now)
    .map((p) => {
      const ai = aiValueAt(company, p, s);
      const net = bridge(company, list, ctx, p.t).net;
      const earned = interimCash(company, list, s, p.t).total;
      return { t: p.t, v: (ai.ev + earned + ai.otherValue + net) / sharesAt(shares, p.t, s) };
    });
}

export interface YearRow {
  year: number;
  mwEnd: number;
  revenue: number;
  noi: number;
  overhead: number;
  da: number;
  interest: number;
  earnings: number;
  exitRevenue: number;
  exitEarnings: number;
  eps: number | null;
  value: number | null;
}

/** Calendar-year totals, from the average of twelve monthly run-rates. */
export function yearTable(company: Company, list: Block[], s: Scenario, ctx: Ctx): YearRow[] {
  const shares = ctx.quote?.shares ?? null;
  const dcfPrice = appliedBasis(company.model, s) === "dcf" || appliedBasis(company.model, s) === "cap" ? valuation(company, list, s, ctx).price : null;
  const rows: YearRow[] = [];
  for (let year = 2026; year <= 2030; year++) {
    let revenue = 0;
    let noi = 0;
    let overhead = 0;
    let da = 0;
    let interest = 0;
    let earnings = 0;
    for (let m = 0; m < 12; m++) {
      const p = pointAt(list, s, Date.UTC(year, m, 15));
      const ai = aiValueAt(company, p, s);
      revenue += sumTiers(p.revenue) / 12;
      noi += p.noi / 12;
      overhead += ai.overheadAi / 12;
      da += p.da / 12;
      interest += p.interest / 12;
      earnings += ai.earnings / 12;
    }
    const end = pointAt(list, s, Date.UTC(year, 11, 31));
    const endAi = aiValueAt(company, end, s);
    const sh = shares ? sharesAt(shares, end.t, s) : null;
    rows.push({
      year,
      mwEnd: sumTiers(end.mw),
      revenue,
      noi,
      overhead,
      da,
      interest,
      earnings,
      exitRevenue: sumTiers(end.revenue),
      exitEarnings: endAi.earnings,
      eps: sh ? earnings / sh : null,
      value: dcfPrice != null
        ? dcfPrice * Math.pow(1 + s.dcfRate, (end.t - Date.parse(TODAY)) / YEAR)
        : sh ? (endAi.ev + interimCash(company, list, s, end.t).total + endAi.otherValue + bridge(company, list, ctx, end.t).net) / sh : null,
    });
  }
  return rows;
}

/** Signed IT megawatts: in service plus contracted, regardless of switches. */
export function signedMw(company: Company, s: Scenario): number {
  return company.ramps
    .filter((r) => r.tier === "live" || r.tier === "contracted")
    .reduce((acc, r) => acc + itMw(r, s), 0);
}

export function liveMw(company: Company, s: Scenario): number {
  return company.ramps.filter((r) => r.tier === "live").reduce((acc, r) => acc + itMw(r, s), 0);
}

export function tierMw(company: Company, s: Scenario): Record<Tier, number> {
  const out = zeroTiers();
  for (const r of company.ramps) out[r.tier] += itMw(r, s);
  return out;
}

/** Contract value on the record. Ramps and deals describe the same contracts, so take whichever covers more. */
export function backlog(company: Company): number {
  const ramps = company.ramps.reduce((acc, r) => acc + (r.contractValue ?? (r.revenue && r.termYears ? r.revenue * r.termYears : 0)), 0);
  const deals = company.deals.reduce((acc, d) => acc + (d.contractValueUsd ?? (d.annualRevenueUsd && d.termYears ? d.annualRevenueUsd * d.termYears : 0)), 0);
  return Math.max(ramps, deals);
}

/**
 * Weighted starting rent across disclosed colo leases, $ per kW-month. Disclosed figures are mostly term averages,
 * so each is taken back to its first year at its own escalator, or the scenario's where none is disclosed.
 */
export function disclosedLeaseRate(companies: Company[], s: Scenario): number {
  let rev = 0;
  let mw = 0;
  for (const c of companies) {
    if (c.model !== "colo-lease" || !c.inBook) continue;
    for (const r of c.ramps) {
      if (r.revenue == null || (r.unit !== "critical-it" && r.unit !== "leased-power")) continue;
      const first = (r.rentBasis ?? "average") === "average" ? averageFactor(r.escalator ?? s.escalator, r.termYears ?? 15) : 1;
      rev += r.revenue / first;
      mw += r.mw;
    }
  }
  return mw ? rev / mw / 1000 / 12 : 0;
}

/** Starting rent of a block, $ per kW-month. */
export function leaseRateOf(b: Block): number | null {
  if (!b.itMw || b.capexKind === "gpu") return null;
  return b.revenue / b.averageFactor / b.itMw / 1000 / 12;
}

/**
 * The multiple (or cap rate) that makes your scenario land exactly on today's share price,
 * with the balance sheet and other businesses held as they are. Price is linear in the multiple.
 */
export function marketMultiple(company: Company, v: Valuation, s: Scenario, ctx: Ctx): number | null {
  if (!ctx.quote?.price || !v.shares) return null;
  if (appliedBasis(company.model, s) === "dcf") return impliedReturn(company, s, ctx);
  if (appliedBasis(company.model, s) === "cap") return impliedCap(company, s, ctx);
  const aiNeeded = (ctx.quote.price * v.shares - v.interimToday - v.ai.otherValue - v.bridge.net) * Math.pow(1 + s.discount, v.years);
  const basis = appliedBasis(company.model, s);
  if (basis === "cap") return v.ai.noi > 0 && aiNeeded > 0 ? v.ai.noi / aiNeeded : null;
  if (basis === "ebitda") return v.ai.noi > 0 && aiNeeded > 0 ? aiNeeded / v.ai.noi : null;
  const equityNeeded = aiNeeded - v.target.debt;
  return v.ai.earnings > 0 && equityNeeded > 0 ? equityNeeded / v.ai.earnings : null;
}

/**
 * The annual return today's price implies on the lease DCF: the discount rate at which the model lands on the market price.
 * Value falls as the rate rises, so a bisection finds it. Null when no rate between 1% and 40% reaches the price.
 */
export function impliedReturn(company: Company, s: Scenario, ctx: Ctx): number | null {
  const target = ctx.quote?.price;
  if (!target) return null;
  const list = blocks(company, s);
  const flows = leaseFlows(company, list, s);
  const at = (r: number) => dcfValuation(company, list, s, ctx, r, flows).price ?? NaN;
  let lo = 0.01;
  let hi = 0.4;
  if (!(at(lo) >= target) || !(at(hi) <= target)) return null;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (at(mid) > target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** The cap rate at which the stabilized NAV lands on today's price. Value falls as the cap rate rises. */
export function impliedCap(company: Company, s: Scenario, ctx: Ctx): number | null {
  const target = ctx.quote?.price;
  if (!target) return null;
  const list = blocks(company, s);
  const at = (c: number) => capValuation(company, list, s, ctx, c).price ?? NaN;
  let lo = 0.02;
  let hi = 0.25;
  if (!(at(lo) >= target) || !(at(hi) <= target)) return null;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (at(mid) > target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export interface Upside {
  block: Block;
  /** Year the block is fully online, held inside the forecast window. */
  builtYear: number;
  /** Change in implied price today if switched on, valued at your year. */
  addNow: number | null;
  /** Same, valued once the block is fully online. */
  addBuilt: number | null;
}

function priceWith(company: Company, s: Scenario, ctx: Ctx, year: number): number | null {
  const sc = { ...s, year };
  return valuation(company, blocks(company, sc), sc, ctx).price;
}

/** What each switched-off ramp would add per share, largest first. */
export function upside(company: Company, s: Scenario, ctx: Ctx): Upside[] {
  const list = blocks(company, s);
  const off = list.filter((b) => !b.enabled);
  if (!off.length) return [];
  const baseAt = new Map<number, number | null>();
  const base = (year: number) => {
    if (!baseAt.has(year)) baseAt.set(year, priceWith(company, s, ctx, year));
    return baseAt.get(year) ?? null;
  };
  const diff = (a: number | null, b: number | null) => (a == null || b == null ? null : a - b);
  return off
    .map((b) => {
      const builtYear = Math.min(2030, Math.max(s.year, new Date(b.full).getUTCFullYear()));
      const withIt = { ...s, on: [...s.on, b.ramp.id], off: s.off.filter((id) => id !== b.ramp.id) };
      return {
        block: b,
        builtYear,
        addNow: diff(priceWith(company, withIt, ctx, s.year), base(s.year)),
        addBuilt: diff(priceWith(company, withIt, ctx, builtYear), base(builtYear)),
      };
    })
    .sort((a, b) => (b.addBuilt ?? 0) - (a.addBuilt ?? 0));
}

/** Implied price today for each valuation year, for the year strip. */
export function priceByYear(company: Company, s: Scenario, ctx: Ctx): { year: number; price: number | null; upside: number | null }[] {
  return [2026, 2027, 2028, 2029, 2030].map((year) => {
    const sc = { ...s, year };
    const v = valuation(company, blocks(company, sc), sc, ctx);
    return { year, price: v.price, upside: v.upside };
  });
}
