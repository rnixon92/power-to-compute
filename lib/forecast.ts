import { BTC_JUN30 } from "@/data/ledger";
import type { Company, MarketBook, Quote, Ramp, Tier } from "@/data/types";
import { appliedBasis, TIERS, type Scenario } from "@/lib/scenario";

export const TODAY = new Date().toISOString().slice(0, 10);
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
  if (ramp.capexTotal != null) {
    capex = ramp.capexTotal;
    capexFrom = "company";
  } else if (ramp.capexPerMw != null) {
    capex = ramp.capexPerMw * mw;
    capexFrom = "company";
  } else {
    capex = (kind === "gpu" ? s.gpuCost : s.buildCost) * 1e6 * mw;
    capexFrom = "assumed";
  }
  const start = shift(ramp.start, s.slip);
  const full = Math.max(start, shift(ramp.full ?? ramp.start, s.slip));
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
    life: kind === "gpu" ? s.gpuLife : s.shellLife,
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
    mwAll += f * b.itMw;
    revenueAll += f * b.revenue;
    if (!b.enabled) continue;
    mw[b.ramp.tier] += f * b.itMw;
    revenue[b.ramp.tier] += f * b.revenue;
    noi += f * b.noi;
    da += (f * b.capex) / b.life;
    const d = f * b.capex * s.leverage;
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
  const ev = basis === "cap" ? noi / s.capRate : basis === "ebitda" ? noi * s.multiple : earnings * s.multiple + p.debt;
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
export function bridge(company: Company, list: Block[], ctx: Ctx): Bridge {
  const now = Date.parse(TODAY);
  const on = list.filter((b) => b.enabled);
  const remaining = on.reduce((a, b) => a + b.capex * (1 - spentShare(b, now)), 0);
  const lines: BridgeLine[] = [];
  const bal = company.balance;
  if (bal?.bookEquity != null) {
    const spent = on.reduce((a, b) => a + b.capex * spentShare(b, now), 0);
    lines.push({ label: "Book equity", value: bal.bookEquity, note: bal.bookNote });
    lines.push({ label: "AI build cost already in book", value: -spent, note: "Taken out so the data centers are not counted twice." });
  } else if (bal) {
    lines.push({ label: "Cash", value: bal.cash, note: "Including restricted cash." });
    if (bal.bitcoin) lines.push({ label: `Bitcoin, ${bal.bitcoin.toLocaleString("en-US")} coins`, value: bal.bitcoin * ctx.btc, note: `At $${Math.round(ctx.btc).toLocaleString("en-US")} a coin.` });
    for (const a of bal.otherAssets ?? []) lines.push(a);
    lines.push({ label: "Debt", value: -bal.debt, note: bal.debtNote });
    for (const c of bal.claims ?? []) lines.push({ ...c, value: -c.value });
  }
  lines.push({ label: "Build cost still to spend", value: -remaining, note: "On the sites switched on." });
  return { lines, net: lines.reduce((a, l) => a + l.value, 0), remaining };
}

export interface Valuation {
  target: Point;
  targetDate: string;
  years: number;
  ai: AiValue;
  /** AI business value discounted to today. */
  aiToday: number;
  bridge: Bridge;
  /** Equity value today. */
  equity: number;
  shares: number | null;
  /** Value per share at the target date, before discounting the AI business. */
  futurePrice: number | null;
  price: number | null;
  upside: number | null;
}

export function valuation(company: Company, list: Block[], s: Scenario, ctx: Ctx): Valuation {
  const targetDate = `${s.year}-12-31`;
  const target = pointAt(list, s, Date.parse(targetDate));
  const ai = aiValueAt(company, target, s);
  const years = Math.max(0, (Date.parse(targetDate) - Date.parse(TODAY)) / YEAR);
  const aiToday = ai.ev / Math.pow(1 + s.discount, years);
  const br = bridge(company, list, ctx);
  const equity = aiToday + ai.otherValue + br.net;
  const shares = ctx.quote?.shares ? sharesAt(ctx.quote.shares, Date.parse(targetDate), s) : null;
  const futurePrice = shares ? (ai.ev + ai.otherValue + br.net) / shares : null;
  const price = shares ? equity / shares : null;
  const upside = price != null && ctx.quote?.price ? price / ctx.quote.price - 1 : null;
  return { target, targetDate, years, ai, aiToday, bridge: br, equity, shares, futurePrice, price, upside };
}

/** Implied value per share at each future month, before discounting. */
export function pricePath(company: Company, list: Block[], points: Point[], s: Scenario, ctx: Ctx): { t: number; v: number }[] {
  const shares = ctx.quote?.shares;
  if (!shares) return [];
  const now = Date.parse(TODAY);
  const net = bridge(company, list, ctx).net;
  return points
    .filter((p) => p.t >= now)
    .map((p) => {
      const ai = aiValueAt(company, p, s);
      return { t: p.t, v: (ai.ev + ai.otherValue + net) / sharesAt(shares, p.t, s) };
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
  const net = bridge(company, list, ctx).net;
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
      value: sh ? (endAi.ev + endAi.otherValue + net) / sh : null,
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

/** Weighted lease rate across disclosed colo rents, $ per kW-month. */
export function disclosedLeaseRate(companies: Company[]): number {
  let rev = 0;
  let mw = 0;
  for (const c of companies) {
    if (c.model !== "colo-lease" || !c.inBook) continue;
    for (const r of c.ramps) {
      if (r.revenue == null || (r.unit !== "critical-it" && r.unit !== "leased-power")) continue;
      rev += r.revenue;
      mw += r.mw;
    }
  }
  return mw ? rev / mw / 1000 / 12 : 0;
}

export function leaseRateOf(b: Block): number | null {
  if (!b.itMw || b.capexKind === "gpu") return null;
  return b.revenue / b.itMw / 1000 / 12;
}

/**
 * The multiple (or cap rate) that makes your scenario land exactly on today's share price,
 * with the balance sheet and other businesses held as they are. Price is linear in the multiple.
 */
export function marketMultiple(company: Company, v: Valuation, s: Scenario, ctx: Ctx): number | null {
  if (!ctx.quote?.price || !v.shares) return null;
  const aiNeeded = (ctx.quote.price * v.shares - v.ai.otherValue - v.bridge.net) * Math.pow(1 + s.discount, v.years);
  const basis = appliedBasis(company.model, s);
  if (basis === "cap") return v.ai.noi > 0 && aiNeeded > 0 ? v.ai.noi / aiNeeded : null;
  if (basis === "ebitda") return v.ai.noi > 0 && aiNeeded > 0 ? aiNeeded / v.ai.noi : null;
  const equityNeeded = aiNeeded - v.target.debt;
  return v.ai.earnings > 0 && equityNeeded > 0 ? equityNeeded / v.ai.earnings : null;
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
