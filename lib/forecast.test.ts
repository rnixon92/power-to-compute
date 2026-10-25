import { describe, expect, it } from "vitest";
import { book, companies, companyByTicker } from "@/data/ledger";
import { aiValueAt, averageFactor, blocks, impliedReturn, rentScale, disclosedLeaseRate, marketMultiple, pointAt, priceByYear, signedMw, spentShare, sumTiers, upside, valuation, yearTable, type Ctx } from "@/lib/forecast";
import { reaction } from "@/lib/events";
import { decodeScenario, defaultScenario, encodeScenario, presets, type Scenario } from "@/lib/scenario";

const s = defaultScenario;
const flat = { ...defaultScenario, escalator: 0 };
/** The run-rate methods: value one year's run-rate and discount it. */
const run = { ...defaultScenario, basis: "pe" as const };
const ctx: Ctx = { quote: { shares: 400e6, price: 11 } as never, btc: 60_000 };
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

  it("ties every event to a source that exists", () => {
    for (const c of companies) {
      const sources = new Set(c.sources.map((x) => x.id));
      for (const e of c.events ?? []) expect(sources.has(e.source), `${c.ticker} ${e.title}`).toBe(true);
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
    expect(signedMw(companyByTicker("APLD")!, s)).toBe(1410);
    expect(signedMw(companyByTicker("CORZ")!, s)).toBe(590 + 530);
    expect(signedMw(companyByTicker("MARA")!, s)).toBe(0);
    expect(signedMw(companyByTicker("RIOT")!, s)).toBe(241);
    expect(signedMw(companyByTicker("CLSK")!, s)).toBe(175);
  });

  it("puts the default lease rate near the book's disclosed rents", () => {
    expect(Math.abs(disclosedLeaseRate(book, s) - s.leaseRate)).toBeLessThan(5);
  });
});

