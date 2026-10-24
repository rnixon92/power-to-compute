import type { Company, Tier } from "@/data/types";
import { blocks, liveMw, online, signedMw, TODAY } from "@/lib/forecast";
import type { Scenario } from "@/lib/scenario";

/** One dated go-live: a phase starting, a phase finishing its ramp, or a phase delivered within one quarter. */
export interface Milestone {
  id: string;
  ticker: string;
  label: string;
  /** Exact dates, for the tooltip. */
  detail: string;
  mw: number;
  t: number;
  tier: Tier;
  /** The company gave only a year or a half, so the date is our placement. */
  estimate: boolean;
  /** The date has already gone by this quarter. */
  passed: boolean;
}

export interface Quarter {
  key: string;
  label: string;
  from: number;
  to: number;
  current: boolean;
}

export interface CalendarRow {
  company: Company;
  /** Capacity the company reports in service. */
  live: number;
  /** Signed capacity online today on the ramp dates, which counts phases partway through their ramp. */
  now: number;
  signed: number;
  /** Earliest dated go-live, for companies with nothing online yet. */
  first: number | null;
  cells: Milestone[][];
  later: Milestone[];
}

const DAY = 86_400_000;

function quarterStart(t: number): number {
  const d = new Date(t);
  return Date.UTC(d.getUTCFullYear(), Math.floor(d.getUTCMonth() / 3) * 3, 1);
}

function nextQuarter(t: number): number {
  const d = new Date(t);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 3, 1);
}

export function shortQuarter(t: number): string {
  const d = new Date(t);
  return `Q${Math.floor(d.getUTCMonth() / 3) + 1} ${String(d.getUTCFullYear()).slice(2)}`;
}

function day(t: number): string {
  return new Date(t).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/** The current quarter and the ones after it. */
export function quarters(count = 8, today = Date.parse(TODAY)): Quarter[] {
  const out: Quarter[] = [];
  let from = quarterStart(today);
  for (let i = 0; i < count; i++) {
    const to = nextQuarter(from);
    out.push({ key: shortQuarter(from), label: shortQuarter(from), from, to, current: i === 0 });
    from = to;
  }
  return out;
}

/** Go-lives for the sites switched on in the scenario, from the start of this quarter on. */
export function milestones(company: Company, s: Scenario, today = Date.parse(TODAY)): Milestone[] {
  const from = quarterStart(today);
  const out: Milestone[] = [];
  for (const b of blocks(company, s)) {
    if (!b.enabled) continue;
    const base = { ticker: company.ticker, mw: b.itMw, tier: b.ramp.tier, estimate: b.ramp.timing === "estimate" };
    const sameQuarter = quarterStart(b.start) === quarterStart(b.full);
    if (sameQuarter) {
      if (b.full < from) continue;
      const detail = b.full - b.start > DAY ? `${day(b.start)} to ${day(b.full)}` : day(b.start);
      out.push({ ...base, id: b.ramp.id, label: b.ramp.label, detail, t: b.start, passed: b.full < today });
      continue;
    }
    if (b.start >= from) {
      out.push({ ...base, id: `${b.ramp.id}-start`, label: `${b.ramp.label} begins`, detail: `Ramp starts ${day(b.start)}, complete ${day(b.full)}`, t: b.start, passed: b.start < today });
    }
    if (b.full >= from) {
      out.push({ ...base, id: `${b.ramp.id}-full`, label: `${b.ramp.label} complete`, detail: `Ramp started ${day(b.start)}, complete ${day(b.full)}`, t: b.full, passed: b.full < today });
    }
  }
  return out.sort((a, b) => a.t - b.t);
}

export function calendarRow(company: Company, s: Scenario, cols: Quarter[], today = Date.parse(TODAY)): CalendarRow {
  const list = milestones(company, s, today);
  const end = cols[cols.length - 1].to;
  const now = blocks(company, s)
    .filter((b) => b.enabled && (b.ramp.tier === "live" || b.ramp.tier === "contracted"))
    .reduce((acc, b) => acc + online(b, today) * b.itMw, 0);
  return {
    company,
    live: liveMw(company, s),
    now,
    signed: signedMw(company, s),
    first: now ? null : list.find((m) => m.tier === "live" || m.tier === "contracted")?.t ?? null,
    cells: cols.map((q) => list.filter((m) => m.t >= q.from && m.t < q.to)),
    later: list.filter((m) => m.t >= end),
  };
}

/** Rows for every company with a signed AI lease, largest signed book first. */
export function calendar(companies: Company[], s: Scenario, count = 7, today = Date.parse(TODAY)) {
  const cols = quarters(count, today);
  const rows = companies
    .filter((c) => signedMw(c, s) > 0)
    .map((c) => calendarRow(c, s, cols, today))
    .sort((a, b) => b.signed - a.signed);
  const counts = cols.map((_, i) => rows.reduce((acc, r) => acc + r.cells[i].length, 0));
  return { cols, rows, counts, unsigned: companies.filter((c) => signedMw(c, s) === 0) };
}
