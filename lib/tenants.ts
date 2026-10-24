import type { Company } from "@/data/types";
import { itMw } from "@/lib/forecast";
import type { Scenario } from "@/lib/scenario";

export type TenantKind = "Hyperscaler" | "Neocloud" | "Lab" | "Chip" | "Unnamed";

export interface TenantRow {
  name: string;
  kind: TenantKind;
  /** Signed critical IT megawatts in this book. */
  itMw: number;
  tickers: string[];
}

function bucket(tenant: string | undefined): { name: string; kind: TenantKind } {
  const t = tenant ?? "";
  if (/meta/i.test(t)) return { name: "Meta", kind: "Hyperscaler" };
  if (/amazon/i.test(t)) return { name: "Amazon", kind: "Hyperscaler" };
  if (/microsoft/i.test(t)) return { name: "Microsoft", kind: "Hyperscaler" };
  if (/coreweave/i.test(t)) return { name: "CoreWeave", kind: "Neocloud" };
  if (/fluidstack|core42/i.test(t)) return { name: "Fluidstack", kind: "Neocloud" };
  if (/anthropic/i.test(t)) return { name: "Anthropic", kind: "Lab" };
  if (/frontier/i.test(t)) return { name: "Frontier lab", kind: "Lab" };
  if (/amd/i.test(t)) return { name: "AMD", kind: "Chip" };
  if (/investment-grade/i.test(t)) return { name: "Unnamed, investment grade", kind: "Unnamed" };
  return { name: "Tenant not named", kind: "Unnamed" };
}

/** Signed leases in the book, grouped by the tenant the company named. */
export function tenantRows(companies: Company[], scenario: Scenario): TenantRow[] {
  const rows = new Map<string, TenantRow & { names: Set<string> }>();
  for (const company of companies) {
    for (const ramp of company.ramps) {
      if (ramp.tier !== "live" && ramp.tier !== "contracted") continue;
      const b = bucket(ramp.tenant);
      const row = rows.get(b.name) ?? { ...b, itMw: 0, tickers: [], names: new Set<string>() };
      row.itMw += itMw(ramp, scenario);
      row.names.add(company.ticker);
      rows.set(b.name, row);
    }
  }
  return [...rows.values()]
    .map(({ names, ...row }) => ({ ...row, tickers: [...names].sort() }))
    .sort((a, b) => b.itMw - a.itMw);
}
