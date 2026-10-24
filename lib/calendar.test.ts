import { describe, expect, it } from "vitest";
import { book, companyByTicker } from "@/data/ledger";
import { calendar, milestones, quarters } from "@/lib/calendar";
import { defaultScenario } from "@/lib/scenario";

const today = Date.parse("2026-10-25");
const s = defaultScenario;
const labels = (ticker: string, sc = s) => milestones(companyByTicker(ticker)!, sc, today).map((m) => m.label);

describe("build calendar", () => {
  it("starts at the current quarter", () => {
    const cols = quarters(8, today);
    expect(cols.map((q) => q.label)).toEqual(["Q4 26", "Q1 27", "Q2 27", "Q3 27", "Q4 27", "Q1 28", "Q2 28", "Q3 28"]);
    expect(cols[0].current).toBe(true);
  });

  it("lists WULF's signed phases in order and leaves Muskie off until it is switched on", () => {
    expect(labels("WULF")).toEqual(["CB-4", "CB-5", "Justified begins", "Justified complete"]);
    const all = { ...s, tiers: { ...s.tiers, announced: true } };
    expect(labels("WULF", all)).toContain("Muskie phase 1 begins");
  });

  it("moves with the delay setting", () => {
    const late = milestones(companyByTicker("HUT")!, { ...s, slip: 6 }, today)[0];
    const now = milestones(companyByTicker("HUT")!, s, today)[0];
    expect(late.t).toBeGreaterThan(now.t);
  });

  it("puts companies with signed leases in rows, largest first, and MARA in the unsigned list", () => {
    const cal = calendar(book, s, 7, today);
    expect(cal.rows[0].company.ticker).toBe("APLD");
    expect(cal.rows.some((r) => r.company.ticker === "MARA")).toBe(false);
    expect(cal.unsigned.map((c) => c.ticker)).toEqual(["MARA"]);
    const hut = cal.rows.find((r) => r.company.ticker === "HUT")!;
    expect(hut.now).toBe(0);
    expect(hut.first).toBe(Date.parse("2027-04-01"));
    const cifr = cal.rows.find((r) => r.company.ticker === "CIFR")!;
    expect(cifr.live).toBe(0);
    expect(cifr.now).toBeGreaterThan(0);
    expect(cifr.first).toBeNull();
    expect(cal.rows.find((r) => r.company.ticker === "APLD")!.now).toBe(250);
  });
});
