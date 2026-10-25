import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { HyperFormula, DetailedCellError } from "hyperformula";
import { book } from "@/data/ledger";
import { blocks, valuation, type Ctx } from "@/lib/forecast";
import { buildWorkbook } from "@/lib/excel";
import { defaultScenario, type Scenario } from "@/lib/scenario";

/** Recalculate a workbook the way a spreadsheet would, from its formulas alone, and read back its named cells. */
function recalc(wb: ExcelJS.Workbook) {
  const sheets: Record<string, (string | number | boolean | null)[][]> = {};
  wb.eachSheet((ws) => {
    const rows: (string | number | boolean | null)[][] = [];
    ws.eachRow({ includeEmpty: true }, (row, r) => {
      const out: (string | number | boolean | null)[] = [];
      row.eachCell({ includeEmpty: true }, (cell, c) => {
        const v = cell.value as unknown;
        let x: string | number | boolean | null = null;
        if (v == null) x = null;
        else if (typeof v === "object" && v !== null && "formula" in v) x = `=${(v as { formula: string }).formula}`;
        else if (v instanceof Date) x = v.getTime() / 86_400_000 + 25569;
        else if (typeof v === "object" && v !== null && "text" in v) x = String((v as { text: string }).text);
        else x = v as string | number | boolean;
        out[c - 1] = x;
      });
      rows[r - 1] = Array.from(out, (x) => (x === undefined ? null : x));
    });
    sheets[ws.name] = Array.from(rows, (x) => x ?? []);
  });
  const names = (wb.definedNames.model as { name: string; ranges: string[] }[]).map((d) => ({ name: d.name, expression: `=${d.ranges[0]}` }));
  const hf = HyperFormula.buildFromSheets(sheets, { licenseKey: "gpl-v3", useArrayArithmetic: true }, names);
  const errors: string[] = [];
  for (const name of Object.keys(sheets)) {
    const id = hf.getSheetId(name)!;
    hf.getSheetValues(id).forEach((row, r) => row.forEach((v, c) => { if (v instanceof DetailedCellError) errors.push(`${name}!R${r + 1}C${c + 1} ${v.value} ${v.message}`); }));
  }
  const get = (n: string) => hf.getNamedExpressionValue(n) as number;
  /** Every stored result that differs from what its formula calculates. */
  const stale: string[] = [];
  wb.eachSheet((ws) => {
    const id = hf.getSheetId(ws.name)!;
    ws.eachRow((row, r) => row.eachCell((cell, c) => {
      const v = cell.value as { formula?: string; result?: unknown } | null;
      if (!v || typeof v !== "object" || !("formula" in v) || typeof v.result !== "number") return;
      const got = hf.getCellValue({ sheet: id, row: r - 1, col: c - 1 });
      if (typeof got !== "number" || Math.abs(got - v.result) > Math.max(1e-6, Math.abs(got) * 1e-6)) stale.push(`${ws.name}!R${r}C${c} stored ${v.result} calc ${String(got)}`);
    }));
  });
  return { get, errors, stale };
}

const ctx = (t: string): Ctx => ({ quote: { price: 10, shares: 300e6 } as never, btc: 80_000 });

async function check(ticker: string, s: Scenario) {
  const company = book.find((c) => c.ticker === ticker)!;
  const value = valuation(company, blocks(company, s), s, ctx(ticker));
  const wb = buildWorkbook(ExcelJS, { company, scenario: s, ctx: ctx(ticker), value });
  const { get, errors, stale } = recalc(wb);
  return { site: value.price!, sheet: get("ImpliedPrice"), errors, value, get, stale };
}

const landlords = book.filter((c) => c.model !== "gpu-cloud").map((c) => c.ticker);

describe("Excel export", () => {
  it.each(landlords)("recalculates %s to the site's implied price, with no formula errors", async (t) => {
    const r = await check(t, defaultScenario);
    expect(r.errors.slice(0, 5)).toEqual([]);
    expect(r.sheet).toBeCloseTo(r.site, 2);
    // Stored results are what previews show, so they must equal what the formulas calculate.
    expect(r.stale.slice(0, 5)).toEqual([]);
  }, 60_000);

  it.each([
    ["signed terms only", { ...defaultScenario, renew: false }],
    ["unsigned sites at 50%", { ...defaultScenario, tiers: { ...defaultScenario.tiers, announced: true, pipeline: true } }],
    ["renewal cut, refits, no state tax", { ...defaultScenario, renewRent: 0.8, refitCost: 3, stateTax: false, taxWriteOff: 0 }],
  ] as const)("matches the site with %s", async (_, s) => {
    for (const t of ["WULF", "HUT", "CIFR"]) {
      const r = await check(t, s);
      expect(r.errors.slice(0, 5)).toEqual([]);
      expect(r.sheet, t).toBeCloseTo(r.site, 2);
    }
  }, 120_000);

  it("gives every named input its own cell", () => {
    for (const company of book.filter((c) => c.model !== "gpu-cloud")) {
      const wb = buildWorkbook(ExcelJS, { company, scenario: defaultScenario, ctx: ctx(company.ticker), value: valuation(company, blocks(company, defaultScenario), defaultScenario, ctx(company.ticker)) });
      const cells = (wb.definedNames.model as { name: string; ranges: string[] }[]).map((d) => d.ranges[0]);
      expect(new Set(cells).size, company.ticker).toBe(cells.length);
    }
  });

  it("splits the value the way the page does", async () => {
    const r = await check("WULF", defaultScenario);
    const d = r.value.dcf!;
    // The workbook works in $ millions.
    expect(r.get("RenewalRent")).toBeCloseTo(d.renewal / 1e6, 3);
    expect(r.get("SignedRent")).toBeCloseTo((d.operating - d.renewal) / 1e6, 3);
    expect(r.get("ExitValue")).toBeCloseTo(d.terminal / 1e6, 3);
    expect(-r.get("BuildSpend")).toBeCloseTo(d.capex / 1e6, 3);
  }, 60_000);
});
