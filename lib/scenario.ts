import type { ModelKind, Tier } from "@/data/types";

export interface Scenario {
  /** Default switch state for each tier. Individual ramps can override it. */
  tiers: Record<Tier, boolean>;
  on: string[];
  off: string[];
  basis: "pe" | "ebitda" | "cap" | "dcf";
  multiple: number;
  /** Landlord cap rate. A higher rate is a lower price. IREN ignores this and stays on earnings. */
  capRate: number;
  /** Lease DCF: the return you require on the leases' cash flows. */
  dcfRate: number;
  /** Lease DCF: what a site sells for at the end of the forecast, as a cap rate on its NOI then. */
  exitCap: number;
  /** Value the run-rate at the end of this year. */
  year: number;
  discount: number;
  /** Lease rate for colo capacity without a disclosed rent, $ per kW-month. */
  leaseRate: number;
  /** GPU cloud revenue for capacity without a contract, $M per MW-year. */
  gpuRate: number;
  coloMargin: number;
  gpuMargin: number;
  /** Shell build cost where the company has not given one, $M per IT MW. */
  buildCost: number;
  /** GPU capex where the company has not given one, $M per IT MW. */
  gpuCost: number;
  leverage: number;
  interest: number;
  tax: number;
  shellLife: number;
  gpuLife: number;
  /** Months added to every date still in the future. */
  slip: number;
  /** Share count growth per year. */
  dilution: number;
  /** IT megawatts per gross or utility megawatt. */
  conversion: number;
  /**
   * Chance that a switched-on site with no signed tenant gets leased on these terms.
   * Its rent and build cost both count at this weight, so it adds an expected value, not the best case.
   */
  leaseOdds: number;
  /** Annual rent escalator for leases that do not disclose one. GPU cloud contracts do not escalate. */
  escalator: number;
  /** Multiple on annual gross profit, after its share of overhead, for businesses outside the AI forecast. */
  otherMultiple: number;
  /** Count stock-based pay as a cost inside overhead. */
  stockPay: boolean;
}

export const TIERS: Tier[] = ["live", "contracted", "announced", "pipeline"];

export const tierLabel: Record<Tier, string> = {
  live: "In service",
  contracted: "Signed",
  announced: "No tenant yet",
  pipeline: "Future option",
};

export const tierBlurb: Record<Tier, string> = {
  live: "Built, handed over and earning rent.",
  contracted: "Tenant signed. Still being built or handed over.",
  announced: "The company has the power and a date. It still needs a tenant.",
  pipeline: "Power the company controls, on a timeline we estimate.",
};

export const defaultScenario: Scenario = {
  tiers: { live: true, contracted: true, announced: false, pipeline: false },
  on: [],
  off: [],
  basis: "dcf",
  multiple: 20,
  capRate: 0.075,
  dcfRate: 0.08,
  exitCap: 0.07,
  year: 2030,
  discount: 0.1,
  leaseRate: 125,
  gpuRate: 9.7,
  coloMargin: 0.85,
  gpuMargin: 0.85,
  buildCost: 12,
  gpuCost: 29,
  leverage: 0.65,
  interest: 0.08,
  tax: 0.21,
  shellLife: 25,
  gpuLife: 5,
  slip: 0,
  dilution: 0,
  conversion: 0.7,
  leaseOdds: 0.5,
  escalator: 0.03,
  otherMultiple: 4,
  stockPay: true,
};

export type PresetId = "bear" | "base" | "bull";

