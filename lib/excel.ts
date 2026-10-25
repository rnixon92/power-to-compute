import type ExcelJSType from "exceljs";
import type { Company } from "@/data/types";
import { BUILD_LEAD, DCF_END, DEBT_RUNOFF_YEARS, STATE_TAX, STATE_TAX_UNKNOWN, TODAY, aiValueAt, blocks, leaseFlows, pointAt, spentShare, stateOf, sumTiers, taxRateOf, type Ctx, type Valuation } from "@/lib/forecast";
import { tierLabel, type Scenario } from "@/lib/scenario";

/**
 * The lease DCF as a workbook with live formulas: the same inputs as the page, laid out so each step can be read
 * and changed. Built in the browser, so the static site needs no server. `ExcelJS` is passed in so the page can
 * load the library only when someone asks for a download.
 */

type Workbook = ExcelJSType.Workbook;
type Worksheet = ExcelJSType.Worksheet;
type Cell = ExcelJSType.Cell;

const FONT = "Arial";
const INK = "FF1A1C20";
const MUTED = "FF6B6A66";
const INPUT = "FF0000FF";
const LINK = "FF008000";
const INPUT_FILL = "FFFFF6D9";
const HEAD_FILL = "FF1F2430";
const BAND_FILL = "FFF3F4F6";
const LINE = "FFD9DBE0";

const FMT = {
  /** Money is stored in $ millions, so it reads the same in Excel, Sheets, Numbers and phone previews. */
  money: '$#,##0.0;($#,##0.0);"-"',
  price: '$#,##0.00;($#,##0.00);"-"',
  pct: '0.0%;(0.0%);"-"',
  pct2: '0.00%;(0.00%);"-"',
  date: "mmm d, yyyy",
  /** A date that reads "-" when zero and "Never" at the far-future placeholder. */
  dateOrNot: '[=0]"-";[>=2958465]"Never";mmm d, yyyy',
  month: "mmm yyyy",
  mw: '#,##0" MW";(#,##0" MW");"-"',
  num: '#,##0.00;(#,##0.00);"-"',
  int: '#,##0;(#,##0);"-"',
  factor: "0.0000",
  years: '0.0" yrs"',
};

const DAY_MS = 86_400_000;
/** Excel serial date for a UTC timestamp. */
const serial = (t: number) => t / DAY_MS + 25569;

function col(n: number): string {
  let s = "";
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
  return s;
}

function style(c: Cell, o: { bold?: boolean; size?: number; color?: string; fill?: string; fmt?: string; align?: "left" | "right" | "center"; italic?: boolean; wrap?: boolean }) {
  c.font = { name: FONT, size: o.size ?? 10, bold: o.bold, italic: o.italic, color: { argb: o.color ?? INK } };
  if (o.fill) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: o.fill } };
  if (o.fmt) c.numFmt = o.fmt;
  if (o.align || o.wrap) c.alignment = { horizontal: o.align, vertical: "middle", wrapText: o.wrap };
}

const f = (formula: string) => ({ formula });

/** Money cells hold $ millions. Values from the model are in dollars, so they are scaled on the way in. */
const toCell = (v: number, fmt?: string) => (fmt === FMT.money ? v / 1e6 : v);

function input(c: Cell, value: number | string | Date | null, fmt?: string) {
  c.value = typeof value === "number" ? toCell(value, fmt) : value;
  style(c, { color: INPUT, fill: INPUT_FILL, fmt, align: typeof value === "string" ? "left" : "right" });
  c.border = { top: { style: "thin", color: { argb: LINE } }, bottom: { style: "thin", color: { argb: LINE } }, left: { style: "thin", color: { argb: LINE } }, right: { style: "thin", color: { argb: LINE } } };
}

/** A formula cell. `result` is stored with it so previews that do not calculate, like Quick Look or a phone, still show the number. */
function calc(c: Cell, formula: string, fmt?: string, o: { bold?: boolean; color?: string; result?: number } = {}) {
  c.value = o.result != null && Number.isFinite(o.result) ? ({ formula, result: toCell(o.result, fmt) } as ExcelJSType.CellFormulaValue) : f(formula);
  style(c, { fmt, align: "right", bold: o.bold, color: o.color });
}

function header(ws: Worksheet, row: number, labels: string[], from = 1) {
  labels.forEach((l, i) => {
    const c = ws.getCell(row, from + i);
    c.value = l;
    style(c, { bold: true, color: "FFFFFFFF", fill: HEAD_FILL, align: i === 0 ? "left" : "center", wrap: true });
  });
  ws.getRow(row).height = 30;
}

function title(ws: Worksheet, text: string, sub?: string) {
  const t = ws.getCell("B2");
  t.value = text;
  style(t, { bold: true, size: 16 });
  if (sub) {
    const s = ws.getCell("B3");
    s.value = sub;
    style(s, { color: MUTED });
  }
}

interface Ref {
  name: string;
  cell: string;
}

/** A labeled row on a sheet: label in B, value in C, note in D. The value gets a workbook-wide name. */
function line(wb: Workbook, ws: Worksheet, row: number, label: string, name: string | null, put: (c: Cell) => void, note?: string): Ref | null {
  const l = ws.getCell(row, 2);
  l.value = label;
  style(l, {});
  const c = ws.getCell(row, 3);
  put(c);
  if (note) {
    const n = ws.getCell(row, 4);
    n.value = note;
    style(n, { color: MUTED, wrap: true });
  }
  if (!name) return null;
  const ref = `'${ws.name}'!$C$${row}`;
  wb.definedNames.add(ref, name);
  return { name, cell: ref };
}

function section(ws: Worksheet, row: number, text: string) {
  const c = ws.getCell(row, 2);
  c.value = text;
  style(c, { bold: true, size: 12 });
  ws.getCell(row, 2).border = { bottom: { style: "thin", color: { argb: LINE } } };
  ws.getCell(row, 3).border = { bottom: { style: "thin", color: { argb: LINE } } };
  ws.getCell(row, 4).border = { bottom: { style: "thin", color: { argb: LINE } } };
}

