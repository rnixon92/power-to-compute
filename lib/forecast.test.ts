import { describe, expect, it } from "vitest";
import { book, companies, companyByTicker } from "@/data/ledger";
import { blocks, disclosedLeaseRate, marketMultiple, pointAt, priceByYear, signedMw, sumTiers, upside, valuation, yearTable } from "@/lib/forecast";
import { decodeScenario, defaultScenario, encodeScenario, presets, type Scenario } from "@/lib/scenario";

const s = defaultScenario;
const at = (ticker: string, iso: string, sc: Scenario = s) => pointAt(blocks(companyByTicker(ticker)!, sc), sc, Date.parse(iso));

describe("ledger", () => {
  it("gives every ramp a campus that exists and a source that exists", () => {
    for (const c of companies) {
      const campuses = new Set(c.campuses.map((x) => x.id));
      const sources = new Set(c.sources.map((x) => x.id));
      for (const r of c.ramps) {
        expect(campuses.has(r.campus), `${r.id} campus`).toBe(true);
        expect(sources.has(r.source), `${r.id} source`).toBe(true);
        expect(r.full == null || r.full >= r.start, `${r.id} dates`).toBe(true);
      }
    }
  });

  it("keeps ramp ids unique across the book", () => {
    const ids = companies.flatMap((c) => c.ramps.map((r) => r.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("counts signed critical IT once per company", () => {
    expect(signedMw(companyByTicker("IREN")!, s)).toBe(300);
    expect(signedMw(companyByTicker("WULF")!, s)).toBe(839);
    expect(signedMw(companyByTicker("GLXY")!, s)).toBe(526);
    expect(signedMw(companyByTicker("HUT")!, s)).toBe(949);
    expect(signedMw(companyByTicker("APLD")!, s)).toBe(1200);
    expect(signedMw(companyByTicker("CORZ")!, s)).toBe(590 + 530);
    expect(signedMw(companyByTicker("MARA")!, s)).toBe(0);
    expect(signedMw(companyByTicker("RIOT")!, s)).toBe(241);
    expect(signedMw(companyByTicker("CLSK")!, s)).toBe(175);
  });

  it("puts the default lease rate near the book's disclosed rents", () => {
    expect(Math.abs(disclosedLeaseRate(book) - s.leaseRate)).toBeLessThan(10);
  });
});

describe("forecast", () => {
  it("reaches IREN's $4B of 2026 ARR without adding Microsoft on top", () => {
    expect(sumTiers(at("IREN", "2026-09-01").revenue)).toBe(1e9);
    expect(sumTiers(at("IREN", "2026-12-31").revenue)).toBeCloseTo(4e9, -3);
  });

  it("starts Justified rent on Anthropic's schedule", () => {
    const before = at("WULF", "2027-09-01").revenue.contracted;
    const after = at("WULF", "2028-06-30").revenue.contracted;
    expect(after - before).toBeCloseTo(950e6, 0);
    const full = at("WULF", "2028-06-30");
    expect(full.mw.live + full.mw.contracted).toBeCloseTo(839, 6);
  });

  it("uses Galaxy's construction cost and Hut 8's NOI as given", () => {
    const g = at("GLXY", "2027-12-31");
    expect(g.noi).toBeCloseTo((315e6 + 690e6) * 0.9, 0);
    const h = at("HUT", "2029-06-30");
    expect(h.noi).toBeCloseTo(454e6 + 655e6 * 2, 0);
  });

  it("leaves MARA at zero until a site is switched on", () => {
    expect(sumTiers(at("MARA", "2029-12-31").revenue)).toBe(0);
    const on = { ...s, on: ["mara-wolf"] };
    expect(at("MARA", "2029-12-31", on).mw.pipeline).toBeCloseTo(246 * s.conversion, 6);
  });

  it("switches a whole tier and lets one ramp override it", () => {
    const bull = { ...s, tiers: { ...s.tiers, announced: true }, off: ["wulf-muskie-2"] };
    const p = at("WULF", "2030-12-31", bull);
    expect(p.mw.announced).toBeCloseTo(500 * s.conversion, 6);
  });

  it("delays only future dates when the schedule slips", () => {
    const late = { ...s, slip: 6 };
    expect(sumTiers(at("IREN", "2026-09-01", late).revenue)).toBe(1e9);
    const yearEnd = sumTiers(at("IREN", "2026-12-31", late).revenue);
    expect(yearEnd).toBeGreaterThan(1e9);
    expect(yearEnd).toBeLessThan(3e9);
  });

  it("subtracts debt on the EBITDA basis and interest on the earnings basis", () => {
    const hut = blocks(companyByTicker("HUT")!, s);
    const pe = valuation(hut, s);
    const ev = valuation(hut, { ...s, basis: "ebitda" });
    expect(pe.equity).toBeCloseTo(pe.target.earnings * 20, 0);
    expect(ev.equity).toBeCloseTo(ev.target.noi * 20 - ev.target.debt, 0);
  });

  it("discounts the target-year price back to today", () => {
    const quote = { shares: 100e6, price: 10 } as never;
    const v = valuation(blocks(companyByTicker("GLXY")!, s), s, quote);
    expect(v.price!).toBeLessThan(v.futurePrice!);
    expect(v.price! * Math.pow(1 + s.discount, v.years)).toBeCloseTo(v.futurePrice!, 6);
  });

  it("builds a five-year table", () => {
    const rows = yearTable(blocks(companyByTicker("HUT")!, s), s, 100e6);
    expect(rows.map((r) => r.year)).toEqual([2026, 2027, 2028, 2029, 2030]);
    expect(rows[0].revenue).toBe(0);
    expect(rows[4].noi).toBeCloseTo(454e6 + 655e6 * 2, 0);
  });
});

describe("scenario URL", () => {
  it("round-trips through the query string", () => {
    const sc = { ...presets.bull.apply(s), on: ["mara-wolf"], off: ["wulf-cb5"], slip: 3 };
    expect(decodeScenario(new URLSearchParams(encodeScenario(sc)))).toEqual(sc);
  });

  it("writes nothing for the default", () => {
    expect(encodeScenario(s)).toBe("");
  });
});

describe("explaining the price", () => {
  const quote = { shares: 400e6, price: 11 } as never;

  it("solves the multiple that lands on today's price", () => {
    const wulf = companyByTicker("WULF")!;
    const v = valuation(blocks(wulf, s), s, quote);
    const m = marketMultiple(v, s, quote)!;
    const at = valuation(blocks(wulf, { ...s, multiple: m }), { ...s, multiple: m }, quote);
    expect(at.price!).toBeCloseTo(11, 6);
  });

  it("prices Muskie as upside that grows once it is built", () => {
    const rows = upside(companyByTicker("WULF")!, s, quote);
    const m1 = rows.find((r) => r.block.ramp.id === "wulf-muskie-1")!;
    expect(m1.builtYear).toBe(2029);
    expect(m1.addBuilt!).toBeGreaterThan(m1.addNow!);
    expect(rows.every((r) => !r.block.enabled)).toBe(true);
  });

  it("gives one price per valuation year", () => {
    const rows = priceByYear(companyByTicker("HUT")!, s, quote);
    expect(rows.map((r) => r.year)).toEqual([2026, 2027, 2028, 2029, 2030]);
    expect(rows.find((r) => r.year === s.year)!.price).toBeCloseTo(valuation(blocks(companyByTicker("HUT")!, s), s, quote).price!, 6);
  });
});