export const presets: Record<PresetId, { label: string; blurb: string; apply: (s: Scenario) => Scenario }> = {
  bear: {
    label: "Bear",
    blurb: "Signed capacity only, six months late, lower rents, and a 9.5% required return with an 8% exit cap rate.",
    apply: (s) => ({
      ...s,
      tiers: { live: true, contracted: true, announced: false, pipeline: false },
      on: [],
      off: [],
      multiple: 14,
      capRate: 0.09,
      dcfRate: 0.095,
      exitCap: 0.08,
      leaseOdds: 0.25,
      discount: 0.12,
      leaseRate: Math.round((defaultScenario.leaseRate * 0.85) / 5) * 5,
      coloMargin: 0.8,
      gpuMargin: 0.7,
      slip: 6,
    }),
  },
  base: {
    label: "Base",
    blurb: "Signed capacity on company timelines, valued over each lease at an 8% required return.",
    apply: () => ({ ...defaultScenario }),
  },
  bull: {
    label: "Bull",
    blurb: "Sites with no tenant yet get leased on time, at higher rents, with a 7% required return.",
    apply: (s) => ({
      ...s,
      tiers: { live: true, contracted: true, announced: true, pipeline: false },
      on: [],
      off: [],
      multiple: 25,
      capRate: 0.067,
      dcfRate: 0.07,
      exitCap: 0.0625,
      leaseOdds: 1,
      discount: 0.09,
      leaseRate: Math.round((defaultScenario.leaseRate * 1.1) / 5) * 5,
      coloMargin: 0.88,
      gpuMargin: 0.85,
      slip: 0,
    }),
  },
};

/** GPU cloud stays on earnings. A cap rate is a landlord tool. */
export function appliedBasis(model: ModelKind, s: Scenario): Scenario["basis"] {
  return model === "gpu-cloud" ? "pe" : s.basis;
}

/** Short label for the header. The scope is which kinds of sites are on. */
export function scenarioChip(s: Scenario): { main: string; scope: string } {
  const pctOf = (v: number) => `${(v * 100).toFixed(1).replace(/\.0$/, "")}%`;
  const main = s.basis === "dcf"
    ? `Lease DCF ${pctOf(s.dcfRate)}`
    : s.basis === "cap"
      ? `${pctOf(s.capRate)} cap rate`
      : s.basis === "pe"
        ? `${s.multiple}× · ${s.year}`
        : `${s.multiple}× EBITDA · ${s.year}`;
  const parts: string[] = [];
  if (s.tiers.live && s.tiers.contracted) parts.push("Signed");
  else if (s.tiers.live) parts.push("In service");
  else if (s.tiers.contracted) parts.push("Signed, not yet running");
  if (s.tiers.announced) parts.push("no tenant");
  if (s.tiers.pipeline) parts.push("options");
  const odds = `${Math.round(s.leaseOdds * 100)}%`;
  let scope = parts.join(" + ") || "No sites";
  // The chance applies only to unsigned power, so it sits next to that part of the scope.
  if (s.tiers.announced || s.tiers.pipeline) scope += ` at ${odds}`;
  else if (s.on.length) scope += ` + ${s.on.length} unsigned site${s.on.length > 1 ? "s" : ""} at ${odds}`;
  if (s.off.length) scope += `, ${s.off.length} switched off`;
  return { main, scope };
}

/** One line on how a company is valued under this scenario. */
export function methodLine(model: ModelKind, s: Scenario): { label: string; detail: string } {
  const pctOf = (v: number) => `${(v * 100).toFixed(1).replace(/\.0$/, "")}%`;
  const basis = appliedBasis(model, s);
  if (model === "gpu-cloud") return { label: `${s.multiple}× earnings, end ${s.year}`, detail: "GPU cloud runs on contracts of about five years, so it is valued on earnings under every method." };
  if (basis === "dcf") return { label: `Lease DCF at ${pctOf(s.dcfRate)}`, detail: `Rent over each lease, discounted at ${pctOf(s.dcfRate)}, with sites sold at a ${pctOf(s.exitCap)} cap rate in 2050.` };
  if (basis === "cap") return { label: `${pctOf(s.capRate)} cap rate`, detail: `Each site's average NOI over its lease, capitalized at ${pctOf(s.capRate)} once fully online and discounted at ${pctOf(s.dcfRate)}.` };
  return { label: `${s.multiple}× ${basis === "pe" ? "earnings" : "EBITDA"}, end ${s.year}`, detail: `The end-${s.year} run-rate at ${s.multiple}× ${basis === "pe" ? "earnings" : "EBITDA"}, discounted to today.` };
}

export function matchPreset(s: Scenario): PresetId | null {
  for (const id of Object.keys(presets) as PresetId[]) {
    const p = presets[id].apply(defaultScenario);
    if (sameScenario(p, s)) return id;
  }
  return null;
}

function sameScenario(a: Scenario, b: Scenario): boolean {
  return encodeScenario(a) === encodeScenario(b);
}