describe("forecast", () => {
  it("reaches IREN's $4B of 2026 ARR without adding Microsoft on top", () => {
    expect(sumTiers(at("IREN", "2026-09-01").revenue)).toBe(1e9);
    expect(sumTiers(at("IREN", "2026-12-31").revenue)).toBeCloseTo(4e9, -3);
  });

  it("prices undisclosed IREN capacity as GPUs plus the building, and leaves the Microsoft GPUs at $29M", () => {
    const iren = blocks(companyByTicker("IREN")!, s);
    const signed = iren.find((b) => b.ramp.id === "iren-2026")!;
    const open = iren.find((b) => b.ramp.id === "iren-h56")!;
    expect(signed.capex / signed.itMw).toBe(29e6);
    expect(signed.life).toBe(s.gpuLife);
    expect(open.capex / open.itMw).toBe((s.gpuCost + s.buildCost) * 1e6);
    const annual = (s.gpuCost / s.gpuLife + s.buildCost / s.shellLife) * 1e6;
    expect(open.capex / open.life).toBeCloseTo(annual * open.itMw, 0);
    const retrofit = iren.find((b) => b.ramp.id === "iren-air")!;
    expect(retrofit.capex / retrofit.itMw).toBe(s.gpuCost * 1e6);
    expect(retrofit.life).toBe(s.gpuLife);
  });

  it("starts Justified rent on Anthropic's schedule", () => {
    const before = at("WULF", "2027-09-01", flat).revenue.contracted;
    const after = at("WULF", "2028-06-30", flat).revenue.contracted;
    expect(after - before).toBeCloseTo(950e6, 0);
    const full = at("WULF", "2028-06-30");
    expect(full.mw.live + full.mw.contracted).toBeCloseTo(839, 6);
  });

  it("uses Galaxy's construction cost and Hut 8's NOI as given", () => {
    const g = at("GLXY", "2027-12-31", flat);
    expect(g.noi).toBeCloseTo((315e6 + 690e6) * 0.9, 0);
    // Hut 8 discloses a 3% escalator, so its average NOI is reached over the term, not on day one.
    const river = blocks(companyByTicker("HUT")!, s).find((b) => b.ramp.id === "hut-river")!;
    const years = Array.from({ length: 15 }, (_, k) => rentScale(river, river.start + (k + 0.0001) * 365.25 * 86_400_000));
    expect(years.reduce((a, k) => a + k, 0) / 15 * river.noi).toBeCloseTo(454e6, -4);
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

  it("values the AI business on earnings, EBITDA or a cap rate, and keeps IREN on earnings", () => {
    const hut = companyByTicker("HUT")!;
    const pe = valuation(hut, blocks(hut, run), run, ctx);
    expect(pe.ai.ev).toBeCloseTo(pe.ai.earnings * s.multiple + pe.target.debt, 0);
    const eb = { ...run, basis: "ebitda" as const };
    const ev = valuation(hut, blocks(hut, eb), eb, ctx);
    expect(ev.ai.ev).toBeCloseTo(ev.ai.noi * s.multiple, 0);
    const cap = { ...run, basis: "cap" as const, capRate: 0.075 };
    const c = valuation(hut, blocks(hut, cap), cap, ctx);
    expect(c.nav).toBeDefined();
    expect(c.aiToday).toBeCloseTo(c.nav!.sites + c.nav!.rampCash - c.nav!.capex - c.nav!.overhead, 0);
    const iren = companyByTicker("IREN")!;
    const i = valuation(iren, blocks(iren, cap), cap, ctx);
    expect(i.ai.ev).toBeCloseTo(i.ai.earnings * cap.multiple + i.target.debt, 0);
  });

  it("charges each company's overhead to the AI business", () => {
    const hut = companyByTicker("HUT")!;
    const p = pointAt(blocks(hut, s), s, Date.parse("2030-12-31"));
    const ai = aiValueAt(hut, p, s);
    expect(ai.overheadAi + ai.overheadOther).toBeCloseTo(hut.balance!.overhead, 0);
    expect(ai.noi).toBeCloseTo(p.noi - ai.overheadAi, 0);
    const noStock = aiValueAt(hut, p, { ...s, stockPay: false });
    expect(noStock.overheadAi + noStock.overheadOther).toBeCloseTo(hut.balance!.overhead - hut.balance!.stockPay, 0);
  });

  it("adds the balance sheet to the AI value today", () => {
    const hut = companyByTicker("HUT")!;
    const v = valuation(hut, blocks(hut, s), s, ctx);
    expect(v.equity).toBeCloseTo(v.aiToday + v.interimToday + v.ai.otherValue + v.bridge.net, 0);
    const b = hut.balance!;
    const expected = b.cash + (b.bitcoin ?? 0) * ctx.btc - b.debt - (b.claims ?? []).reduce((a, c) => a + c.value, 0) - v.bridge.remaining;
    expect(v.bridge.net).toBeCloseTo(expected, 0);
    expect(v.price!).toBeCloseTo(v.equity / v.shares!, 6);
  });

  it("leaves the leverage assumption out of the EBITDA and cap-rate prices", () => {
    for (const basis of ["ebitda", "cap"] as const) {
      const low = { ...s, basis, leverage: 0.2 };
      const high = { ...s, basis, leverage: 0.8 };
      const wulf = companyByTicker("WULF")!;
      expect(valuation(wulf, blocks(wulf, low), low, ctx).price!).toBeCloseTo(valuation(wulf, blocks(wulf, high), high, ctx).price!, 6);
    }
  });

  it("counts Galaxy at book value with Helios taken out at cost", () => {
    const glxy = companyByTicker("GLXY")!;
    const v = valuation(glxy, blocks(glxy, s), s, ctx);
    const labels = v.bridge.lines.map((l) => l.label);
    expect(labels).toContain("Book equity");
    expect(labels).toContain("AI build cost already in book");
    expect(labels).not.toContain("Cash");
  });

  it("gives MARA's whole overhead to mining when no AI site is on, and floors mining at zero", () => {
    const mara = companyByTicker("MARA")!;
    const v = valuation(mara, blocks(mara, s), s, ctx);
    expect(v.ai.overheadAi).toBe(0);
    expect(v.ai.otherValue).toBe(0);
    const b = mara.balance!;
    const net = b.cash + b.bitcoin! * ctx.btc + b.otherAssets![0].value - b.debt;
    expect(v.equity).toBeCloseTo(net, 0);
  });

  it("charges build cost only for capacity earning by the valuation year", () => {
    const hut = companyByTicker("HUT")!;
    const early = { ...run, year: 2026 };
    expect(valuation(hut, blocks(hut, early), early, ctx).bridge.remaining).toBe(0);
    expect(valuation(hut, blocks(hut, run), run, ctx).bridge.remaining).toBeGreaterThan(0);
  });

  it("credits the cash earned before the valuation year, so a later year does not just discount the value away", () => {
    const hut = companyByTicker("HUT")!;
    const at = (year: number) => ({ ...run, year });
    const v28 = valuation(hut, blocks(hut, at(2028)), at(2028), ctx);
    const v30 = valuation(hut, blocks(hut, at(2030)), at(2030), ctx);
    expect(v30.interimToday).toBeGreaterThan(v28.interimToday);
    expect(v30.price!).toBeGreaterThan(v28.price! * 0.8);
  });

  it("treats a live site as fully paid for and a far-off site as not started", () => {
    const wulf = blocks(companyByTicker("WULF")!, s);
    const now = Date.parse("2026-10-24");
    expect(spentShare(wulf.find((b) => b.ramp.id === "wulf-lm-live")!, now)).toBe(1);
    expect(spentShare(wulf.find((b) => b.ramp.id === "wulf-hawkeye")!, now)).toBe(0);
  });

  it("builds a five-year table", () => {
    const hut = companyByTicker("HUT")!;
    const rows = yearTable(hut, blocks(hut, s), s, ctx);
    expect(rows.map((r) => r.year)).toEqual([2026, 2027, 2028, 2029, 2030]);
    expect(rows[0].revenue).toBe(0);
    expect(rows[4].noi).toBeGreaterThan(rows[3].noi);
    expect(rows[4].overhead).toBeGreaterThan(0);
  });
});

describe("lease DCF", () => {
  it("adds the lease cash flows, less build cost as it is spent, to the balance sheet", () => {
    const hut = companyByTicker("HUT")!;
    const v = valuation(hut, blocks(hut, s), s, ctx);
    expect(v.dcf).toBeDefined();
    expect(v.aiToday).toBeCloseTo(v.dcf!.operating + v.dcf!.shield - v.dcf!.capex + v.dcf!.terminal, 0);
    expect(v.equity).toBeCloseTo(v.aiToday + v.ai.otherValue + v.bridge.net, 0);
    expect(v.bridge.lines.map((l) => l.label)).not.toContain("Build cost still to spend");
  });

  it("values every signed landlord book above zero", () => {
    for (const t of ["WULF", "GLXY", "CORZ", "CIFR", "APLD", "HUT"]) {
      const c = companyByTicker(t)!;
      const q = { shares: 400e6, price: 10 } as never;
      expect(valuation(c, blocks(c, s), s, { quote: q, btc: 60_000 }).price!, t).toBeGreaterThan(0);
    }
  });

  it("lowers value as the required return rises", () => {
    const wulf = companyByTicker("WULF")!;
    const low = valuation(wulf, blocks(wulf, { ...s, dcfRate: 0.07 }), { ...s, dcfRate: 0.07 }, ctx).price!;
    const high = valuation(wulf, blocks(wulf, { ...s, dcfRate: 0.1 }), { ...s, dcfRate: 0.1 }, ctx).price!;
    expect(low).toBeGreaterThan(high);
  });

  it("solves the return today's price implies", () => {
    const wulf = companyByTicker("WULF")!;
    const r = impliedReturn(wulf, s, ctx)!;
    const at = { ...s, dcfRate: r };
    expect(valuation(wulf, blocks(wulf, at), at, ctx).price!).toBeCloseTo(11, 4);
  });

  it("counts the tax saved on interest, and only while there is profit to shield", () => {
    const hut = companyByTicker("HUT")!;
    const v = valuation(hut, blocks(hut, s), s, ctx);
    expect(v.dcf!.shield).toBeGreaterThan(0);
    // Never more than tax on the full interest bill, run off over 15 years and undiscounted.
    expect(v.dcf!.shield).toBeLessThan(hut.balance!.interest! * s.tax * 15);
    const noTax = { ...s, tax: 0 };
    expect(valuation(hut, blocks(hut, noTax), noTax, ctx).dcf!.shield).toBe(0);
  });

  it("keeps IREN on earnings", () => {
    const iren = companyByTicker("IREN")!;
    expect(valuation(iren, blocks(iren, s), s, ctx).dcf).toBeUndefined();
  });
});

describe("cap rate on stabilized NOI", () => {
  const cap = { ...s, basis: "cap" as const, capRate: 0.07 };

  it("capitalizes each lease's average NOI, so a disclosed average comes through whole", () => {
    // Galaxy's two signed phases with disclosed rent, at their disclosed 90% margin.
    const glxy = companyByTicker("GLXY")!;
    const only = { ...cap, off: ["glxy-3"] };
    const v = valuation(glxy, blocks(glxy, only), only, ctx);
    expect(v.nav!.stabilizedNoi).toBeCloseTo((315e6 + 690e6) * 0.9, -3);
  });

  it("does not depend on the valuation year", () => {
    const wulf = companyByTicker("WULF")!;
    const a = valuation(wulf, blocks(wulf, { ...cap, year: 2027 }), { ...cap, year: 2027 }, ctx).price!;
    const b = valuation(wulf, blocks(wulf, { ...cap, year: 2030 }), { ...cap, year: 2030 }, ctx).price!;
    expect(a).toBeCloseTo(b, 6);
  });

  it("rises as the cap rate falls", () => {
    const hut = companyByTicker("HUT")!;
    const low = { ...cap, capRate: 0.06 };
    expect(valuation(hut, blocks(hut, low), low, ctx).price!).toBeGreaterThan(valuation(hut, blocks(hut, cap), cap, ctx).price!);
  });
});

describe("chance unsigned power gets leased", () => {
  const wulf = companyByTicker("WULF")!;
  const price = (odds: number, on: string[] = ["wulf-muskie-1", "wulf-muskie-2"]) => {
    const sc = { ...s, leaseOdds: odds, on };
    return valuation(wulf, blocks(wulf, sc), sc, ctx).price!;
  };

  it("adds nothing at 0% and about half at 50%", () => {
    const signed = price(1, []);
    expect(price(0)).toBeCloseTo(signed, 6);
    const full = price(1) - signed;
    const half = price(0.5) - signed;
    expect(half / full).toBeGreaterThan(0.4);
    expect(half / full).toBeLessThan(0.6);
  });

  it("leaves signed leases at full weight", () => {
    for (const b of blocks(wulf, { ...s, leaseOdds: 0.1 })) {
      if (b.ramp.tier === "live" || b.ramp.tier === "contracted") expect(b.weight).toBe(1);
      else expect(b.weight).toBe(0.1);
    }
  });
});

describe("rent escalators", () => {
  it("turns a term-average rent into the first year's rent", () => {
    // A 15-year lease with $1.25B of base rent and 3% escalators starts at about $67M a year.
    expect((1.25e9 / 15) / averageFactor(0.03, 15)).toBeCloseTo(67.2e6, -5);
  });

  it("grows a rent priced at your lease rate from its start", () => {
    const pearl = blocks(companyByTicker("CIFR")!, s).find((b) => b.ramp.id === "cifr-pearl")!;
    expect(pearl.averageFactor).toBe(1);
    expect(rentScale(pearl, pearl.start)).toBeCloseTo(1, 9);
    expect(rentScale(pearl, pearl.start + 2 * 365.25 * 86_400_000)).toBeCloseTo(1.03 ** 2, 9);
  });

  it("uses the company's escalator over the default", () => {
    const river = blocks(companyByTicker("HUT")!, { ...s, escalator: 0.05 }).find((b) => b.ramp.id === "hut-river")!;
    expect(river.escalator).toBe(0.03);
    expect(river.escalatorFrom).toBe("company");
  });

  it("leaves GPU cloud contracts flat", () => {
    for (const b of blocks(companyByTicker("IREN")!, s)) expect(b.escalator).toBe(0);
  });
});

describe("stock reaction to an event", () => {
  const history = ["2026-07-01", "2026-07-02", "2026-07-06", "2026-07-07", "2026-07-08", "2026-07-09", "2026-07-10", "2026-07-13"].map((date, i) => ({ date, close: 10 + i }));
  it("runs from the last close before the event to five trading days after", () => {
    expect(reaction(history, { date: "2026-07-04", kind: "deal", title: "", source: "" })).toBeCloseTo(16 / 11 - 1, 9);
  });
  it("waits until five trading days have passed", () => {
    expect(reaction(history, { date: "2026-07-10", kind: "deal", title: "", source: "" })).toBeNull();
  });
  it("skips events dated only to the month", () => {
    expect(reaction(history, { date: "2026-07-04", monthOnly: true, kind: "deal", title: "", source: "" })).toBeNull();
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
  it("solves the multiple that lands on today'run price", () => {
    const wulf = companyByTicker("WULF")!;
    const v = valuation(wulf, blocks(wulf, run), run, ctx);
    const m = marketMultiple(wulf, v, run, ctx)!;
    const at = { ...run, multiple: m };
    expect(valuation(wulf, blocks(wulf, at), at, ctx).price!).toBeCloseTo(11, 6);
  });

  it("solves the cap rate that lands on today's price", () => {
    const hut = companyByTicker("HUT")!;
    const cap = { ...s, basis: "cap" as const };
    const v = valuation(hut, blocks(hut, cap), cap, ctx);
    const c = marketMultiple(hut, v, cap, ctx)!;
    const at = { ...cap, capRate: c };
    expect(valuation(hut, blocks(hut, at), at, ctx).price!).toBeCloseTo(11, 6);
  });

  it("prices Muskie as upside that grows once it is built", () => {
    const early = { ...s, basis: "ebitda" as const, year: 2028 };
    const rows = upside(companyByTicker("WULF")!, early, ctx);
    const m1 = rows.find((r) => r.block.ramp.id === "wulf-muskie-1")!;
    expect(m1.builtYear).toBe(2029);
    expect(m1.addBuilt!).toBeGreaterThan(m1.addNow!);
    expect(rows.every((r) => !r.block.enabled)).toBe(true);
  });

  it("gives one price per valuation year", () => {
    const hut = companyByTicker("HUT")!;
    const rows = priceByYear(hut, s, ctx);
    expect(rows.map((r) => r.year)).toEqual([2026, 2027, 2028, 2029, 2030]);
    expect(rows.find((r) => r.year === s.year)!.price).toBeCloseTo(valuation(hut, blocks(hut, s), s, ctx).price!, 6);
  });
});
