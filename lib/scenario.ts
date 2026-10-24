import type { Tier } from "@/data/types";

export interface Scenario {
  /** Default switch state for each tier. Individual ramps can override it. */
  tiers: Record<Tier, boolean>;
  on: string[];
  off: string[];
  basis: "pe" | "ebitda";
  multiple: number;
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
}

export const TIERS: Tier[] = ["live", "contracted", "announced", "pipeline"];

export const tierLabel: Record<Tier, string> = {
  live: "In service",
  contracted: "Signed",
  announced: "Announced",
  pipeline: "Pipeline",
};

export const tierBlurb: Record<Tier, string> = {
  live: "Built, handed over and earning.",
  contracted: "Tenant signed, still being built or handed over.",
  announced: "Power and a date from the company, tenant still open.",
  pipeline: "Power the company controls, with timing we estimate.",
};

export const defaultScenario: Scenario = {
  tiers: { live: true, contracted: true, announced: false, pipeline: false },
  on: [],
  off: [],
  basis: "pe",
  multiple: 20,
  year: 2028,
  discount: 0.1,
  leaseRate: 155,
  gpuRate: 9.7,
  coloMargin: 0.85,
  gpuMargin: 0.85,
  buildCost: 10,
  gpuCost: 29,
  leverage: 0.65,
  interest: 0.08,
  tax: 0.21,
  shellLife: 25,
  gpuLife: 5,
  slip: 0,
  dilution: 0,
  conversion: 0.7,
};

export type PresetId = "bear" | "base" | "bull";

export const presets: Record<PresetId, { label: string; blurb: string; apply: (s: Scenario) => Scenario }> = {
  bear: {
    label: "Bear",
    blurb: "Signed capacity only, six months late, lower rents and a 14× multiple.",
    apply: (s) => ({
      ...s,
      tiers: { live: true, contracted: true, announced: false, pipeline: false },
      on: [],
      off: [],
      multiple: 14,
      discount: 0.12,
      leaseRate: Math.round((defaultScenario.leaseRate * 0.85) / 5) * 5,
      coloMargin: 0.8,
      gpuMargin: 0.7,
      slip: 6,
    }),
  },
  base: {
    label: "Base",
    blurb: "Signed capacity on company timelines at 20× earnings.",
    apply: () => ({ ...defaultScenario }),
  },
  bull: {
    label: "Bull",
    blurb: "Announced sites get leased on time at higher rents and 25× earnings.",
    apply: (s) => ({
      ...s,
      tiers: { live: true, contracted: true, announced: true, pipeline: false },
      on: [],
      off: [],
      multiple: 25,
      discount: 0.09,
      leaseRate: Math.round((defaultScenario.leaseRate * 1.1) / 5) * 5,
      coloMargin: 0.88,
      gpuMargin: 0.85,
      slip: 0,
    }),
  },
};

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
];

const tierCode: Record<Tier, string> = { live: "l", contracted: "c", announced: "a", pipeline: "p" };

export function encodeScenario(s: Scenario): string {
  const p = new URLSearchParams();
  for (const { key, q, scale } of numParams) {
    if (s[key] !== defaultScenario[key]) p.set(q, String(Math.round(s[key] * scale * 100) / 100));
  }
  if (s.basis !== defaultScenario.basis) p.set("b", s.basis);
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
  if (params.get("b") === "ebitda") s.basis = "ebitda";
  const t = params.get("t");
  if (t != null) {
    for (const tier of TIERS) s.tiers[tier] = t.includes(tierCode[tier]);
  }
  const list = (key: string) => (params.get(key) ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  s.on = list("on");
  s.off = list("off");
  return s;
}