type NumKey = { [K in keyof Scenario]: Scenario[K] extends number ? K : never }[keyof Scenario];

/** Short URL keys, with a scale so the query reads as whole numbers where it can. */
const numParams: { key: NumKey; q: string; scale: number; min: number; max: number }[] = [
  { key: "multiple", q: "m", scale: 1, min: 1, max: 60 },
  { key: "capRate", q: "cap", scale: 100, min: 4, max: 12 },
  { key: "dcfRate", q: "dr", scale: 100, min: 4, max: 20 },
  { key: "exitCap", q: "xc", scale: 100, min: 4, max: 12 },
  { key: "year", q: "y", scale: 1, min: 2026, max: 2030 },
  { key: "discount", q: "d", scale: 100, min: 0, max: 30 },
  { key: "leaseRate", q: "lr", scale: 1, min: 40, max: 500 },
  { key: "gpuRate", q: "gr", scale: 1, min: 1, max: 40 },
  { key: "coloMargin", q: "cm", scale: 100, min: 10, max: 98 },
  { key: "gpuMargin", q: "gm", scale: 100, min: 10, max: 98 },
  { key: "buildCost", q: "bc", scale: 1, min: 1, max: 40 },
  { key: "gpuCost", q: "gc", scale: 1, min: 1, max: 80 },
  { key: "leverage", q: "lev", scale: 100, min: 0, max: 90 },
  { key: "interest", q: "int", scale: 100, min: 0, max: 20 },
  { key: "tax", q: "tax", scale: 100, min: 0, max: 40 },
  { key: "shellLife", q: "sl", scale: 1, min: 5, max: 50 },
  { key: "gpuLife", q: "gl", scale: 1, min: 2, max: 10 },
  { key: "slip", q: "slip", scale: 1, min: 0, max: 36 },
  { key: "dilution", q: "dil", scale: 100, min: 0, max: 30 },
  { key: "conversion", q: "cv", scale: 100, min: 30, max: 100 },
  { key: "otherMultiple", q: "om", scale: 1, min: 0, max: 15 },
  { key: "escalator", q: "esc", scale: 100, min: 0, max: 8 },
  { key: "leaseOdds", q: "lo", scale: 100, min: 0, max: 100 },
];

const tierCode: Record<Tier, string> = { live: "l", contracted: "c", announced: "a", pipeline: "p" };

export function encodeScenario(s: Scenario): string {
  const p = new URLSearchParams();
  for (const { key, q, scale } of numParams) {
    if (s[key] !== defaultScenario[key]) p.set(q, String(Math.round(s[key] * scale * 100) / 100));
  }
  if (s.basis !== defaultScenario.basis) p.set("b", s.basis);
  if (s.stockPay !== defaultScenario.stockPay) p.set("sp", s.stockPay ? "1" : "0");
  const tiers = TIERS.filter((t) => s.tiers[t]).map((t) => tierCode[t]).join("");
  const defaultTiers = TIERS.filter((t) => defaultScenario.tiers[t]).map((t) => tierCode[t]).join("");
  if (tiers !== defaultTiers) p.set("t", tiers || "-");
  if (s.on.length) p.set("on", [...s.on].sort().join(","));
  if (s.off.length) p.set("off", [...s.off].sort().join(","));
  return p.toString();
}

export function decodeScenario(params: URLSearchParams): Scenario {
  const s: Scenario = { ...defaultScenario, tiers: { ...defaultScenario.tiers } };
  for (const { key, q, scale, min, max } of numParams) {
    const raw = params.get(q);
    if (raw == null || raw === "") continue;
    const n = Number(raw);
    if (!Number.isFinite(n)) continue;
    s[key] = Math.min(max, Math.max(min, n)) / scale;
  }
  if (params.get("sp") === "0") s.stockPay = false;
  const basis = params.get("b");
  if (basis === "ebitda" || basis === "cap" || basis === "dcf" || basis === "pe") s.basis = basis;
  const t = params.get("t");
  if (t != null) {
    for (const tier of TIERS) s.tiers[tier] = t.includes(tierCode[tier]);
  }
  const list = (key: string) => (params.get(key) ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  s.on = list("on");
  s.off = list("off");
  return s;
}