export interface ExportInput {
  company: Company;
  scenario: Scenario;
  ctx: Ctx;
  value: Valuation;
  url?: string;
}

export function buildWorkbook(ExcelJS: typeof ExcelJSType, { company, scenario: s, ctx, value, url }: ExportInput): Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Power to Compute";
  wb.created = new Date(Date.parse(TODAY));
  wb.calcProperties.fullCalcOnLoad = true;

  const summary = wb.addWorksheet("Summary", { properties: { tabColor: { argb: "FF2A78D6" } }, views: [{ showGridLines: false }] });
  const assume = wb.addWorksheet("Assumptions", { properties: { tabColor: { argb: "FFEDA100" } }, views: [{ showGridLines: false }] });
  const sites = wb.addWorksheet("Sites", { properties: { tabColor: { argb: "FFEDA100" } }, views: [{ showGridLines: false, state: "frozen", xSplit: 1, ySplit: 6 }] });
  const balance = wb.addWorksheet("Balance sheet", { properties: { tabColor: { argb: "FFEDA100" } }, views: [{ showGridLines: false }] });
  const model = wb.addWorksheet("Model", { properties: { tabColor: { argb: "FF7D7B75" } }, views: [{ showGridLines: false, state: "frozen", xSplit: 3, ySplit: 13 }] });
  const years = wb.addWorksheet("By year", { properties: { tabColor: { argb: "FF7D7B75" } }, views: [{ showGridLines: false, state: "frozen", ySplit: 5 }] });

  const list = blocks(company, s).filter((b) => !b.gpu);
  const first = 7;
  const last = Math.max(first, first + list.length - 1);
  const sr = (c: string) => `Sites!$${c}$${first}:$${c}$${last}`;

  /* ---------- Assumptions ---------- */
  title(assume, "Assumptions", "Blue cells on a yellow fill are inputs. Change any of them and every sheet recalculates.");
  for (const [i, w] of [2, 44, 16, 70].entries()) assume.getColumn(i + 1).width = w;
  let r = 5;
  section(assume, r++, "Valuation");
  line(wb, assume, r++, "Valuation date", "Today", (c) => { c.value = new Date(Date.parse(TODAY)); style(c, { fmt: FMT.date, align: "right" }); }, "Prices and balance sheets as of this date. The monthly grid starts here.");
  line(wb, assume, r++, "Required return", "Return", (c) => input(c, s.dcfRate, FMT.pct2), "The annual return you ask of the lease cash flows.");
  line(wb, assume, r++, "Exit cap rate", "ExitCap", (c) => input(c, s.exitCap, FMT.pct2), "Each site is sold at its NOI divided by this rate at the end of the forecast.");
  line(wb, assume, r++, "Forecast end", "EndDate", (c) => { c.value = new Date(DCF_END); style(c, { fmt: FMT.date, align: "right" }); }, "Fixed. The Model sheet runs monthly to here.");
  section(assume, ++r, "Rents and costs, where a company has not disclosed them");
  r++;
  line(wb, assume, r++, "Rent escalator", "Escalator", (c) => input(c, s.escalator, FMT.pct2), "A year. Used where a lease has no disclosed escalator.");
  line(wb, assume, r++, "Starting lease rate, $ per kW-month", "LeaseRate", (c) => input(c, s.leaseRate, FMT.num), "Used where a lease has no disclosed rent.");
  line(wb, assume, r++, "NOI margin", "ColoMargin", (c) => input(c, s.coloMargin, FMT.pct), "Used where a lease has no disclosed NOI or margin.");
  line(wb, assume, r++, "Build cost, $M per IT MW", "BuildCost", (c) => input(c, s.buildCost, FMT.num), "Used where a company has not given a build cost.");
  line(wb, assume, r++, "IT MW per gross MW", "Conversion", (c) => input(c, s.conversion, FMT.num), "Converts gross or utility power to critical IT.");
  line(wb, assume, r++, "Build starts, months before first rent", "BuildLead", (c) => input(c, BUILD_LEAD, FMT.int), "Build cost is spent evenly from here to full capacity.");
  line(wb, assume, r++, "Chance unsigned power gets leased", "LeaseOdds", (c) => input(c, s.leaseOdds, FMT.pct), "Applies to sites with no tenant yet that you count.");
  section(assume, ++r, "Renewals");
  r++;
  line(wb, assume, r++, "Tenant renews when a lease ends (1 yes, 0 no)", "Renew", (c) => input(c, s.renew ? 1 : 0, FMT.int), "0 stops rent at each signed term, ends overhead with the last lease, and sells each building at book value.");
  line(wb, assume, r++, "Rent on renewal, share of the last rent", "RenewRent", (c) => input(c, s.renewRent, FMT.pct), "100% carries the escalated rent on.");
  line(wb, assume, r++, "Refit cost at each renewal, $M per IT MW", "RefitCost", (c) => input(c, s.refitCost, FMT.num), "Charged each time a lease rolls.");
  line(wb, assume, r++, "Building life on the books, years", "BuildLife", (c) => input(c, s.shellLife, FMT.int), "Sets book value when a lease ends with no renewal.");
  section(assume, ++r, "Tax");
  r++;
  line(wb, assume, r++, "Federal tax rate", "FedTax", (c) => input(c, s.tax, FMT.pct), undefined);
  line(wb, assume, r++, "Add state tax by site (1 yes, 0 no)", "StateTaxOn", (c) => input(c, s.stateTax ? 1 : 0, FMT.int), "2026 top rates from the Tax Foundation, weighted by MW and deductible federally. See the table below.");
  line(wb, assume, r++, "Build cost written off up front", "WriteOff", (c) => input(c, s.taxWriteOff, FMT.pct), "Equipment that qualifies for 100% bonus depreciation. Applies to spend from the valuation date.");
  line(wb, assume, r++, "Building tax life, years", "TaxLife", (c) => input(c, s.taxLife, FMT.int), "US law uses 39 years for nonresidential property.");
  line(wb, assume, r++, "Interest runs off over, years", "RunoffYears", (c) => input(c, DEBT_RUNOFF_YEARS, FMT.int), "Today's interest bill falls to zero over this many years as project debt amortizes.");
  section(assume, ++r, "Rest of the company");
  r++;
  line(wb, assume, r++, "Count stock-based pay in overhead (1 yes, 0 no)", "StockPay", (c) => input(c, s.stockPay ? 1 : 0, FMT.int), undefined);
  line(wb, assume, r++, "Multiple on other businesses' gross profit", "OtherMultiple", (c) => input(c, s.otherMultiple, FMT.num), "After their share of overhead.");
  line(wb, assume, r++, "Year used to split overhead", "ValYear", (c) => input(c, s.year, "0"), "Overhead is shared with other businesses by gross profit at the end of this year.");
  line(wb, assume, r++, "Share dilution a year", "Dilution", (c) => input(c, s.dilution, FMT.pct), "Grows the share count to the end of that year.");
  section(assume, ++r, "State tax table");
  r++;
  const stateTop = r;
  for (const [st, rate] of Object.entries(STATE_TAX)) {
    const l = assume.getCell(r, 2);
    l.value = st;
    style(l, {});
    input(assume.getCell(r, 3), rate, FMT.pct2);
    r++;
  }
  wb.definedNames.add(`'Assumptions'!$B$${stateTop}:$B$${r - 1}`, "StateCodes");
  wb.definedNames.add(`'Assumptions'!$C$${stateTop}:$C$${r - 1}`, "StateRates");
  line(wb, assume, r++, "Where the state is not disclosed", "StateUnknown", (c) => input(c, STATE_TAX_UNKNOWN, FMT.pct2), "Texas has no income tax, so its 0.75% margin tax stands in. BC carries the gap to Canada's 27%.");
  const counted = list.filter((b) => b.enabled && b.leaseYears);
  const windDownAt = !s.renew && counted.length ? serial(Math.max(...counted.map((b) => b.start + b.leaseYears * 365.25 * DAY_MS))) : 2958465;
  // Two results that depend on the Sites sheet sit at the end of this sheet.
  const rateRow = ++r;
  const windRow = rateRow + 1;

  /* ---------- Balance sheet ---------- */
  const bal = company.balance;
  title(balance, "Balance sheet", bal ? `At ${bal.asOf}. Each line is from the company's filing. Change them as new filings land.` : "No balance sheet in the ledger.");
  for (const [i, w] of [2, 44, 18, 70].entries()) balance.getColumn(i + 1).width = w;
  r = 5;
  const bridgeRows: string[] = [];
  const book = bal?.bookEquity != null;
  if (bal) {
    section(balance, r++, "Between the AI business and each share ($M)");
    if (book) {
      line(wb, balance, r, "Book equity", "BookEquity", (c) => input(c, bal.bookEquity!, FMT.money), bal.bookNote);
      bridgeRows.push(`C${r++}`);
      line(wb, balance, r, "AI build cost already in book", "BuiltInBook", (c) => calc(c, `-SUMPRODUCT(${sr("AE")},${sr("Z")},${sr("AB")})`, FMT.money, { result: value.bridge.lines.find((l) => l.label === "AI build cost already in book")?.value }), "Taken out so the data centers are not counted twice.");
      bridgeRows.push(`C${r++}`);
    } else {
      line(wb, balance, r, "Cash, including restricted", "Cash", (c) => input(c, bal.cash, FMT.money), undefined);
      bridgeRows.push(`C${r++}`);
      if (bal.bitcoin) {
        line(wb, balance, r++, "Bitcoin held, coins", "Coins", (c) => input(c, bal.bitcoin ?? 0, FMT.int), undefined);
        line(wb, balance, r++, "Bitcoin price", "BtcPrice", (c) => input(c, ctx.btc, FMT.price), "From Coinbase when the workbook was made.");
        line(wb, balance, r, "Bitcoin value", null, (c) => calc(c, "Coins*BtcPrice/1000000", FMT.money, { result: (bal.bitcoin ?? 0) * ctx.btc }), undefined);
        bridgeRows.push(`C${r++}`);
      }
      for (const a of bal.otherAssets ?? []) {
        line(wb, balance, r, a.label, null, (c) => input(c, a.value, FMT.money), a.note);
        bridgeRows.push(`C${r++}`);
      }
      line(wb, balance, r, "Debt", null, (c) => input(c, -bal.debt, FMT.money), bal.debtNote);
      bridgeRows.push(`C${r++}`);
      for (const cl of bal.claims ?? []) {
        line(wb, balance, r, cl.label, null, (c) => input(c, -cl.value, FMT.money), cl.note);
        bridgeRows.push(`C${r++}`);
      }
    }
    line(wb, balance, r++, "Total", "Bridge", (c) => calc(c, bridgeRows.length ? `SUM(${bridgeRows.join(",")})` : "0", FMT.money, { bold: true, result: value.bridge.net }), undefined);
    r++;
    section(balance, r++, "Running costs and tax ($M)");
    line(wb, balance, r++, "Overhead a year", "OverheadAll", (c) => input(c, bal.overhead, FMT.money), bal.overheadNote);
    line(wb, balance, r++, "Of which stock-based pay", "StockPayAmount", (c) => input(c, bal.stockPay, FMT.money), undefined);
    line(wb, balance, r++, "Overhead counted", "Overhead", (c) => calc(c, "OverheadAll-IF(StockPay=1,0,StockPayAmount)", FMT.money, { result: bal.overhead - (s.stockPay ? 0 : bal.stockPay) }), undefined);
    line(wb, balance, r++, "Interest a year", "Interest", (c) => input(c, bal.interest ?? 0, FMT.money), bal.interestNote);
    line(wb, balance, r++, bal.other ? `${bal.other.label}, gross profit a year` : "Other businesses, gross profit a year", "OtherGP", (c) => input(c, Math.max(0, bal.other?.grossProfit ?? 0), FMT.money), bal.other?.note);
    const tl = bal.taxLosses;
    line(wb, balance, r++, "Tax value of losses carried forward", "TaxLosses", (c) => input(c, tl?.value ?? 0, FMT.money), tl ? `From the 10-K at ${tl.asOf}, before any valuation allowance.` : undefined);
    line(wb, balance, r++, "Deferred tax on property", "TaxProperty", (c) => input(c, tl?.property ?? 0, FMT.money), "Negative where depreciation was taken early for tax.");
    line(wb, balance, r++, "Tax losses the model uses", "TaxCredit", (c) => calc(c, book ? "0" : "MAX(0,TaxLosses+TaxProperty)", FMT.money, { result: book || !tl ? 0 : Math.max(0, tl.value + tl.property) }), book ? "Galaxy's book equity already carries them." : "Used against future tax, up to 80% of each month's.");
    if (tl?.filing) {
      const link = balance.getCell(r++, 2);
      link.value = { text: "10-K on SEC EDGAR", hyperlink: tl.filing };
      style(link, { color: "FF2A78D6" });
    }
  } else {
    for (const [name, v] of [["Bridge", 0], ["Overhead", 0], ["Interest", 0], ["OtherGP", 0], ["TaxCredit", 0]] as const) {
      line(wb, balance, r++, name, name, (c) => input(c, v, FMT.money));
    }
  }

  /* ---------- Sites ---------- */
  title(sites, `${company.ticker} sites`, "One row per phase. Set Counted to 1 to include a phase, 0 to leave it out. Blank escalator, rent, margin or build cost uses the Assumptions sheet.");
  const siteCols: [string, number][] = [
    ["Site", 30], ["Tier", 13], ["Tenant", 22], ["Counted (1/0)", 9], ["Chance of leasing", 10], ["MW as given", 10], ["Unit", 11], ["IT MW", 10],
    ["State", 7], ["State tax", 9], ["First rent", 12], ["Fully online", 12], ["Lease term, yrs", 9], ["Escalator, disclosed", 10], ["Escalator used", 10],
    ["Rent a year, disclosed ($M)", 14], ["NOI a year, disclosed ($M)", 14], ["NOI margin, disclosed", 10], ["Rent figure is", 11], ["Term-average factor", 10],
    ["Rent a year used ($M)", 14], ["NOI a year used ($M)", 14], ["Rent per $ of NOI", 10], ["Build cost total, disclosed ($M)", 14], ["Build cost per MW, disclosed ($M)", 14],
    ["Build cost used ($M)", 14], ["Build starts", 12], ["Built by valuation date", 10], ["Lease ends", 12], ["Ends, if counted", 12], ["Weight", 9],
    ["Sale at book value if no renewal ($M)", 14], ["Source", 40],
  ];
  header(sites, 6, siteCols.map((c) => c[0]));
  siteCols.forEach(([, w], i) => (sites.getColumn(i + 1).width = w));
  const rate = taxRateOf(company, list, s);
  const YEAR_MS = 365.25 * DAY_MS;
  list.forEach((b, i) => {
    const row = first + i;
    const rr = b.ramp;
    const st = stateOf(company, rr.campus);
    const chance = rr.tier === "announced" || rr.tier === "pipeline" ? s.leaseOdds : 1;
    const weight = b.enabled ? chance : 0;
    const buildStart = new Date(b.start);
    buildStart.setUTCMonth(buildStart.getUTCMonth() - BUILD_LEAD);
    const spentNow = spentShare(b, Date.parse(TODAY));
    const leaseEnd = b.start + b.leaseYears * YEAR_MS;
    const bookShare = Math.max(0, 1 - b.leaseYears / s.shellLife);
    const src = company.sources.find((x) => x.id === rr.source);
    const cell = (c: number) => sites.getCell(row, c);
    const put = (c: number, v: string) => { cell(c).value = v; style(cell(c), {}); };
    put(1, rr.label);
    put(2, tierLabel[rr.tier]);
    put(3, rr.tenant ?? "");
    input(cell(4), b.enabled ? 1 : 0, FMT.int);
    calc(cell(5), `IF(OR(B${row}="${tierLabel.announced}",B${row}="${tierLabel.pipeline}"),LeaseOdds,1)`, FMT.pct, { result: chance });
    input(cell(6), rr.mw, FMT.int);
    input(cell(7), rr.unit, undefined);
    calc(cell(8), `IF(OR(G${row}="gross",G${row}="utility"),F${row}*Conversion,F${row})`, FMT.int, { result: b.itMw });
    input(cell(9), stateOf(company, rr.campus) ?? "", undefined);
    calc(cell(10), `IFERROR(INDEX(StateRates,MATCH(I${row},StateCodes,0)),StateUnknown)`, FMT.pct2, { result: st != null && st in STATE_TAX ? STATE_TAX[st] : STATE_TAX_UNKNOWN });
    input(cell(11), new Date(b.start), FMT.date);
    input(cell(12), new Date(b.full), FMT.date);
    input(cell(13), b.leaseYears, FMT.int);
    input(cell(14), rr.escalator ?? null, FMT.pct2);
    calc(cell(15), `IF(N${row}="",Escalator,N${row})`, FMT.pct2, { result: b.escalator });
    input(cell(16), rr.revenue ?? null, FMT.money);
    input(cell(17), rr.noi ?? null, FMT.money);
    input(cell(18), rr.margin ?? null, FMT.pct);
    const basis = rr.rentBasis ?? (rr.revenue != null || rr.noi != null ? "average" : "first-year");
    input(cell(19), basis === "average" ? "Term average" : "First year", undefined);
    calc(cell(20), `IF(OR(S${row}="First year",O${row}<=0,M${row}<=1),1,((1+O${row})^M${row}-1)/(O${row}*M${row}))`, FMT.factor, { result: b.averageFactor });
    calc(cell(21), `IF(P${row}="",H${row}*1000*LeaseRate*12/1000000,P${row})`, FMT.money, { result: b.revenue });
    calc(cell(22), `IF(Q${row}<>"",Q${row},U${row}*IF(R${row}="",ColoMargin,R${row}))`, FMT.money, { result: b.noi });
    calc(cell(23), `IF(V${row}>0,U${row}/V${row},0)`, FMT.factor, { result: b.noi > 0 ? b.revenue / b.noi : 0 });
    input(cell(24), rr.capexTotal ?? null, FMT.money);
    input(cell(25), rr.capexPerMw ?? null, FMT.money);
    calc(cell(26), `IF(X${row}<>"",X${row},IF(Y${row}<>"",Y${row}*H${row},BuildCost*H${row}))`, FMT.money, { result: b.capex });
    calc(cell(27), `EDATE(K${row},-BuildLead)`, FMT.date, { result: serial(buildStart.getTime()) });
    calc(cell(28), `IF(Today<=AA${row},0,IF(Today>=L${row},1,(Today-AA${row})/(L${row}-AA${row})))`, FMT.pct, { result: spentNow });
    calc(cell(29), `K${row}+M${row}*365.25`, FMT.date, { result: serial(leaseEnd) });
    calc(cell(30), `IF(AND(D${row}=1,M${row}>0),AC${row},0)`, FMT.dateOrNot, { result: b.enabled && b.leaseYears > 0 ? serial(leaseEnd) : 0 });
    calc(cell(31), `D${row}*E${row}`, FMT.pct, { result: weight });
    calc(cell(32), `AE${row}*Z${row}*(MAX(0,1-M${row}/BuildLife)-TaxRate*(MAX(0,1-M${row}/BuildLife)-(1-WriteOff*(1-AB${row}))*MAX(0,1-M${row}/TaxLife)))`, FMT.money, { result: weight * b.capex * (bookShare - rate * (bookShare - (1 - s.taxWriteOff * (1 - spentNow)) * Math.max(0, 1 - b.leaseYears / s.taxLife))) });
    if (src) {
      cell(33).value = { text: src.title, hyperlink: src.url };
      style(cell(33), { color: "FF2A78D6" });
    }
    if (i % 2) for (let c = 1; c <= 3; c++) cell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: BAND_FILL } };
  });
  wb.definedNames.add(`'Assumptions'!$C$${rateRow}`, "TaxRate");
  line(wb, assume, rateRow, "Tax rate on these sites", null, (c) =>
    calc(c, `IF(StateTaxOn=1,FedTax+IF(SUMPRODUCT(${sr("AE")},${sr("H")})>0,SUMPRODUCT(${sr("AE")},${sr("H")},${sr("J")})/SUMPRODUCT(${sr("AE")},${sr("H")}),StateUnknown)*(1-FedTax),FedTax)`, FMT.pct2, { bold: true, result: taxRateOf(company, blocks(company, s), s) }),
    "Federal plus state, weighted by the MW you count.");
  line(wb, assume, windRow, "Business winds down", "WindDown", (c) => calc(c, `IF(Renew=1,2958465,IF(MAX(${sr("AD")})>0,MAX(${sr("AD")}),2958465))`, FMT.dateOrNot, { result: windDownAt }), "With no renewals, overhead stops when the last counted lease ends.");

  /* ---------- Model ---------- */
  title(model, "Model, month by month", "Money in $M. Each phase gets six columns. Totals, tax and present values follow. Rows run monthly from the valuation date. Excel, Google Sheets and Numbers fill this sheet in on opening. Quick previews leave it blank.");
  model.getColumn(1).width = 12;
  model.getColumn(2).width = 8;
  model.getColumn(3).width = 9;
  const per = ["Online", "NOI a year", "Past term", "Build spend", "Tax depreciation a year", "Refit spend"];
  const groupStart = (i: number) => 4 + i * per.length;
  const n = list.length;
  const tot = groupStart(n);
  const totals = [
    "NOI a year", "Revenue a year", "NOI from renewals", "AI share of overhead", "NOI after overhead", "Build and refit spend", "Written off this month",
    "Tax depreciation a year", "Taxable this month", "Interest this month",
    "Losses brought in", "Tax losses left", "Losses used", "Credit used", "Tax", "Losses carried out", "Tax losses carried out",
    "Losses brought in, with interest", "Tax losses left, with interest", "Losses used, with interest", "Credit used, with interest", "Tax with interest", "Losses out, with interest", "Credit out, with interest",
    "Cash after tax", "From renewals", "Tax saved on interest", "Building sales", "Discount factor", "PV cash", "PV renewals", "PV tax saved", "PV spend", "PV sales", "Year",
  ];
  const T: Record<string, string> = {};
  totals.forEach((name, i) => (T[name] = col(tot + i)));
  for (let i = 0; i < n; i++) {
    const g = groupStart(i);
    const nameCell = model.getCell(11, g);
    nameCell.value = list[i].ramp.label;
    style(nameCell, { bold: true });
    model.mergeCells(11, g, 11, g + per.length - 1);
    per.forEach((p, k) => (model.getColumn(g + k).width = 11));
  }
  totals.forEach((_, i) => (model.getColumn(tot + i).width = 13));
  header(model, 13, ["Month", "Years", "Discount", ...Array.from({ length: n }, () => per).flat(), ...totals]);
  const head = model.getCell(11, tot);
  head.value = "Company";
  style(head, { bold: true });

  const GRID = 14;
  /** Formulas for one row of the model at the date in column A. */
  const rowFormulas = (row: number, opts: { dateRef: string; grid: boolean }) => {
    const A = opts.dateRef;
    const next = `$A${row + 1}`;
    for (let i = 0; i < n; i++) {
      const sRow = first + i;
      const S = (c: string) => `Sites!$${c}$${sRow}`;
      const g = groupStart(i);
      const on = `${col(g)}${row}`;
      const ended = `${col(g + 2)}${row}`;
      calc(model.getCell(row, g), `IF(${A}<${S("K")},0,IF(OR(${A}>=${S("L")},${S("L")}=${S("K")}),1,(${A}-${S("K")})/(${S("L")}-${S("K")})))`, FMT.pct);
      calc(model.getCell(row, g + 2), `IF(AND(${S("M")}>0,${A}>=${S("AC")}),1,0)`, FMT.int);
      calc(model.getCell(row, g + 1), `${S("AE")}*${S("V")}*(1+${S("O")})^(MAX(0,${A}-${S("K")})/365.25)/${S("T")}*IF(${S("M")}>0,RenewRent^INT(MAX(0,${A}-${S("K")})/365.25/${S("M")}),1)*${on}*IF(AND(${ended}=1,Renew=0),0,1)`, FMT.money);
      if (opts.grid) {
        const spent = (x: string) => `IF(${x}<=${S("AA")},0,IF(${x}>=${S("L")},1,(${x}-${S("AA")})/(${S("L")}-${S("AA")})))`;
        calc(model.getCell(row, g + 3), `${S("AE")}*${S("Z")}*(${spent(next)}-${spent(A)})`, FMT.money);
        calc(model.getCell(row, g + 4), `IF(AND(${A}>=${S("K")},${A}<${S("K")}+TaxLife*365.25),${S("AE")}*${S("Z")}*(1-WriteOff*(1-${S("AB")}))*${on}/TaxLife,0)`, FMT.money);
        const at = `(${S("K")}+MAX(1,ROUNDUP((${A}-${S("K")})/(${S("M")}*365.25),0))*${S("M")}*365.25)`;
        calc(model.getCell(row, g + 5), `IF(AND(Renew=1,RefitCost>0,${S("M")}>0),IF(AND(${at}>=${A},${at}<${next}),${S("AE")}*${S("H")}*RefitCost,0),0)`, FMT.money);
      }
    }
    const sumOf = (k: number, mult?: (i: number) => string) =>
      n ? Array.from({ length: n }, (_, i) => `${col(groupStart(i) + k)}${row}${mult ? `*${mult(i)}` : ""}`).join("+") : "0";
    const R = (name: string) => `${T[name]}${row}`;
    calc(model.getCell(row, tot), sumOf(1), FMT.money);
    calc(model.getCell(row, tot + 1), sumOf(1, (i) => `Sites!$W$${first + i}`), FMT.money);
    calc(model.getCell(row, tot + 2), sumOf(1, (i) => `${col(groupStart(i) + 2)}${row}`), FMT.money);
    calc(model.getCell(row, tot + 3), `Overhead*IF(${R("NOI a year")}>0,${R("NOI a year")}/(${R("NOI a year")}+OtherGP),IF(OtherGP>0,0,1))`, FMT.money);
    calc(model.getCell(row, tot + 4), `IF(${A}>=WindDown,0,${R("NOI a year")}-${R("AI share of overhead")})`, FMT.money);
    if (!opts.grid) return;
    calc(model.getCell(row, tot + 5), `${sumOf(3)}+${sumOf(5)}`, FMT.money);
    calc(model.getCell(row, tot + 6), `(${sumOf(3)})*WriteOff+${sumOf(5)}`, FMT.money);
    calc(model.getCell(row, tot + 7), sumOf(4), FMT.money);
    calc(model.getCell(row, tot + 8), `(${R("NOI after overhead")}-${R("Tax depreciation a year")})/12-${R("Written off this month")}`, FMT.money);
    calc(model.getCell(row, tot + 9), `Interest*MAX(0,1-B${row}/RunoffYears)/12`, FMT.money);
    // Two tax ledgers: without and with interest. The difference is the tax that interest saves.
    const ledger = (base: number, taxable: string) => {
      const prev = (k: number, startValue: string) => (row === GRID ? startValue : `${col(tot + base + k)}${row - 1}`);
      const pool = col(tot + base);
      const left = col(tot + base + 1);
      const use = col(tot + base + 2);
      const cred = col(tot + base + 3);
      const tax = col(tot + base + 4);
      calc(model.getCell(row, tot + base), prev(5, "0"), FMT.money);
      calc(model.getCell(row, tot + base + 1), prev(6, "TaxCredit"), FMT.money);
      calc(model.getCell(row, tot + base + 2), `IF(${taxable}>0,MIN(${pool}${row},0.8*${taxable}),0)`, FMT.money);
      calc(model.getCell(row, tot + base + 3), `IF(${taxable}>0,MIN(${left}${row},(0.8*${taxable}-${use}${row})*TaxRate),0)`, FMT.money);
      calc(model.getCell(row, tot + base + 4), `IF(${taxable}>0,(${taxable}-${use}${row})*TaxRate-${cred}${row},0)`, FMT.money);
      calc(model.getCell(row, tot + base + 5), `${pool}${row}+IF(${taxable}<=0,-${taxable},-${use}${row})`, FMT.money);
      calc(model.getCell(row, tot + base + 6), `${left}${row}-${cred}${row}`, FMT.money);
      return `${tax}${row}`;
    };
    const taxA = ledger(10, R("Taxable this month"));
    const taxB = ledger(17, `(${R("Taxable this month")}-${R("Interest this month")})`);
    calc(model.getCell(row, tot + 24), `${R("NOI after overhead")}/12-${taxA}`, FMT.money);
    calc(model.getCell(row, tot + 25), `IF(${R("NOI a year")}>0,${R("Cash after tax")}*${R("NOI from renewals")}/${R("NOI a year")},0)`, FMT.money);
    calc(model.getCell(row, tot + 26), `${taxA}-${taxB}`, FMT.money);
    calc(model.getCell(row, tot + 27), `IF(Renew=0,SUMPRODUCT((${sr("AC")}>=${A})*(${sr("AC")}<${next})*(${sr("M")}>0)*${sr("AF")}),0)`, FMT.money);
    calc(model.getCell(row, tot + 28), `(1+Return)^B${row}`, FMT.factor);
    calc(model.getCell(row, tot + 29), `${R("Cash after tax")}/${R("Discount factor")}`, FMT.money);
    calc(model.getCell(row, tot + 30), `${R("From renewals")}/${R("Discount factor")}`, FMT.money);
    calc(model.getCell(row, tot + 31), `${R("Tax saved on interest")}/${R("Discount factor")}`, FMT.money);
    calc(model.getCell(row, tot + 32), `${R("Build and refit spend")}/${R("Discount factor")}`, FMT.money);
    calc(model.getCell(row, tot + 33), `${R("Building sales")}/${R("Discount factor")}`, FMT.money);
    calc(model.getCell(row, tot + 34), `YEAR(${A})`, "0");
  };

  // Two single dates the valuation needs, above the monthly grid.
  const label = (row: number, text: string, dateFormula: string) => {
    const l = model.getCell(row, 1);
    calc(l, dateFormula, FMT.date);
    const t = model.getCell(row, 2);
    t.value = text;
    style(t, { color: MUTED });
  };
  label(8, "Exit", "EndDate");
  rowFormulas(8, { dateRef: "$A$8", grid: false });
  label(9, "Year end", "DATE(ValYear,12,31)");
  rowFormulas(9, { dateRef: "$A$9", grid: false });
  const now = Date.parse(TODAY);
  // The same month steps the site takes, from the valuation date to the forecast end, plus the month after.
  const dates: number[] = [];
  for (let t = now; t < DCF_END; ) {
    dates.push(t);
    const d = new Date(t);
    d.setUTCMonth(d.getUTCMonth() + 1);
    t = d.getTime();
  }
  const rows = dates.length;
  const after = new Date(dates[rows - 1]);
  after.setUTCMonth(after.getUTCMonth() + 1);
  dates.push(after.getTime());
  dates.forEach((t, k) => {
    const c = model.getCell(GRID + k, 1);
    c.value = new Date(t);
    style(c, { fmt: FMT.month, align: "left", color: k === rows ? MUTED : INK });
  });
  for (let k = 0; k < rows; k++) {
    const row = GRID + k;
    calc(model.getCell(row, 2), `(A${row}-Today)/365.25`, FMT.num);
    calc(model.getCell(row, 3), `1/(1+Return)^B${row}`, FMT.factor);
    rowFormulas(row, { dateRef: `$A${row}`, grid: true });
    if (k % 2) model.getRow(row).eachCell((c) => { if (!c.fill || (c.fill as { fgColor?: { argb?: string } }).fgColor?.argb !== INPUT_FILL) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BAND_FILL } }; });
  }
  const END = GRID + rows - 1;
  const sum = (name: string) => `SUM(Model!$${T[name]}$${GRID}:$${T[name]}$${END})`;

  /* ---------- By year ---------- */
  title(years, "By year", "Monthly cash flows from the valuation date, added up by calendar year. Money in $M.");
  years.getColumn(1).width = 2;
  years.getColumn(2).width = 8;
  const yearCols: [string, string][] = [
    ["Revenue", "Revenue a year"], ["NOI", "NOI a year"], ["Overhead", "AI share of overhead"], ["Tax", "Tax"], ["Build and refit", "Build and refit spend"],
    ["Cash after tax", "Cash after tax"], ["Tax saved on interest", "Tax saved on interest"], ["PV of cash", "PV cash"],
  ];
  header(years, 5, ["Year", ...yearCols.map((c) => c[0])], 2);
  yearCols.forEach((_, i) => (years.getColumn(3 + i).width = 15));
  const y0 = new Date(now).getUTCFullYear();
  // The same monthly flows the page values, added up by year, stored as each cell's result for previews.
  const flows = leaseFlows(company, blocks(company, s), s);
  const all = blocks(company, s);
  const windDown = windDownAt === 2958465 ? Infinity : (windDownAt - 25569) * DAY_MS;
  const byYear = new Map<number, Record<string, number>>();
  dates.slice(0, rows).forEach((t, k) => {
    const p = pointAt(all, s, t);
    const ai = aiValueAt(company, p, s);
    const noiAi = t >= windDown ? 0 : ai.noi;
    const y = new Date(t).getUTCFullYear();
    const acc = byYear.get(y) ?? {};
    const add = (key: string, v: number) => (acc[key] = (acc[key] ?? 0) + v);
    add("Revenue a year", sumTiers(p.revenue) / 12);
    add("NOI a year", p.noi / 12);
    add("AI share of overhead", ai.overheadAi / 12);
    add("Tax", noiAi / 12 - flows.operating[k]);
    add("Build and refit spend", flows.capex[k]);
    add("Cash after tax", flows.operating[k]);
    add("Tax saved on interest", flows.shield[k]);
    add("PV cash", flows.operating[k] / Math.pow(1 + s.dcfRate, flows.years[k]));
    byYear.set(y, acc);
  });
  for (let y = y0; y <= 2050; y++) {
    const row = 6 + (y - y0);
    const yc = years.getCell(row, 2);
    yc.value = String(y);
    style(yc, { align: "left" });
    yearCols.forEach(([, name], i) => {
      const range = `Model!$${T[name]}$${GRID}:$${T[name]}$${END}`;
      const yearRange = `Model!$${T["Year"]}$${GRID}:$${T["Year"]}$${END}`;
      // Run-rate columns are a year's worth each month, so twelve of them make a year.
      const perYear = ["Revenue a year", "NOI a year", "AI share of overhead"].includes(name) ? "/12" : "";
      calc(years.getCell(row, 3 + i), `SUMPRODUCT((${yearRange}=${y})*${range})${perYear}`, FMT.money, { result: byYear.get(y)?.[name] ?? 0 });
    });
  }

  /* ---------- Summary ---------- */
  const q = ctx.quote;
  for (const [i, w] of [2, 46, 18, 18, 52].entries()) summary.getColumn(i + 1).width = w;
  title(summary, `${company.ticker} · ${company.name}`, `Lease DCF, as set on Power to Compute on ${TODAY}. Every number below is a live formula.`);
  r = 5;
  const sline = (label: string, name: string | null, formula: string, fmt: string, bold = false, note?: string, result?: number) => {
    const l = summary.getCell(r, 2);
    l.value = label;
    style(l, { bold });
    calc(summary.getCell(r, 3), formula, fmt, { bold, result });
    if (note) {
      const nn = summary.getCell(r, 5);
      nn.value = note;
      style(nn, { color: MUTED, wrap: true });
    }
    if (name) wb.definedNames.add(`'Summary'!$C$${r}`, name);
    r++;
  };
  section(summary, r++, "The answer");
  const lp = summary.getCell(r, 2);
  lp.value = "Last price";
  style(lp, {});
  input(summary.getCell(r, 3), q?.price ?? 0, FMT.price);
  wb.definedNames.add(`'Summary'!$C$${r}`, "LastPrice");
  r++;
  const sh = summary.getCell(r, 2);
  sh.value = "Shares outstanding (M)";
  style(sh, {});
  input(summary.getCell(r, 3), (q?.shares ?? 0) / 1e6, FMT.num);
  wb.definedNames.add(`'Summary'!$C$${r}`, "Shares");
  r++;
  sline("Implied value per share", "ImpliedPrice", "EquityValue/(Shares*(1+Dilution)^(MAX(0,DATE(ValYear,12,31)-Today)/365.25))", FMT.price, true, "Goal Seek this cell to the last price by changing the required return to find the return today's price implies.", value.price ?? undefined);
  sline("Against the last price", null, "IF(LastPrice>0,ImpliedPrice/LastPrice-1,0)", FMT.pct, false, undefined, value.upside ?? undefined);
  const onSite = summary.getCell(r, 2);
  onSite.value = "Implied value on the site when exported";
  style(onSite, { color: MUTED });
  const os = summary.getCell(r, 3);
  os.value = value.price ?? 0;
  style(os, { color: MUTED, fmt: FMT.price, align: "right" });
  r += 2;
  section(summary, r++, "How it adds up, discounted to today ($M)");
  const d = value.dcf;
  sline("Rent over the signed terms, after overhead and tax", "SignedRent", `${sum("PV cash")}-${sum("PV renewals")}`, FMT.money, false, undefined, d ? d.operating - d.renewal : undefined);
  sline("Rent from renewals to the forecast end", "RenewalRent", sum("PV renewals"), FMT.money, false, undefined, d?.renewal);
  sline("Tax saved on interest", "TaxSaved", sum("PV tax saved"), FMT.money, false, undefined, d?.shield);
  sline("Build and refit cost as it is spent", "BuildSpend", `-${sum("PV spend")}`, FMT.money, false, undefined, d ? -d.capex : undefined);
  sline("Sites sold at the exit cap rate", "ExitValue", "IF(EndDate>=WindDown,0,Model!$" + T["NOI after overhead"] + "$8/ExitCap/(1+Return)^((EndDate-Today)/365.25))", FMT.money, false, undefined, d?.terminal);
  sline("Buildings sold at book value, with no renewals", "BookSales", sum("PV sales"), FMT.money, false, undefined, d?.resale);
  sline("Value of the AI business", "AiValue", "SignedRent+RenewalRent+TaxSaved+BuildSpend+ExitValue+BookSales", FMT.money, true, undefined, d ? value.aiToday : undefined);
  sline(bal?.other ? `${bal.other.label}, at the multiple` : "Other businesses, at the multiple", "OtherValue", `OtherMultiple*MAX(0,OtherGP-(Overhead-Model!$${T["AI share of overhead"]}$9))`, FMT.money, false, "Gross profit less its share of overhead at the end of the overhead year.", value.ai.otherValue);
  sline("Balance sheet", null, "Bridge", FMT.money, false, "See the Balance sheet tab.", value.bridge.net);
  sline("Equity value", "EquityValue", "AiValue+OtherValue+Bridge", FMT.money, true, undefined, value.equity);
  r++;
  section(summary, r++, "How to use this workbook");
  for (const tip of [
    "Yellow cells with blue text are inputs. Everything else is a formula.",
    "Assumptions holds the return, exit cap, rents, renewals and tax. Sites holds each phase: count it, change its dates, rent or build cost.",
    "Balance sheet holds cash, debt, claims, overhead and tax losses from the latest filings.",
    "Model runs month by month to the forecast end. By year adds it up by calendar year. Open the file in Excel or Google Sheets to calculate the Model sheet: quick previews show it blank.",
    "The site's other views, the cap rate and earnings multiples, are not in this workbook.",
  ]) {
    const c = summary.getCell(r++, 2);
    c.value = `•  ${tip}`;
    style(c, { color: INK });
    summary.mergeCells(r - 1, 2, r - 1, 5);
  }
  r++;
  section(summary, r++, "Sources");
  if (url) {
    const c = summary.getCell(r++, 2);
    c.value = { text: `${company.ticker} on Power to Compute`, hyperlink: url };
    style(c, { color: "FF2A78D6" });
  }
  for (const src of company.sources) {
    const c = summary.getCell(r++, 2);
    c.value = { text: `${src.title} (${src.asOf})`, hyperlink: src.url };
    style(c, { color: "FF2A78D6" });
  }
  r++;
  const fine = summary.getCell(r, 2);
  fine.value = "Research tracker. Company figures are their own disclosures. Implied values are the assumptions in this workbook applied to them. Not investment advice.";
  style(fine, { color: MUTED, italic: true, wrap: true });
  summary.mergeCells(r, 2, r, 5);
  summary.getRow(r).height = 28;

  for (const ws of [summary, assume, sites, balance, model, years]) ws.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  return wb;
}

export function workbookName(company: Company): string {
  return `${company.ticker}-lease-dcf-${TODAY}.xlsx`;
}
